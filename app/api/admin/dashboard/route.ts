import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession, FIREBASE_SETUP_HINT, getAdminPrincipalFromSessionCookie } from "@/lib/admin-auth-firebase";
import { getDb } from "@/lib/booking/firebase-admin";
import type { Booking, Experience } from "@/lib/booking/types";
import {
  BOOKING_STATUSES_SLOT_TAKEN,
  bookingRequiresBoatIdForOccupancyAlert,
} from "@/lib/booking/types";
import { parseSlotId, getSlotStartEnd, getDateStrInSlotTimezone } from "@/lib/booking/experience-slots";
import { formatBookingTime } from "@/lib/booking/format-booking-datetime";
import { getNotificationOutboxStats } from "@/lib/booking/notification-outbox";
import { displayMarketplaceGuestEmail, pickMarketplaceBookingApiFields } from "@/lib/admin/marketplace-source";

export const maxDuration = 26;

function toDate(ts: { seconds?: number; toDate?: () => Date }): Date | null {
  if (ts.toDate) return ts.toDate();
  if (typeof ts.seconds === "number") return new Date(ts.seconds * 1000);
  return null;
}

function formatTimeLabel(dateStr: string, startHour: number, durationHours: number, startMinute = 0): string {
  const { start } = getSlotStartEnd(dateStr, startHour, durationHours, startMinute);
  return formatBookingTime(start);
}

function marketplaceFieldsFromBooking(b: Booking) {
  return pickMarketplaceBookingApiFields(b);
}

