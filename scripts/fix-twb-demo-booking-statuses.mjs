/**
 * Fix Wakebusters demo seed: statuses must be slot-taken (final_due/final_paid/paid)
 * and dashboard revenue comes from summaries/*, not booking docs alone.
 *
 * Usage: node scripts/fix-twb-demo-booking-statuses.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

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

function ymdInTz(d) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function monthKeyFromYmd(ymd) {
  const [y, m] = ymd.split("-");
  return `revenue_${y}_${m}`;
}

async function main() {
  const today = ymdInTz(new Date());
  const snap = await db.collection("bookings").where("demoSeed", "==", true).get();
  console.log(`Patching ${snap.size} demo bookings…`);

  /** @type {Map<string, { revenueCents: number; bookingCount: number }>} */
  const byMonth = new Map();
  let totalRevenueCents = 0;
  let bookingCount = 0;
  let batch = db.batch();
  let ops = 0;

  const flush = async () => {
    if (!ops) return;
    await batch.commit();
    batch = db.batch();
    ops = 0;
  };

  for (const doc of snap.docs) {
    const b = doc.data();
    const dateStr = typeof b.startDateStr === "string" ? b.startDateStr : "";
    const totalCents =
      typeof b.pricing?.totalCents === "number"
        ? b.pricing.totalCents
        : typeof b.totalCents === "number"
          ? b.totalCents
          : 0;
    const depositCents =
      typeof b.pricing?.depositCents === "number"
        ? b.pricing.depositCents
        : Math.round(totalCents * 0.5);
    const remainingCents = Math.max(0, totalCents - depositCents);

    const past = dateStr && dateStr < today;
    const wasCanceled = b.status === "canceled" || b.status === "cancelled";
    // Keep ~8% canceled for realism; everything else must be a slot-taken status.
    let status;
    if (wasCanceled || (doc.id.endsWith("-0") && dateStr.endsWith("5"))) {
      status = "canceled";
    } else if (past) {
      status = "final_paid";
    } else if (dateStr <= today) {
      status = "final_due";
    } else {
      // upcoming: mostly deposit collected (final_due), some fully paid
      status = ops % 5 === 0 ? "paid" : "final_due";
    }

    const patch = {
      status,
      pricing: {
        subtotalCents: totalCents,
        taxCents: 0,
        feesCents: 0,
        totalCents,
        currency: "usd",
        depositCents,
        remainingCents: status === "final_paid" || status === "paid" ? 0 : remainingCents,
      },
      totalCents,
      depositCents,
      remainingCents: status === "final_paid" || status === "paid" ? 0 : remainingCents,
      stripe: {
        totalAmountCents: totalCents,
        depositAmountCents: depositCents,
        currency: "usd",
        mode: "demo_seed",
      },
      summaryCountersApplied: status !== "canceled",
      summaryMonthKey: dateStr ? monthKeyFromYmd(dateStr) : undefined,
      updatedAt: Timestamp.now(),
    };

    batch.set(doc.ref, patch, { merge: true });
    ops++;

    if (status !== "canceled" && totalCents > 0) {
      // Attribute deposit month for dashboard "this month" feel: use created month if present
      const created = b.createdAt?.toDate?.() ?? new Date();
      const createdYmd = ymdInTz(created);
      const key = monthKeyFromYmd(createdYmd);
      const row = byMonth.get(key) ?? { revenueCents: 0, bookingCount: 0 };
      row.revenueCents += totalCents;
      row.bookingCount += 1;
      byMonth.set(key, row);
      totalRevenueCents += totalCents;
      bookingCount += 1;
    }

    if (ops >= 400) await flush();
  }
  await flush();

  // Reset + write dashboard summary docs
  await db.collection("summaries").doc("revenue").set(
    {
      totalRevenueCents,
      bookingCount,
      demoSeed: true,
      updatedAt: Timestamp.now(),
    },
    { merge: true }
  );

  for (const [key, row] of byMonth.entries()) {
    await db.collection("summaries").doc(key).set(
      {
        revenueCents: row.revenueCents,
        bookingCount: row.bookingCount,
        demoSeed: true,
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );
  }

  // Also attribute experience-level summaries lightly
  const byExp = new Map();
  for (const doc of snap.docs) {
    const b = doc.data();
    if (b.status === "canceled") continue;
    const expId = b.experienceId;
    if (!expId) continue;
    const cents = b.pricing?.totalCents ?? b.totalCents ?? 0;
    const cur = byExp.get(expId) ?? { revenueCents: 0, bookingCount: 0 };
    cur.revenueCents += cents;
    cur.bookingCount += 1;
    byExp.set(expId, cur);
  }
  // Recompute with patched statuses from our loop via byMonth totals only — experience summaries:
  // re-read after patch
  const after = await db.collection("bookings").where("demoSeed", "==", true).get();
  const expAgg = new Map();
  let statusCounts = {};
  for (const doc of after.docs) {
    const b = doc.data();
    statusCounts[b.status] = (statusCounts[b.status] || 0) + 1;
    if (b.status === "canceled") continue;
    const expId = b.experienceId;
    if (!expId) continue;
    const cents = b.pricing?.totalCents ?? 0;
    const cur = expAgg.get(expId) ?? { revenueCents: 0, bookingCount: 0 };
    cur.revenueCents += cents;
    cur.bookingCount += 1;
    expAgg.set(expId, cur);
  }
  for (const [expId, row] of expAgg.entries()) {
    await db.collection("summaries").doc(`experience_${expId}`).set(
      {
        revenueCents: row.revenueCents,
        bookingCount: row.bookingCount,
        demoSeed: true,
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );
  }

  console.log("Done.");
  console.log("  statuses:", statusCounts);
  console.log("  totalRevenueCents:", totalRevenueCents);
  console.log("  bookingCount:", bookingCount);
  console.log("  month keys:", [...byMonth.keys()].sort().join(", "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
