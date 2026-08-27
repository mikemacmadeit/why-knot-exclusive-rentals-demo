import { NextRequest, NextResponse } from "next/server";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { requireAdminSession } from "@/lib/admin-auth-firebase";
import { getDb, getFirestoreExports } from "@/lib/booking/firebase-admin";
import { parseSlotIdRelaxed, getSlotStartEnd } from "@/lib/booking/experience-slots";
import { getLegacyBookingScanLimit } from "@/lib/booking/legacy-booking-scan-limit";
import { getExperienceIdVariants } from "@/lib/booking/experience-aliases";
import type { Booking } from "@/lib/booking/types";
import { BOOKING_STATUSES_SLOT_TAKEN } from "@/lib/booking/types";
import { formatBookingTimeSafe } from "@/lib/booking/format-booking-datetime";

function isMissingIndexError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const code = typeof err === "object" && err && "code" in err ? String((err as { code?: unknown }).code) : "";
  return code === "9" || /FAILED_PRECONDITION|requires an index/i.test(msg);
}

/** Bookings for one experience in [from,to]; falls back when composite indexes are still building. */
async function loadExperienceBookingDocs(
  db: FirebaseFirestore,
  variantIds: string[],
  fromStr: string,
  toStr: string
): Promise<QueryDocumentSnapshot[]> {
  const seen = new Set<string>();
  const out: QueryDocumentSnapshot[] = [];
  const statusList = Array.from(BOOKING_STATUSES_SLOT_TAKEN);

  const pushFiltered = (docs: QueryDocumentSnapshot[], filterStatus: boolean) => {
    for (const doc of docs) {
      if (seen.has(doc.id)) continue;
      const b = doc.data() as Booking & { startDateStr?: string };
      if (filterStatus && !BOOKING_STATUSES_SLOT_TAKEN.has(b.status as never)) continue;
      const dateStr = b.startDateStr ?? parseSlotIdRelaxed(b.slotId ?? "")?.dateStr ?? null;
      if (!dateStr || dateStr < fromStr || dateStr > toStr) continue;
      seen.add(doc.id);
      out.push(doc);
    }
  };

  try {
    const snaps = await Promise.all(
      variantIds.map((variantId) =>
        db
          .collection("bookings")
          .where("experienceId", "==", variantId)
          .where("startDateStr", ">=", fromStr)
          .where("startDateStr", "<=", toStr)
          .where("status", "in", statusList)
          .get()
      )
    );
    for (const snap of snaps) pushFiltered(snap.docs, false);
    return out;
  } catch (err) {
    if (!isMissingIndexError(err)) throw err;
    console.warn("[admin/calendar-events] bookings composite index missing — using experienceId fallback");
  }

  try {
    const snaps = await Promise.all(
      variantIds.map((variantId) =>
        db
          .collection("bookings")
          .where("experienceId", "==", variantId)
          .where("startDateStr", ">=", fromStr)
          .where("startDateStr", "<=", toStr)
          .get()
      )
    );
    for (const snap of snaps) pushFiltered(snap.docs, true);
    return out;
  } catch (err) {
    if (!isMissingIndexError(err)) throw err;
    console.warn("[admin/calendar-events] bookings date index missing — scanning by experienceId");
  }

  const snaps = await Promise.all(
    variantIds.map((variantId) => db.collection("bookings").where("experienceId", "==", variantId).get())
  );
  for (const snap of snaps) pushFiltered(snap.docs, true);
  return out;
}

