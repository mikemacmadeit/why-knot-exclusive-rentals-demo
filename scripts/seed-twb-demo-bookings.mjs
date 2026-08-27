/**
 * Seed ~2 months of demo bookings + marketplace sync events on twb-demo-2026.
 * Usage: node scripts/seed-twb-demo-bookings.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { fromZonedTime } from "date-fns-tz";

const require = createRequire(import.meta.url);
const admin = require("firebase-admin");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TZ = "America/Los_Angeles";
const sa = JSON.parse(fs.readFileSync(path.join(ROOT, ".secrets", "twb-demo-2026-sa.json"), "utf8"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(sa),
    projectId: "twb-demo-2026",
  });
}

const db = admin.firestore();
const { Timestamp } = admin.firestore;

const GUESTS = [
  ["Alex Rivera", "alex.rivera@example.com", "+15305550101"],
  ["Jordan Lee", "jordan.lee@example.com", "+15305550102"],
  ["Sam Patel", "sam.patel@example.com", "+15305550103"],
  ["Casey Ng", "casey.ng@example.com", "+15305550104"],
  ["Riley Brooks", "riley.brooks@example.com", "+15305550105"],
  ["Morgan Diaz", "morgan.diaz@example.com", "+15305550106"],
  ["Taylor Quinn", "taylor.quinn@example.com", "+15305550107"],
  ["Jamie Ortiz", "jamie.ortiz@example.com", "+15305550108"],
  ["Avery Chen", "avery.chen@example.com", "+15305550109"],
  ["Cameron Blake", "cameron.blake@example.com", "+15305550110"],
  ["Drew Santos", "drew.santos@example.com", "+15305550111"],
  ["Harper Mills", "harper.mills@example.com", "+15305550112"],
  ["Reese Torres", "reese.torres@example.com", "+15305550113"],
  ["Skyler Nash", "skyler.nash@example.com", "+15305550114"],
  ["Parker Kim", "parker.kim@example.com", "+15305550115"],
  ["Quinn Alvarez", "quinn.alvarez@example.com", "+15305550116"],
  ["Blake Foster", "blake.foster@example.com", "+15305550117"],
  ["Logan Pierce", "logan.pierce@example.com", "+15305550118"],
  ["Emerson Day", "emerson.day@example.com", "+15305550119"],
  ["Finley Cruz", "finley.cruz@example.com", "+15305550120"],
];

const SOURCES = [
  { source: "website", weight: 4 },
  { source: "boatsetter", weight: 3 },
  { source: "getmyboat", weight: 2 },
  { source: "viator", weight: 1 },
  { source: "admin", weight: 1 },
];

function ymdInTz(d) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function addDaysYmd(ymd, days) {
  const [y, m, d] = ymd.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

function weekdayOf(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 Sun
}

function pickWeighted(list, i) {
  const total = list.reduce((s, x) => s + x.weight, 0);
  let n = i % total;
  for (const item of list) {
    n -= item.weight;
    if (n < 0) return item;
  }
  return list[0];
}

function buildSlotId(dateStr, startHour, durationHours) {
  return `${dateStr}-${startHour}-${durationHours}`;
}

function slotBounds(dateStr, startHour, durationHours) {
  const startLocal = `${dateStr}T${String(startHour).padStart(2, "0")}:00:00`;
  const start = fromZonedTime(startLocal, TZ);
  const end = new Date(start.getTime() + durationHours * 3600 * 1000);
  return { start, end };
}

function moneyFor(expSlug, hours, i) {
  if (expSlug === "watersports") {
    if (hours <= 2) return 80_000 + (i % 3) * 5_000;
    if (hours <= 4) return 150_000 + (i % 4) * 10_000;
    return 250_000 + (i % 3) * 15_000;
  }
  // party barge / pontoon
  if (hours <= 4) return 170_000 + (i % 4) * 10_000;
  return 280_000 + (i % 3) * 20_000;
}

async function deleteByPrefix(collection, prefix) {
  const snap = await db.collection(collection).get();
  const batchSize = 400;
  let n = 0;
  let batch = db.batch();
  for (const doc of snap.docs) {
    if (!doc.id.startsWith(prefix)) continue;
    batch.delete(doc.ref);
    n++;
    if (n % batchSize === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  if (n % batchSize !== 0) await batch.commit();
  return n;
}

async function main() {
  const expSnap = await db.collection("experiences").where("active", "==", true).get();
  const experiences = expSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() || {}) }))
    .filter((e) => e.slug === "pontoon" || e.slug === "watersports");
  if (experiences.length === 0) {
    throw new Error("No active pontoon/watersports experiences found. Seed experiences first.");
  }

  console.log("Cleaning prior demo seed…");
  const deletedBookings = await deleteByPrefix("bookings", "mock-twb-");
  const deletedEvents = await deleteByPrefix("marketplaceEvents", "mock-twb-evt-");
  console.log(`Deleted ${deletedBookings} bookings, ${deletedEvents} marketplace events`);

  // Listing maps so Integrations UI shows mapped providers
  const maps = [];
  for (const exp of experiences) {
    const listingName =
      exp.slug === "watersports" ? "Mastercraft NXT Wakesurf Charter" : "30' Double Decker Party Barge";
    for (const provider of ["boatsetter", "getmyboat", "viator"]) {
      maps.push({
        provider,
        matchType: "listing_name",
        matchValue: listingName,
        experienceId: exp.id,
        experienceSlug: exp.slug,
        durationHours: exp.slug === "watersports" ? 4 : 5,
        autoMapped: true,
        updatedAt: Timestamp.now(),
      });
    }
  }
  for (const m of maps) {
    const id = `${m.provider}_${m.matchType}_${m.matchValue}`.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 120);
    await db.collection("marketplaceListingMaps").doc(id).set(m, { merge: true });
  }
  console.log("Upserted marketplace listing maps:", maps.length);

  const today = ymdInTz(new Date());
  const startDay = addDaysYmd(today, -21); // ~3 weeks back
  const endDay = addDaysYmd(today, 45); // ~1.5 months ahead

  /** @type {Array<{date:string, hour:number, hours:number, exp:any, source:string, guest:string[], i:number}>} */
  const plan = [];
  let i = 0;
  for (let d = startDay; d <= endDay; d = addDaysYmd(d, 1)) {
    const wd = weekdayOf(d);
    const weekend = wd === 0 || wd === 5 || wd === 6;
    // denser on weekends
    const count = weekend ? 2 + (i % 2) : i % 3 === 0 ? 1 : 0;
    for (let k = 0; k < count; k++) {
      const exp = experiences[(i + k) % experiences.length];
      const source = pickWeighted(SOURCES, i + k).source;
      const hours =
        exp.slug === "watersports"
          ? [2, 4, 8][(i + k) % 3]
          : [4, 5, 8][(i + k) % 3];
      const hour = weekend ? (k === 0 ? 9 : 14) : 10 + ((i + k) % 3) * 2;
      plan.push({
        date: d,
        hour,
        hours,
        exp,
        source,
        guest: GUESTS[(i + k) % GUESTS.length],
        i: i + k,
      });
    }
    i++;
  }

  console.log(`Seeding ${plan.length} bookings from ${startDay} → ${endDay}…`);

  let bookingWrites = 0;
  let eventWrites = 0;
  let batch = db.batch();
  let ops = 0;

  const flush = async () => {
    if (ops === 0) return;
    await batch.commit();
    batch = db.batch();
    ops = 0;
  };

  for (const row of plan) {
    const [name, email, phone] = row.guest;
    const slotId = buildSlotId(row.date, row.hour, row.hours);
    const { start, end } = slotBounds(row.date, row.hour, row.hours);
    const totalCents = moneyFor(row.exp.slug, row.hours, row.i);
    const depositCents = Math.round(totalCents * 0.5);
    const partySize =
      row.exp.slug === "watersports" ? 4 + (row.i % 5) : 8 + (row.i % 6);
    const marketplace = ["boatsetter", "getmyboat", "viator"].includes(row.source);
    const externalBookingId = marketplace ? `${row.source.toUpperCase()}-${row.date.replace(/-/g, "")}-${1000 + row.i}` : undefined;
    const externalKey = marketplace ? `${row.source}:${externalBookingId.toLowerCase()}` : undefined;
    const listingName =
      row.exp.slug === "watersports" ? "Mastercraft NXT Wakesurf Charter" : "30' Double Decker Party Barge";

    const past = row.date < today;
    // Dashboard / calendar only count slot-taken statuses (not "confirmed").
    const status = past
      ? row.i % 11 === 0
        ? "canceled"
        : "final_paid"
      : row.i % 5 === 0
        ? "paid"
        : "final_due";
    const remainingForStatus =
      status === "final_paid" || status === "paid" ? 0 : Math.max(0, totalCents - depositCents);

    const bookingId = `mock-twb-${row.date}-${String(row.hour).padStart(2, "0")}-${row.i}`;
    const createdOffsetDays = Math.min(14, Math.max(1, Math.floor((Date.parse(row.date) - Date.parse(today)) / 86400000) * -1 + 3));
    const createdAtDate = new Date(Date.now() - createdOffsetDays * 86400000 - (row.i % 12) * 3600000);
    const summaryMonthKey = `revenue_${createdAtDate.getFullYear()}_${String(createdAtDate.getMonth() + 1).padStart(2, "0")}`;

    const bookingDoc = {
      status,
      experienceId: row.exp.id,
      experienceTitle: row.exp.title || listingName,
      bookingMode: "charter",
      slotId,
      startDateStr: row.date,
      startAt: Timestamp.fromDate(start),
      endAt: Timestamp.fromDate(end),
      timezone: TZ,
      partySize,
      customer: { name, email, phone },
      customerName: name,
      customerEmail: email,
      customerPhone: phone,
      pricing: {
        subtotalCents: totalCents,
        taxCents: 0,
        feesCents: 0,
        totalCents,
        currency: "usd",
        depositCents,
        remainingCents: remainingForStatus,
      },
      totalCents,
      depositCents,
      remainingCents: remainingForStatus,
      stripe: {
        totalAmountCents: totalCents,
        depositAmountCents: depositCents,
        currency: "usd",
        mode: "demo_seed",
      },
      source: row.source === "admin" ? "admin" : row.source,
      specialNotes:
        row.source === "admin"
          ? "Phone booking — demo seed"
          : marketplace
            ? `Imported from ${row.source} — demo seed`
            : "Online booking — demo seed",
      summaryCountersApplied: status !== "canceled",
      summaryMonthKey,
      createdAt: Timestamp.fromDate(createdAtDate),
      updatedAt: Timestamp.now(),
      demoSeed: true,
    };

    if (marketplace && status !== "canceled") {
      bookingDoc.externalProvider = row.source;
      bookingDoc.externalBookingId = externalBookingId;
      bookingDoc.externalKey = externalKey;
      bookingDoc.externalListingName = listingName;
      bookingDoc.marketplaceDetails = {
        "Owner payout": `$${(totalCents / 100).toFixed(2)}`,
        Guests: String(partySize),
        Duration: `${row.hours} hours`,
        Listing: listingName,
      };
      bookingDoc.marketplaceEmailExcerpt = `${name} booked ${listingName} on ${row.date} via ${row.source}.`;
    }

    batch.set(db.collection("bookings").doc(bookingId), bookingDoc, { merge: true });
    bookingWrites++;
    ops++;

    if (marketplace) {
      const eventId = `mock-twb-evt-${row.i}`;
      const eventStatus =
        status === "canceled" ? "success" : row.i % 17 === 0 ? "needs_review" : row.i % 23 === 0 ? "unmapped" : "success";
      batch.set(
        db.collection("marketplaceEvents").doc(eventId),
        {
          provider: row.source,
          eventType: status === "canceled" ? "booking_cancelled" : "booking_created",
          externalBookingId,
          gmailMessageId: `demo-msg-${row.i}`,
          threadId: `demo-thread-${row.i}`,
          status: eventStatus,
          detail:
            eventStatus === "needs_review"
              ? "Ambiguous listing match — demo"
              : eventStatus === "unmapped"
                ? "No listing map matched — demo"
                : status === "canceled"
                  ? "Cancelled booking synced — demo"
                  : "Booking created from marketplace email — demo",
          bookingId: eventStatus === "success" ? bookingId : eventStatus === "unmapped" ? undefined : bookingId,
          listingName,
          subject: `${row.source === "boatsetter" ? "Boatsetter" : row.source === "getmyboat" ? "Getmyboat" : "Viator"} booking confirmation — ${name}`,
          customerName: name,
          startAt: start.toISOString(),
          endAt: end.toISOString(),
          durationHours: row.hours,
          passengerCount: partySize,
          totalCents,
          details: bookingDoc.marketplaceDetails,
          emailExcerpt: bookingDoc.marketplaceEmailExcerpt,
          createdAt: Timestamp.fromDate(createdAtDate),
          updatedAt: Timestamp.now(),
          demoSeed: true,
        },
        { merge: true }
      );
      eventWrites++;
      ops++;
    }

    if (ops >= 400) await flush();
  }

  // A few extra standalone marketplace inbox rows (parse failures) for UI color
  for (let n = 0; n < 4; n++) {
    batch.set(
      db.collection("marketplaceEvents").doc(`mock-twb-evt-orphan-${n}`),
      {
        provider: ["boatsetter", "getmyboat", "viator"][n % 3],
        eventType: "booking_created",
        externalBookingId: `ORPHAN-${n}`,
        gmailMessageId: `demo-orphan-${n}`,
        status: n % 2 === 0 ? "parse_failed" : "ignored",
        detail: n % 2 === 0 ? "Could not parse trip times — demo" : "Informational payout email — demo",
        subject: n % 2 === 0 ? "Booking update (incomplete)" : "Weekly earnings summary",
        createdAt: Timestamp.fromDate(new Date(Date.now() - (n + 1) * 86400000)),
        demoSeed: true,
      },
      { merge: true }
    );
    eventWrites++;
    ops++;
  }

  await flush();

  // Dashboard revenue comes from summaries/*, not raw booking totals.
  const active = plan.filter((r) => {
    const past = r.date < today;
    const status = past ? (r.i % 11 === 0 ? "canceled" : "final_paid") : r.i % 5 === 0 ? "paid" : "final_due";
    return status !== "canceled";
  });
  let totalRevenueCents = 0;
  const byMonth = new Map();
  for (const row of active) {
    const cents = moneyFor(row.exp.slug, row.hours, row.i);
    totalRevenueCents += cents;
    const createdOffsetDays = Math.min(14, Math.max(1, Math.floor((Date.parse(row.date) - Date.parse(today)) / 86400000) * -1 + 3));
    const createdAtDate = new Date(Date.now() - createdOffsetDays * 86400000 - (row.i % 12) * 3600000);
    const key = `revenue_${createdAtDate.getFullYear()}_${String(createdAtDate.getMonth() + 1).padStart(2, "0")}`;
    const cur = byMonth.get(key) ?? { revenueCents: 0, bookingCount: 0 };
    cur.revenueCents += cents;
    cur.bookingCount += 1;
    byMonth.set(key, cur);
  }
  await db.collection("summaries").doc("revenue").set(
    { totalRevenueCents, bookingCount: active.length, demoSeed: true, updatedAt: Timestamp.now() },
    { merge: true }
  );
  for (const [key, row] of byMonth.entries()) {
    await db.collection("summaries").doc(key).set(
      { revenueCents: row.revenueCents, bookingCount: row.bookingCount, demoSeed: true, updatedAt: Timestamp.now() },
      { merge: true }
    );
  }

  console.log("Done.");
  console.log(`  bookings: ${bookingWrites}`);
  console.log(`  marketplace events: ${eventWrites}`);
  console.log(`  range: ${startDay} → ${endDay}`);
  console.log(`  revenue: $${(totalRevenueCents / 100).toFixed(0)} across ${active.length} active bookings`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