/** Firestore Timestamp-shaped value on operationalAlerts documents. */
function operationalAlertCreatedAtMs(data: {
  createdAt?: { toDate?: () => Date; seconds?: number };
}): number | null {
  const ca = data.createdAt;
  if (!ca) return null;
  if (typeof ca.toDate === "function") return ca.toDate().getTime();
  if (typeof ca.seconds === "number") return ca.seconds * 1000;
  return null;
}

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminSession(request.headers.get("cookie"));
  if (unauthorized) return unauthorized;
  const principal = await getAdminPrincipalFromSessionCookie(request.headers.get("cookie"));
  if (principal?.role === "captain") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const db = getDb();
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const todayStr = getDateStrInSlotTimezone(now);
    const in7Days = new Date(now);
    in7Days.setDate(in7Days.getDate() + 6);
    const in7DaysStr = getDateStrInSlotTimezone(in7Days);

    const [upcomingSnap, experiencesSnap, recentBookingsSnap, backfillStatusSnap] = await Promise.all([
      db
        .collection("bookings")
        .where("status", "in", Array.from(BOOKING_STATUSES_SLOT_TAKEN))
        .where("startDateStr", ">=", todayStr)
        .where("startDateStr", "<=", in7DaysStr)
        .orderBy("startDateStr", "asc")
        .limit(500)
        .get(),
      db.collection("experiences").get(),
      db.collection("bookings").orderBy("createdAt", "desc").limit(10).get(),
      db.collection("summaries").doc("backfillStatus").get(),
    ]);
    const backfillStatus = backfillStatusSnap.exists
      ? (backfillStatusSnap.data() as {
          startDateStr?: { bookingMissingCountEstimate?: number; holdsMissingCountEstimate?: number };
        })
      : null;
    const missingBookingStartDateStrCount = backfillStatus?.startDateStr?.bookingMissingCountEstimate ?? 0;
    const missingHoldsStartDateStrCount = backfillStatus?.startDateStr?.holdsMissingCountEstimate ?? 0;

    const experienceNames = new Map<string, string>();
    /** Doc id and slug → pricingType so bookings stored with either key resolve correctly. */
    const experiencePricingType = new Map<string, Experience["pricingType"]>();
    experiencesSnap.docs.forEach((doc) => {
      const data = doc.data() as Experience;
      experienceNames.set(doc.id, data.title ?? doc.id);
      experiencePricingType.set(doc.id, data.pricingType);
      if (typeof data.slug === "string" && data.slug.trim()) {
        experiencePricingType.set(data.slug.trim(), data.pricingType);
      }
    });

    const thisMonthKey = `revenue_${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, "0")}`;
    const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const lastMonthMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    const lastMonthKey = `revenue_${lastMonthYear}_${String(lastMonthMonth).padStart(2, "0")}`;

    const [summarySnap, thisMonthSnap, lastMonthSnap, allBookingsForUnique] = await Promise.all([
      db.collection("summaries").doc("revenue").get(),
      db.collection("summaries").doc(thisMonthKey).get(),
      db.collection("summaries").doc(lastMonthKey).get(),
      db.collection("bookings").orderBy("createdAt", "desc").limit(500).get(),
    ]);

    const summary = summarySnap.exists ? (summarySnap.data() as { totalRevenueCents?: number; bookingCount?: number }) : null;
    const totalRevenueCents = summary?.totalRevenueCents ?? 0;
    /** Incremented with summary revenue (deposit/final attribution); not the same as Firestore booking-document volume. */
    const summaryIncrementedBookingCount = summary?.bookingCount ?? 0;
    const slotTakenStatuses = Array.from(BOOKING_STATUSES_SLOT_TAKEN);
    let slotTakenBookingsCount = 0;
    try {
      const agg = await db.collection("bookings").where("status", "in", slotTakenStatuses).count().get();
      slotTakenBookingsCount = agg.data().count;
    } catch (countErr) {
      console.warn("[dashboard] slot-taken bookings count() failed", countErr);
    }
    const uniqueCustomerEmails = new Set<string>();
    let recentBookingsMissingBoatId = 0;
    allBookingsForUnique.docs.forEach((d) => {
      const b = d.data() as Booking;
      const email = b.customer?.email?.trim();
      if (email) uniqueCustomerEmails.add(email);
      const st = b.status as string | undefined;
      const bid = typeof b.boatId === "string" ? b.boatId.trim() : "";
      const expKey = typeof b.experienceId === "string" ? b.experienceId.trim() : "";
      const pricingType = expKey ? experiencePricingType.get(expKey) : undefined;
      if (
        st &&
        BOOKING_STATUSES_SLOT_TAKEN.has(st as never) &&
        !bid &&
        bookingRequiresBoatIdForOccupancyAlert(b.bookingMode, pricingType)
      ) {
        recentBookingsMissingBoatId++;
      }
    });
    const uniqueCustomerCount = uniqueCustomerEmails.size;
    const revenueThisMonthCents = thisMonthSnap.exists ? ((thisMonthSnap.data() as { revenueCents?: number })?.revenueCents ?? 0) : 0;
    const revenueLastMonthCents = lastMonthSnap.exists ? ((lastMonthSnap.data() as { revenueCents?: number })?.revenueCents ?? 0) : 0;

    type MarketplaceRowFields = ReturnType<typeof pickMarketplaceBookingApiFields>;
    type RecentRow = {
      id: string;
      createdAt: string;
      customerEmail: string;
      customerName: string;
      totalCents: number;
      status: string;
      experienceName: string;
    } & MarketplaceRowFields;
    type UpcomingRow = {
      id: string;
      tripDateStr: string;
      timeLabel: string;
      experienceName: string;
      customerName: string;
      customerEmail: string;
      totalCents: number;
      /** Slot start instant (America/Chicago grid); used server-side for sort only — omitted from JSON. */
      slotStartMs: number;
    } & MarketplaceRowFields;

    const recentBookings: RecentRow[] = [];
    const upcomingBookings: UpcomingRow[] = [];

    recentBookingsSnap.docs.forEach((d) => {
      const b = d.data() as Booking;
      const createdAt = toDate(b.createdAt as { seconds?: number; toDate?: () => Date });
      const expName = b.experienceId ? experienceNames.get(b.experienceId) ?? "—" : "—";
      recentBookings.push({
        id: d.id,
        createdAt: createdAt?.toISOString() ?? "",
        customerEmail: displayMarketplaceGuestEmail(b.customer?.email),
        customerName: b.customer?.name ?? "",
        totalCents: (b.stripe?.totalAmountCents ?? b.pricing?.totalCents) ?? 0,
        status: b.status ?? "",
        experienceName: expName,
        ...marketplaceFieldsFromBooking(b),
      });
    });

    // Firestore returns recent rows by createdAt desc, but map order is not guaranteed — keep newest-first for the UI.
    recentBookings.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    upcomingSnap.docs.forEach((d) => {
      const b = d.data() as Booking;
      const parsed = parseSlotId(b.slotId);
      if (!parsed) return;
      const { dateStr } = parsed;
      const { start } = getSlotStartEnd(dateStr, parsed.startHour, parsed.durationHours, parsed.startMinute);
      const expName = b.experienceId ? experienceNames.get(b.experienceId) ?? "—" : "—";
      upcomingBookings.push({
        id: d.id,
        tripDateStr: dateStr,
        timeLabel: formatTimeLabel(dateStr, parsed.startHour, parsed.durationHours, parsed.startMinute),
        experienceName: expName,
        customerName: b.customer?.name ?? "",
        customerEmail: displayMarketplaceGuestEmail(b.customer?.email),
        totalCents: (b.stripe?.totalAmountCents ?? b.pricing?.totalCents) ?? 0,
        slotStartMs: start.getTime(),
        ...marketplaceFieldsFromBooking(b),
      });
    });

    upcomingBookings.sort((a, b) => {
      if (a.tripDateStr !== b.tripDateStr) return a.tripDateStr.localeCompare(b.tripDateStr);
      return a.slotStartMs - b.slotStartMs;
    });

    const [deadLetterSnap, notificationOutboxStats] = await Promise.all([
      db.collection("notificationOutbox").where("status", "==", "dead_letter").limit(50).get(),
      getNotificationOutboxStats(db),
    ]);
    const finalFailedReleaseSlaHoursRaw = parseInt(process.env.FINAL_FAILED_RELEASE_SLA_HOURS ?? "6", 10);
    const finalFailedReleaseSlaHours = Number.isFinite(finalFailedReleaseSlaHoursRaw)
      ? Math.max(1, finalFailedReleaseSlaHoursRaw)
      : 6;
    const finalFailedCutoff = new Date(Date.now() - finalFailedReleaseSlaHours * 60 * 60 * 1000);
    const cancelSummaryAlertCutoff = new Date();
    cancelSummaryAlertCutoff.setDate(cancelSummaryAlertCutoff.getDate() - 30);
    const cancelSummaryAlertCutoffMs = cancelSummaryAlertCutoff.getTime();
    const PAGE_SIZE_FINAL_DUE = 400;
    const [finalFailedOldSnap, cancelSummaryAlertsSnap, finalDueSnap] = await Promise.all([
      db.collection("bookings").where("status", "==", "final_failed").limit(500).get(),
      // Single equality on `type` only — avoids a composite index (type + createdAt range).
      // Filter last 30 days in memory; cap fetch for rare high-volume edge cases.
      db
        .collection("operationalAlerts")
        .where("type", "==", "admin_cancel_summary_adjustment_skipped")
        .limit(500)
        .get(),
      db.collection("bookings").where("status", "==", "final_due").limit(PAGE_SIZE_FINAL_DUE).get(),
    ]);
    let adminCancelSummaryAdjustmentSkippedCount = 0;
    for (const d of cancelSummaryAlertsSnap.docs) {
      const ms = operationalAlertCreatedAtMs(d.data() as { createdAt?: { toDate?: () => Date; seconds?: number } });
      if (ms != null && ms >= cancelSummaryAlertCutoffMs) adminCancelSummaryAdjustmentSkippedCount++;
    }
    let finalFailedBeyondGraceCount = 0;
    finalFailedOldSnap.docs.forEach((d) => {
      const b = d.data() as Booking & { finalChargeAt?: { toDate?: () => Date; seconds?: number } };
      const fc = b.finalChargeAt ? toDate(b.finalChargeAt) : null;
      if (fc && fc <= finalFailedCutoff) finalFailedBeyondGraceCount++;
    });
    const nowForFinalDue = new Date();
    let finalDuePastDueCount = 0;
    let finalDueTotalCents = 0;
    for (const d of finalDueSnap.docs) {
      const b = d.data() as Booking;
      const fc = b.finalChargeAt ? toDate(b.finalChargeAt as { toDate?: () => Date; seconds?: number }) : null;
      if (fc && fc.getTime() <= nowForFinalDue.getTime()) finalDuePastDueCount++;
      finalDueTotalCents += typeof b.stripe?.finalAmountCents === "number" ? b.stripe.finalAmountCents : 0;
    }
    const finalDueCount = finalDueSnap.size;
    let confirmationDeadLetterCount = 0;
    deadLetterSnap.docs.forEach((d) => {
      const row = d.data() as { type?: string };
      if (row.type === "booking_confirmation") confirmationDeadLetterCount++;
    });

    const upcomingRows = upcomingBookings.slice(0, 14).map(
      ({
        id,
        tripDateStr,
        timeLabel,
        experienceName,
        customerName,
        customerEmail,
        totalCents,
        source,
        externalProvider,
        externalBookingId,
        externalListingName,
        marketplaceDetails,
        marketplaceEmailExcerpt,
        externalKey,
      }) => ({
        id,
        tripDateStr,
        timeLabel,
        experienceName,
        customerName,
        customerEmail,
        totalCents,
        source,
        externalProvider,
        externalBookingId,
        externalListingName,
        marketplaceDetails,
        marketplaceEmailExcerpt,
        externalKey,
      })
    );
    const principal = await getAdminPrincipalFromSessionCookie(request.headers.get("cookie"));
    const hideFinancials = principal?.role === "operator" || principal?.role === "captain";
    return NextResponse.json({
      hideFinancials,
      totalRevenueCents: hideFinancials ? 0 : totalRevenueCents,
      revenueThisMonthCents: hideFinancials ? 0 : revenueThisMonthCents,
      revenueLastMonthCents: hideFinancials ? 0 : revenueLastMonthCents,
      slotTakenBookingsCount,
      slotTakenBookingStatuses: slotTakenStatuses,
      summaryIncrementedBookingCount: hideFinancials ? 0 : summaryIncrementedBookingCount,
      uniqueCustomerCount,
      listingCount: experiencesSnap.size,
      recentBookings: hideFinancials
        ? recentBookings.map((row) => ({ ...row, totalCents: 0 }))
        : recentBookings,
      upcomingBookings: hideFinancials ? upcomingRows.map((row) => ({ ...row, totalCents: 0 })) : upcomingRows,
      confirmationDeadLetterCount: hideFinancials ? 0 : confirmationDeadLetterCount,
      recentBookingsMissingBoatId: hideFinancials ? 0 : recentBookingsMissingBoatId,
      finalFailedBeyondGraceCount: hideFinancials ? 0 : finalFailedBeyondGraceCount,
      finalDueCount: hideFinancials ? 0 : finalDueCount,
      finalDueTotalCents: hideFinancials ? 0 : finalDueTotalCents,
      finalDuePastDueCount: hideFinancials ? 0 : finalDuePastDueCount,
      finalFailedReleaseSlaHours,
      missingBookingStartDateStrCount: hideFinancials ? 0 : missingBookingStartDateStrCount,
      missingHoldsStartDateStrCount: hideFinancials ? 0 : missingHoldsStartDateStrCount,
      adminCancelSummaryAdjustmentSkippedCount: hideFinancials ? 0 : adminCancelSummaryAdjustmentSkippedCount,
      notificationOutboxStats: hideFinancials
        ? undefined
        : {
            byType: notificationOutboxStats.byType,
            staleClaimCountsByTemplate: notificationOutboxStats.staleClaimCountsByTemplate,
            deadLetterTotal: notificationOutboxStats.deadLetter,
            pendingTotal: notificationOutboxStats.pending,
            stuckClaimsTotal: notificationOutboxStats.stuckClaims,
          },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const needsFirestoreIndex =
      /FAILED_PRECONDITION/i.test(message) && /requires an index|indexes\?create_composite/i.test(message);
    // Do not treat index error text as missing credentials: the message contains "firebase.google.com".
    const isFirebaseConfig =
      !needsFirestoreIndex &&
      /config missing|credential|truncated|private key|FIREBASE_PRIVATE_KEY|FIREBASE_PROJECT_ID|service account/i.test(
        message
      );
    const hint = needsFirestoreIndex
      ? "Firestore composite index missing or still building. Open the create_composite link in the error, or deploy indexes: firebase deploy --only firestore:indexes. Wait until the index shows Enabled in the Firebase console."
      : isFirebaseConfig
        ? FIREBASE_SETUP_HINT
        : undefined;
    return NextResponse.json(
      { error: message, ...(hint && { hint }) },
      { status: isFirebaseConfig || needsFirestoreIndex ? 503 : 500 }
    );
  }
}