async function loadExperienceBlockDocs(
  db: FirebaseFirestore,
  variantIds: string[],
  rangeStart: Date,
  rangeEnd: Date,
  Timestamp: { fromDate: (d: Date) => unknown }
): Promise<QueryDocumentSnapshot[]> {
  const seen = new Set<string>();
  const out: QueryDocumentSnapshot[] = [];

  try {
    const snaps = await Promise.all(
      variantIds.map((variantId) =>
        db
          .collection("blocks")
          .where("experienceId", "==", variantId)
          .where("startAt", "<=", Timestamp.fromDate(rangeEnd))
          .where("endAt", ">=", Timestamp.fromDate(rangeStart))
          .get()
      )
    );
    for (const snap of snaps) {
      for (const doc of snap.docs) {
        if (seen.has(doc.id)) continue;
        seen.add(doc.id);
        out.push(doc);
      }
    }
    return out;
  } catch (err) {
    if (!isMissingIndexError(err)) throw err;
    console.warn("[admin/calendar-events] blocks composite index missing — filtering in memory");
  }

  const snaps = await Promise.all(
    variantIds.map((variantId) => db.collection("blocks").where("experienceId", "==", variantId).get())
  );
  for (const snap of snaps) {
    for (const doc of snap.docs) {
      if (seen.has(doc.id)) continue;
      const b = doc.data() as { startAt?: { toDate?: () => Date }; endAt?: { toDate?: () => Date } };
      const startAt = b.startAt?.toDate?.();
      const endAt = b.endAt?.toDate?.();
      if (!startAt || !endAt) continue;
      if (endAt.getTime() < rangeStart.getTime() || startAt.getTime() > rangeEnd.getTime()) continue;
      seen.add(doc.id);
      out.push(doc);
    }
  }
  return out;
}

// Loose typing for admin SDK without importing firebase-admin types into every call site
type FirebaseFirestore = ReturnType<typeof getDb>;
import { customerContactForAdminApi, pickMarketplaceBookingApiFields } from "@/lib/admin/marketplace-source";

/** GET: unified calendar events (bookings + blocks) for admin week/timeline view.
 * Query: from (YYYY-MM-DD), to (YYYY-MM-DD) required; experienceId optional (omit for all experiences / Bookings “By day”).
 * Optional: boatId, status (exact booking status when set).
 * Returns { events: [...] } with booking events including experienceName, customer, startDate, times when applicable.
 */
