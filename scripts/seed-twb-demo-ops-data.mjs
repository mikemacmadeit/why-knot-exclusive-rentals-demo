/**
 * Seed client-demo ops data on twb-demo-2026:
 * - active waiver template + pending/signed requests on bookings
 * - discount codes
 * - a couple calendar blocks
 * - ensure Party Barge has an active half-day rate for public booking
 *
 * Usage: node scripts/seed-twb-demo-ops-data.mjs
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { fromZonedTime } from "date-fns-tz";

const require = createRequire(import.meta.url);
const admin = require("firebase-admin");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TZ = "America/Los_Angeles";
const APP_BASE = "https://tahoe-wakebusters.netlify.app";
const sa = JSON.parse(fs.readFileSync(path.join(ROOT, ".secrets", "twb-demo-2026-sa.json"), "utf8"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(sa),
    projectId: "twb-demo-2026",
  });
}

const db = admin.firestore();
const { Timestamp } = admin.firestore;

function tokenId() {
  return crypto.randomBytes(24).toString("base64url");
}

async function ensureRatesActive() {
  const pontoon = await db.collection("experiences").where("slug", "==", "pontoon").limit(1).get();
  if (pontoon.empty) return;
  const expRef = pontoon.docs[0].ref;
  const rates = await expRef.collection("rates").get();
  let activated = 0;
  for (const r of rates.docs) {
    const data = r.data();
    // Keep one half-day and one full-day active for booking UX
    const wantActive =
      data.durationHours === 5 ||
      data.durationHours === 8 ||
      (data.displayName || "").toLowerCase().includes("party barge");
    if (wantActive && data.active !== true) {
      await r.ref.update({ active: true, updatedAt: Timestamp.now() });
      activated++;
    }
  }
  console.log("pontoon rates activated:", activated);
}

async function ensureWaiverTemplate() {
  const existing = await db.collection("waiverTemplates").where("demoSeed", "==", true).limit(1).get();
  const now = Timestamp.now();
  const payload = {
    title: "Tahoe Wakebusters Guest Waiver",
    description: "Required for all guests before departure.",
    isActive: true,
    termsHtml:
      "<p><strong>Assumption of Risk.</strong> I acknowledge that boating, wakesurfing, and related water activities involve inherent risks including injury, drowning, and property damage.</p>" +
      "<p><strong>Release.</strong> I release Tahoe Wakebusters and its crew from liability to the fullest extent permitted by law, except for gross negligence or willful misconduct.</p>" +
      "<p><strong>Rules.</strong> I agree to follow captain instructions, wear a life jacket when required, and not bring glass or illegal substances aboard.</p>" +
      "<p>This is demo waiver copy for client review — not legal advice.</p>",
    requiredFields: { dob: true, phone: true, address: false, bookingDate: true },
    clauses: [
      {
        id: "risks",
        label: "I understand the risks of water sports and boating.",
        required: true,
      },
      {
        id: "rules",
        label: "I agree to follow all captain and marina rules.",
        required: true,
      },
      {
        id: "minors",
        label: "I confirm I am the parent/guardian for any minors in my party, or all guests are 18+.",
        required: true,
      },
    ],
    signature: { mode: "both", requireTypedName: true },
    version: 1,
    welcomeHeading: "Sign your waiver",
    welcomeSubheading: "Complete this before your Tahoe trip.",
    dobMinAge: 18,
    minorAge: 18,
    includeInConfirmationEmail: true,
    sendSeparateWaiverInvite: false,
    sendWaiverReminder: true,
    demoSeed: true,
    updatedAt: now,
  };

  if (!existing.empty) {
    const id = existing.docs[0].id;
    await existing.docs[0].ref.set(payload, { merge: true });
    console.log("waiver template updated", id);
    return id;
  }

  const ref = db.collection("waiverTemplates").doc();
  await ref.set({ ...payload, createdAt: now });
  console.log("waiver template created", ref.id);
  return ref.id;
}

async function seedWaiverRequests(templateId) {
  const tplSnap = await db.collection("waiverTemplates").doc(templateId).get();
  const tpl = tplSnap.data();
  const { createdAt: _c, updatedAt: _u, demoSeed: _d, ...templateSnapshot } = tpl;

  const existing = await db.collection("waiverRequests").where("demoSeed", "==", true).limit(1).get();
  if (!existing.empty) {
    console.log("waiver requests already seeded — skipping recreate");
    return;
  }

  const bookings = await db.collection("bookings").where("demoSeed", "==", true).get();
  const slotTaken = new Set(["paid", "final_due", "final_paid"]);
  const docs = bookings.docs
    .filter((d) => slotTaken.has(d.data().status))
    .sort((a, b) => (b.data().startDateStr || "").localeCompare(a.data().startDateStr || ""))
    .slice(0, 24);

  let pending = 0;
  let signed = 0;
  const batchSize = 400;
  let batch = db.batch();
  let ops = 0;

  const flush = async () => {
    if (ops === 0) return;
    await batch.commit();
    batch = db.batch();
    ops = 0;
  };

  for (let i = 0; i < docs.length; i++) {
    const bDoc = docs[i];
    const b = bDoc.data();
    const tid = tokenId();
    const requestRef = db.collection("waiverRequests").doc();
    const isSigned = i % 3 !== 0; // ~2/3 signed
    const createdAt = Timestamp.fromDate(new Date(Date.now() - (docs.length - i) * 36e5));
    const signingUrl = `${APP_BASE}/waiver/sign?token=${encodeURIComponent(tid)}`;

    const request = {
      bookingId: bDoc.id,
      templateId,
      templateVersion: tpl.version || 1,
      templateSnapshot,
      status: isSigned ? "signed" : "pending",
      signerName: b.customer?.name || b.customerName || "Guest",
      signerEmail: b.customer?.email || b.customerEmail || "",
      signerPhone: b.customer?.phone || b.customerPhone || "",
      signingTokenId: tid,
      signingUrl,
      sent: {
        initialSentAt: createdAt,
        lastSentAt: createdAt,
        reminder1SentAt: null,
      },
      demoSeed: true,
      createdAt,
    };

    if (isSigned) {
      const signedAt = Timestamp.fromDate(new Date(createdAt.toMillis() + 2 * 3600 * 1000));
      request.signed = {
        signedAt,
        ip: "203.0.113.10",
        userAgent: "DemoSeed/1.0",
        contentHash: crypto.createHash("sha256").update(`demo-${bDoc.id}`).digest("hex"),
        signedPayload: {
          signerName: request.signerName,
          signerEmail: request.signerEmail,
          signerPhone: request.signerPhone,
          signerDob: "1990-05-15",
          bookingDate: b.startDateStr || null,
          initials: { risks: "OK", rules: "OK", minors: "OK" },
          termsAcceptedAtIso: signedAt.toDate().toISOString(),
          termsContentHash: crypto.createHash("sha256").update(tpl.termsHtml || "").digest("hex"),
          typedName: request.signerName,
        },
      };
      signed++;
    } else {
      pending++;
    }

    batch.set(requestRef, request);
    batch.set(db.collection("waiverSigningTokens").doc(tid), {
      waiverRequestId: requestRef.id,
      bookingId: bDoc.id,
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 30 * 864e5)),
      usedAt: isSigned ? Timestamp.now() : null,
      signerEmail: request.signerEmail,
      demoSeed: true,
    });
    batch.set(
      bDoc.ref,
      {
        waiver: {
          requestId: requestRef.id,
          status: isSigned ? "signed" : "pending",
          templateId,
          templateVersion: tpl.version || 1,
          ...(isSigned ? { signedCount: 1 } : {}),
        },
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );
    ops += 3;
    if (ops >= batchSize) await flush();
  }
  await flush();
  console.log("waiver requests seeded pending=%s signed=%s", pending, signed);
}

async function ensureDiscounts() {
  const codes = [
    {
      code: "TAHOE10",
      type: "percent",
      percent: 10,
      description: "10% off — demo partner code",
      assignedTo: "Lake Tahoe Concierge",
      assignedToType: "partner",
      maxRedemptions: 50,
      usedCount: 7,
    },
    {
      code: "WAKE50",
      type: "fixed",
      valueCents: 5000,
      description: "$50 off — influencer demo",
      assignedTo: "@tahoewakesurf",
      assignedToType: "influencer",
      maxRedemptions: 25,
      usedCount: 3,
    },
    {
      code: "CREWCOMP",
      type: "percent",
      percent: 100,
      description: "Internal comps (demo)",
      assignedTo: "Ops",
      assignedToType: "internal",
      maxRedemptions: 10,
      usedCount: 1,
      active: true,
    },
  ];

  for (const c of codes) {
    const existing = await db.collection("discounts").where("code", "==", c.code).limit(1).get();
    const now = Timestamp.now();
    const doc = {
      code: c.code,
      type: c.type,
      ...(c.percent != null ? { percent: c.percent } : {}),
      ...(c.valueCents != null ? { valueCents: c.valueCents } : {}),
      maxRedemptions: c.maxRedemptions,
      usedCount: c.usedCount,
      active: c.active !== false,
      description: c.description,
      assignedTo: c.assignedTo,
      assignedToType: c.assignedToType,
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 180 * 864e5)),
      demoSeed: true,
      updatedAt: now,
    };
    if (!existing.empty) {
      await existing.docs[0].ref.set(doc, { merge: true });
      console.log("discount updated", c.code);
    } else {
      await db.collection("discounts").add({ ...doc, createdAt: now });
      console.log("discount created", c.code);
    }
  }
}

async function ensureBlocks() {
  const existing = await db.collection("blocks").where("demoSeed", "==", true).limit(1).get();
  if (!existing.empty) {
    console.log("blocks already seeded");
    return;
  }

  const pontoon = await db.collection("experiences").where("slug", "==", "pontoon").limit(1).get();
  const wake = await db.collection("experiences").where("slug", "==", "watersports").limit(1).get();
  if (pontoon.empty || wake.empty) return;

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const [y, m, d] = today.split("-").map(Number);
  const maintStart = fromZonedTime(new Date(y, m - 1, d + 10, 8, 0, 0), TZ);
  const maintEnd = fromZonedTime(new Date(y, m - 1, d + 10, 18, 0, 0), TZ);
  const privateStart = fromZonedTime(new Date(y, m - 1, d + 17, 9, 0, 0), TZ);
  const privateEnd = fromZonedTime(new Date(y, m - 1, d + 17, 13, 0, 0), TZ);

  const boats = await db.collection("boats").get();
  const barge = boats.docs.find((x) => (x.data().slug || "").includes("party") || (x.data().name || "").includes("Party"));
  const nxt = boats.docs.find((x) => (x.data().name || "").includes("NXT") || (x.data().slug || "").includes("wake"));

  await db.collection("blocks").add({
    experienceId: pontoon.docs[0].id,
    boatId: barge?.id || null,
    startAt: Timestamp.fromDate(maintStart),
    endAt: Timestamp.fromDate(maintEnd),
    note: "Maintenance (demo)",
    demoSeed: true,
    createdAt: Timestamp.now(),
    createdBy: "demo-seed",
  });
  await db.collection("blocks").add({
    experienceId: wake.docs[0].id,
    boatId: nxt?.id || null,
    startAt: Timestamp.fromDate(privateStart),
    endAt: Timestamp.fromDate(privateEnd),
    note: "Private charter hold (demo)",
    demoSeed: true,
    createdAt: Timestamp.now(),
    createdBy: "demo-seed",
  });
  console.log("blocks seeded: 2");
}

async function main() {
  await ensureRatesActive();
  const templateId = await ensureWaiverTemplate();
  await seedWaiverRequests(templateId);
  await ensureDiscounts();
  await ensureBlocks();
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
