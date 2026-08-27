import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession, FIREBASE_SETUP_HINT } from "@/lib/admin-auth-firebase";
import { getDb } from "@/lib/booking/firebase-admin";
import type { Booking, AddonSelection } from "@/lib/booking/types";
import { parseSlotIdRelaxed, getSlotStartEnd } from "@/lib/booking/experience-slots";
import { formatBookingTime } from "@/lib/booking/format-booking-datetime";
import { pickAdminBookingDiscountFields } from "@/lib/booking/admin-booking-discount-fields";
import { pickAdminRescheduleFields } from "@/lib/booking/admin-reschedule";
import { customerContactForAdminApi, pickMarketplaceBookingApiFields } from "@/lib/admin/marketplace-source";
import { pickAssignedCaptainApiFields } from "@/lib/admin/assigned-captain";
import { pickOperatorNotesApiFields } from "@/lib/admin/operator-notes";

function toDate(ts: { seconds?: number; nanoseconds?: number; toDate?: () => Date }): string | null {
  if (ts.toDate) return ts.toDate().toISOString();
  if (typeof ts.seconds === "number") return new Date(ts.seconds * 1000).toISOString();
  return null;
}

type AddonWithName = { addonId: string; name: string; qty: number };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdminSession(request.headers.get("cookie"));
  if (unauthorized) return unauthorized;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Booking id required" }, { status: 400 });

  try {
    const db = getDb();
    const doc = await db.collection("bookings").doc(id).get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const b = doc.data() as Booking & { startDateStr?: string };
    const experienceId = b.experienceId;
    const boatId = b.boatId ?? null;

    let experienceName = "—";
    const addonMap = new Map<string, string>();
    if (experienceId) {
      const expSnap = await db.collection("experiences").doc(experienceId).get();
      if (expSnap.exists) experienceName = (expSnap.data() as { title?: string }).title ?? experienceId;
      const addonsSnap = await db.collection("experiences").doc(experienceId).collection("addons").get();
      addonsSnap.docs.forEach((ad) => {
        addonMap.set(ad.id, (ad.data() as { name?: string }).name ?? ad.id);
      });
    }

    let boatName: string | null = boatId;
    if (boatId) {
      const boatSnap = await db.collection("boats").doc(boatId).get();
      if (boatSnap.exists) boatName = (boatSnap.data() as { name?: string }).name ?? boatId;
    }

    const createdAt = b.createdAt ? toDate(b.createdAt as { seconds?: number; toDate?: () => Date }) : null;
    let startDate: string | null = b.startDateStr ?? null;
    let startTime: string | null = null;
    let endTime: string | null = null;
    let durationHours: number | null = null;
    const parsed = parseSlotIdRelaxed(b.slotId ?? "");
    if (parsed) {
      if (!startDate) startDate = parsed.dateStr;
      durationHours = parsed.durationHours;
      const { start, end } = getSlotStartEnd(parsed.dateStr, parsed.startHour, parsed.durationHours, parsed.startMinute ?? 0);
      startTime = formatBookingTime(start);
      endTime = formatBookingTime(end);
    }

    const addonsWithNames: AddonWithName[] = (b.addonSelections ?? []).map((sel: AddonSelection) => ({
      addonId: sel.addonId,
      name: addonMap.get(sel.addonId) ?? sel.addonId,
      qty: sel.qty ?? 1,
    }));

    const bWithExt = b as Booking & { card?: { brand?: string; last4?: string; expMonth?: number; expYear?: number }; finalChargeAt?: { seconds?: number; toDate?: () => Date } };
    const finalChargeAt = bWithExt.finalChargeAt;
    let finalChargeAtStr: string | null = null;
    if (finalChargeAt) {
      if (typeof finalChargeAt.toDate === "function") finalChargeAtStr = finalChargeAt.toDate().toISOString();
      else if (typeof (finalChargeAt as { seconds?: number }).seconds === "number") finalChargeAtStr = new Date((finalChargeAt as { seconds: number }).seconds * 1000).toISOString();
    }

    const bWaiver = (b as { waiver?: { requestId: string; status: string; templateId: string; templateVersion: number } }).waiver;

    const bNotify = b as {
      notificationFailed?: boolean;
      notificationFailureDetail?: string;
      notificationFailedAt?: { toDate?: () => Date; seconds?: number };
      slotResetPending?: boolean;
    };
    let notificationFailedAt: string | null = null;
    if (bNotify.notificationFailedAt) {
      if (typeof bNotify.notificationFailedAt.toDate === "function") {
        notificationFailedAt = bNotify.notificationFailedAt.toDate().toISOString();
      } else if (typeof (bNotify.notificationFailedAt as { seconds?: number }).seconds === "number") {
        notificationFailedAt = new Date(
          (bNotify.notificationFailedAt as { seconds: number }).seconds * 1000
        ).toISOString();
      }
    }

    let auditLogEntries: { id: string; action: string; payload: unknown; createdAt: string | null }[] = [];
    try {
      const auditSnap = await db.collection("adminAuditLog").orderBy("createdAt", "desc").limit(120).get();
      auditLogEntries = auditSnap.docs
        .map((ad) => {
          const ax = ad.data() as { action?: string; payload?: unknown; createdAt?: { toDate?: () => Date } };
          return {
            id: ad.id,
            action: ax.action ?? "",
            payload: ax.payload ?? {},
            createdAt: ax.createdAt?.toDate?.()?.toISOString() ?? null,
          };
        })
        .filter((row) => {
          const p = row.payload as { bookingId?: string };
          return p?.bookingId === id;
        })
        .slice(0, 40);
    } catch {
      auditLogEntries = [];
    }

    let operationalAlertsForBooking: { id: string; type?: string; createdAt: string | null; [k: string]: unknown }[] = [];
    try {
      const opSnap = await db.collection("operationalAlerts").where("bookingId", "==", id).limit(30).get();
      operationalAlertsForBooking = opSnap.docs.map((od) => {
        const ox = od.data() as Record<string, unknown>;
        const ts = ox.createdAt as { toDate?: () => Date } | undefined;
        return {
          id: od.id,
          ...ox,
          createdAt: ts?.toDate?.()?.toISOString() ?? null,
        };
      });
    } catch {
      operationalAlertsForBooking = [];
    }

    const bConf = b as { confirmationSentAt?: { toDate?: () => Date; seconds?: number } };
    let confirmationSentAt: string | null = null;
    if (bConf.confirmationSentAt) {
      if (typeof bConf.confirmationSentAt.toDate === "function") {
        confirmationSentAt = bConf.confirmationSentAt.toDate().toISOString();
      } else if (typeof (bConf.confirmationSentAt as { seconds?: number }).seconds === "number") {
        confirmationSentAt = new Date((bConf.confirmationSentAt as { seconds: number }).seconds * 1000).toISOString();
      }
    }

    return NextResponse.json({
      id: doc.id,
      experienceId: b.experienceId,
      experienceName,
      boatId,
      boatName,
      customer: customerContactForAdminApi(b.customer),
      partySize: b.partySize ?? null,
      petsCount: b.petsCount ?? 0,
      specialNotes: b.specialNotes ?? null,
      ...pickMarketplaceBookingApiFields(b),
      ...pickAssignedCaptainApiFields(b),
      ...pickOperatorNotesApiFields(b),
      answers: b.answers ?? {},
      addonSelections: b.addonSelections ?? [],
      addonsWithNames,
      durationHours,
      slotId: b.slotId ?? null,
      rateId: b.rateId ?? null,
      pricing: b.pricing,
      tipCents: (b as { tipCents?: number }).tipCents ?? null,
      ...pickAdminBookingDiscountFields(b as { discountCode?: string; discountCents?: number }),
      ...pickAdminRescheduleFields(b),
      status: b.status,
      stripe: b.stripe ?? undefined,
      card: bWithExt.card ?? undefined,
      finalChargeAt: finalChargeAtStr,
      createdAt,
      startDate,
      startTime,
      endTime,
      waiver: bWaiver ?? undefined,
      confirmationSentAt,
      notificationFailed: bNotify.notificationFailed === true,
      notificationFailedAt,
      notificationFailureDetail: bNotify.notificationFailureDetail ?? null,
      slotResetPending: bNotify.slotResetPending === true,
      auditLogEntries,
      operationalAlertsForBooking,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isFirebaseConfig = /firebase|FIREBASE|config missing|credential|truncated|private key/i.test(message);
    return NextResponse.json(
      { error: message, ...(isFirebaseConfig && { hint: FIREBASE_SETUP_HINT }) },
      { status: isFirebaseConfig ? 503 : 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdminSession(request.headers.get("cookie"));
  if (unauthorized) return unauthorized;
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Booking id required" }, { status: 400 });
  const body = (await request.json().catch(() => ({}))) as {
    marketplacePayoutCents?: number;
    marketplacePayoutDollars?: string;
    fromStoredEmail?: boolean;
  };
  try {
    const {
      applyMarketplacePayoutCents,
      backfillZeroDollarMarketplacePayouts,
    } = await import("@/lib/integrations/marketplaces/booking-service");
    if (body.fromStoredEmail === true) {
      const result = await backfillZeroDollarMarketplacePayouts({ bookingId: id });
      if (result.updated === 0) {
        return NextResponse.json(
          { error: "No payout found in the saved marketplace email for this booking." },
          { status: 422 }
        );
      }
      return NextResponse.json({ ok: true, ...result });
    }
    let cents =
      typeof body.marketplacePayoutCents === "number" ? Math.round(body.marketplacePayoutCents) : NaN;
    if (!Number.isFinite(cents) && typeof body.marketplacePayoutDollars === "string") {
      const n = Number.parseFloat(body.marketplacePayoutDollars.replace(/[$,]/g, "").trim());
      cents = Number.isFinite(n) ? Math.round(n * 100) : NaN;
    }
    if (!Number.isFinite(cents) || cents < 1) {
      return NextResponse.json({ error: "Enter a payout amount, like 81.90" }, { status: 400 });
    }
    const result = await applyMarketplacePayoutCents(id, cents, "admin");
    const { writeAdminAuditLog } = await import("@/lib/booking/admin-audit-log");
    const { getAdminEmailFromSessionCookie } = await import("@/lib/admin-auth-firebase");
    await writeAdminAuditLog("marketplace_payout_set", {
      bookingId: id,
      totalCents: result.totalCents,
      adminEmail: (await getAdminEmailFromSessionCookie(request.headers.get("cookie"))) ?? null,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