function normalizeTripDateStr(s: string | null | undefined): string | null {
  if (!s || typeof s !== "string") return null;
  const trimmed = s.trim();
  const match = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return null;
  const [, y, m, d] = match;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function toCreatedIso(ts: unknown): string | null {
  if (!ts || typeof ts !== "object") return null;
  const t = ts as { seconds?: number; toDate?: () => Date };
  if (typeof t.toDate === "function") return t.toDate().toISOString();
  if (typeof t.seconds === "number") return new Date(t.seconds * 1000).toISOString();
  return null;
}

type CalendarEvent = {
  id: string;
  type: "booking" | "block";
  startAt: string;
  endAt: string;
  boatId: string | null;
  boatName: string | null;
  title: string;
  note?: string | null;
  bookingId?: string;
  blockId?: string;
  status?: string;
  experienceName?: string;
  customer?: { name: string; email: string; phone: string };
  partySize?: number | null;
  pricing?: { totalCents: number; currency: string };
  createdAt?: string | null;
  startDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  source?: string | null;
  externalProvider?: string | null;
  externalBookingId?: string | null;
  specialNotes?: string | null;
};

function buildBookingCalendarEvent(
  doc: QueryDocumentSnapshot,
  b: Booking & { startDateStr?: string },
  boatNames: Map<string, string>,
  experienceNames: Map<string, string>,
  opts: { boatIdParam: string | null; statusParam: string | null }
): CalendarEvent | null {
  if (!BOOKING_STATUSES_SLOT_TAKEN.has(b.status as never)) return null;
  if (opts.statusParam && b.status !== opts.statusParam) return null;
  if (opts.boatIdParam && b.boatId !== opts.boatIdParam) return null;
  const parsed = parseSlotIdRelaxed(b.slotId ?? "");
  const dateStr = parsed?.dateStr ?? (b.startDateStr && /^\d{4}-\d{2}-\d{2}$/.test(b.startDateStr) ? b.startDateStr : null);
  if (!dateStr) return null;
  const rawTripDate = b.startDateStr ?? parsed?.dateStr ?? null;
  const startDate = normalizeTripDateStr(rawTripDate);
  let startTime: string | null = null;
  let endTime: string | null = null;
  let start: Date;
  let end: Date;
  if (parsed) {
    const { start: s, end: e } = getSlotStartEnd(parsed.dateStr, parsed.startHour, parsed.durationHours, parsed.startMinute ?? 0);
    startTime = formatBookingTimeSafe(s);
    endTime = formatBookingTimeSafe(e);
    start = s;
    end = e;
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      start = new Date(dateStr + "T12:00:00.000Z");
      if (!parsed.durationHours) {
        console.warn("[admin/calendar-events] booking event fallback duration: missing or falsy durationHours on parsed slotId", {
          bookingId: doc.id,
          slotId: b.slotId,
        });
      }
      end = new Date(start.getTime() + (parsed.durationHours || 3) * 60 * 60 * 1000);
    }
  } else {
    const durationParsed = parseSlotIdRelaxed(b.slotId ?? "");
    const hours =
      durationParsed != null &&
      typeof durationParsed.durationHours === "number" &&
      !Number.isNaN(durationParsed.durationHours) &&
      durationParsed.durationHours > 0
        ? durationParsed.durationHours
        : 3;
    start = new Date(dateStr + "T12:00:00.000Z");
    end = new Date(start.getTime() + hours * 60 * 60 * 1000);
  }
  const title = b.customer?.name?.trim() || b.customer?.email || "Booking";
  const expName = b.experienceId ? experienceNames.get(b.experienceId) ?? "—" : "—";
  const pricing = b.pricing;
  const totalCents = pricing?.totalCents ?? 0;
  const currency = pricing?.currency ?? "usd";
  return {
    id: `booking-${doc.id}`,
    type: "booking",
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    boatId: b.boatId ?? null,
    boatName: b.boatId ? (boatNames.get(b.boatId) ?? null) : null,
    title,
    bookingId: doc.id,
    status: b.status,
    experienceName: expName,
    customer: customerContactForAdminApi(b.customer ?? { name: "", email: "", phone: "" }),
    partySize: b.partySize ?? null,
    pricing: { totalCents, currency },
    createdAt: toCreatedIso(b.createdAt as never),
    startDate,
    startTime,
    endTime,
    ...pickMarketplaceBookingApiFields(b),
    specialNotes: b.specialNotes ?? null,
  };
}

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminSession(request.headers.get("cookie"));
  if (unauthorized) return unauthorized;

  try {
    const experienceId = request.nextUrl.searchParams.get("experienceId");
    const fromParam = request.nextUrl.searchParams.get("from");
    const toParam = request.nextUrl.searchParams.get("to");
    const boatIdParam = request.nextUrl.searchParams.get("boatId");
    const statusParam = request.nextUrl.searchParams.get("status");

    if (!fromParam || !toParam) {
      return NextResponse.json({ error: "from and to required" }, { status: 400 });
    }
    const fromStr = fromParam.slice(0, 10);
    const toStr = toParam.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromStr) || !/^\d{4}-\d{2}-\d{2}$/.test(toStr)) {
      return NextResponse.json({ error: "Invalid from/to dates" }, { status: 400 });
    }
    const { start: rangeStart } = getSlotStartEnd(fromStr, 0, 0, 0);
    const { end: rangeEnd } = getSlotStartEnd(toStr, 23, 1, 59);

    const db = getDb();
    const { Timestamp } = getFirestoreExports();
    const startThreshold = new Date(new Date(fromStr + "T12:00:00.000Z").getTime() - 14 * 24 * 60 * 60 * 1000);

    /** All experiences: bookings in [from, to] on startDateStr (admin Bookings calendar). Blocks omitted. */
    if (!experienceId) {
      const snap = await db
        .collection("bookings")
        .where("startDateStr", ">=", fromStr)
        .where("startDateStr", "<=", toStr)
        .where("status", "in", Array.from(BOOKING_STATUSES_SLOT_TAKEN))
        .get();

      const seenBookingIds = new Set<string>();
      const bookingDocs: QueryDocumentSnapshot[] = [];
      for (const d of snap.docs) {
        seenBookingIds.add(d.id);
        bookingDocs.push(d);
      }

      const legacyScanLimit = getLegacyBookingScanLimit();
      let legacyTruncated = false;
      const legacyFallbackEnabled = process.env.DISABLE_LEGACY_BOOKING_FALLBACK !== "true";
      if (legacyFallbackEnabled) {
        const legacySnap = await db
          .collection("bookings")
          .where("createdAt", ">=", Timestamp.fromDate(startThreshold))
          .orderBy("createdAt", "desc")
          .limit(legacyScanLimit)
          .get();
        if (legacySnap.size >= legacyScanLimit) legacyTruncated = true;
        for (const doc of legacySnap.docs) {
          if (seenBookingIds.has(doc.id)) continue;
          const d = doc.data() as { startDateStr?: string; slotId?: string };
          if (d.startDateStr) continue;
          const parsed = parseSlotIdRelaxed((d.slotId ?? ""));
          const dateStr = parsed?.dateStr ?? null;
          if (!dateStr || dateStr < fromStr || dateStr > toStr) continue;
          seenBookingIds.add(doc.id);
          bookingDocs.push(doc);
        }
      }
      const experienceIds = new Set<string>();
      const boatIds = new Set<string>();
      for (const d of bookingDocs) {
        const b = d.data() as Booking;
        if (b.experienceId) experienceIds.add(b.experienceId);
        if (b.boatId) boatIds.add(b.boatId);
      }
      const experienceNames = new Map<string, string>();
      await Promise.all(
        Array.from(experienceIds).map(async (id) => {
          const expSnap = await db.collection("experiences").doc(id).get();
          if (expSnap.exists) experienceNames.set(id, (expSnap.data() as { title?: string }).title ?? id);
        })
      );
      const boatNames = new Map<string, string>();
      await Promise.all(
        Array.from(boatIds).map(async (id) => {
          const boatSnap = await db.collection("boats").doc(id).get();
          if (boatSnap.exists) boatNames.set(id, (boatSnap.data() as { name?: string }).name ?? id);
        })
      );

      const events: CalendarEvent[] = [];
      const opts = { boatIdParam, statusParam };
      for (const doc of bookingDocs) {
        const b = doc.data() as Booking & { startDateStr?: string };
        const ev = buildBookingCalendarEvent(doc, b, boatNames, experienceNames, opts);
        if (ev) events.push(ev);
      }
      events.sort((a, b) => a.startAt.localeCompare(b.startAt));
      const headers: Record<string, string> = {};
      if (legacyTruncated) headers["X-Calendar-Partial-Data"] = "true";
      return NextResponse.json(
        { events, ...(legacyTruncated ? { legacyTruncated: true as const } : {}) },
        { headers },
      );
    }

    const expSnap = await db.collection("experiences").doc(experienceId).get();
    const experienceSlug = expSnap.exists && typeof (expSnap.data() as { slug?: string })?.slug === "string"
      ? (expSnap.data() as { slug: string }).slug.trim()
      : "";
    const variantIds = getExperienceIdVariants(experienceId, experienceSlug);

    const bookingDocs = await loadExperienceBookingDocs(db, variantIds, fromStr, toStr);

    const legacyScanLimitExp = getLegacyBookingScanLimit();
    let legacyTruncatedExp = false;
    const legacyFallbackEnabled = process.env.DISABLE_LEGACY_BOOKING_FALLBACK !== "true";
    if (legacyFallbackEnabled && variantIds.length > 0) {
      const seenBookingIds = new Set(bookingDocs.map((d) => d.id));
      try {
        const legacySnaps = await Promise.all(
          variantIds.map((variantId) =>
            db
              .collection("bookings")
              .where("experienceId", "==", variantId)
              .where("createdAt", ">=", Timestamp.fromDate(startThreshold))
              .orderBy("createdAt", "desc")
              .limit(legacyScanLimitExp)
              .get()
          )
        );
        for (const snap of legacySnaps) {
          if (snap.size >= legacyScanLimitExp) legacyTruncatedExp = true;
          for (const doc of snap.docs) {
            if (seenBookingIds.has(doc.id)) continue;
            const d = doc.data() as { startDateStr?: string; slotId?: string };
            if (d.startDateStr) continue;
            const parsed = parseSlotIdRelaxed(d.slotId ?? "");
            const dateStr = parsed?.dateStr ?? null;
            if (!dateStr || dateStr < fromStr || dateStr > toStr) continue;
            seenBookingIds.add(doc.id);
            bookingDocs.push(doc);
          }
        }
      } catch (legacyErr) {
        if (!isMissingIndexError(legacyErr)) throw legacyErr;
        console.warn("[admin/calendar-events] legacy booking scan index missing — skipped");
      }
    }

    const blocksDocs = await loadExperienceBlockDocs(db, variantIds, rangeStart, rangeEnd, Timestamp);

    const experienceIds = new Set<string>();
    bookingDocs.forEach((d) => {
      const b = d.data() as Booking;
      if (b.experienceId) experienceIds.add(b.experienceId);
    });
    const experienceNames = new Map<string, string>();
    await Promise.all(
      Array.from(experienceIds).map(async (id) => {
        const snap = await db.collection("experiences").doc(id).get();
        if (snap.exists) experienceNames.set(id, (snap.data() as { title?: string }).title ?? id);
      })
    );

    const boatIds = new Set<string>();
    bookingDocs.forEach((d) => {
      const b = d.data() as Booking;
      if (b.boatId) boatIds.add(b.boatId);
    });
    blocksDocs.forEach((d) => {
      const b = d.data() as { boatId?: string | null };
      if (b.boatId) boatIds.add(b.boatId);
    });
    const boatNames = new Map<string, string>();
    await Promise.all(
      Array.from(boatIds).map(async (id) => {
        const snap = await db.collection("boats").doc(id).get();
        if (snap.exists) boatNames.set(id, (snap.data() as { name?: string }).name ?? id);
      })
    );

    const events: CalendarEvent[] = [];
    const opts = { boatIdParam, statusParam };

    bookingDocs.forEach((doc) => {
      const b = doc.data() as Booking & { startDateStr?: string };
      const ev = buildBookingCalendarEvent(doc, b, boatNames, experienceNames, opts);
      if (ev) events.push(ev);
    });

    blocksDocs.forEach((doc) => {
      const b = doc.data() as { boatId?: string | null; startAt: { toDate(): Date }; endAt: { toDate(): Date }; note?: string | null };
      const startAt = b.startAt?.toDate?.();
      const endAt = b.endAt?.toDate?.();
      if (!startAt || !endAt) return;
      if (endAt.getTime() < rangeStart.getTime()) return;
      if (boatIdParam && b.boatId !== boatIdParam) return;
      events.push({
        id: `block-${doc.id}`,
        type: "block",
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        boatId: b.boatId ?? null,
        boatName: b.boatId ? (boatNames.get(b.boatId) ?? null) : null,
        title: b.note?.trim() || "Blocked",
        note: b.note ?? null,
        blockId: doc.id,
      });
    });

    events.sort((a, b) => a.startAt.localeCompare(b.startAt));
    const headersExp: Record<string, string> = {};
    if (legacyTruncatedExp) headersExp["X-Calendar-Partial-Data"] = "true";
    return NextResponse.json(
      { events, ...(legacyTruncatedExp ? { legacyTruncated: true as const } : {}) },
      { headers: headersExp },
    );
  } catch (err) {
    console.error("[admin/calendar-events]", err);
    return NextResponse.json({ error: "Failed to load calendar events" }, { status: 500 });
  }
}
