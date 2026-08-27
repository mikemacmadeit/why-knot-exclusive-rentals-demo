/**
 * Create listing boats for Wakebusters demo and assign boatId on seeded bookings.
 * Usage: node scripts/seed-twb-demo-boats.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const admin = require("firebase-admin");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sa = JSON.parse(fs.readFileSync(path.join(ROOT, ".secrets", "twb-demo-2026-sa.json"), "utf8"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(sa),
    projectId: "twb-demo-2026",
  });
}

const db = admin.firestore();
const { Timestamp } = admin.firestore;

async function ensureBoat(spec) {
  const existing = await db.collection("boats").where("slug", "==", spec.slug).limit(1).get();
  if (!existing.empty) {
    const id = existing.docs[0].id;
    await existing.docs[0].ref.set(
      {
        ...spec,
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );
    return id;
  }
  const ref = db.collection("boats").doc();
  await ref.set({
    ...spec,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    demoSeed: true,
  });
  return ref.id;
}

async function main() {
  const expSnap = await db.collection("experiences").where("active", "==", true).get();
  const bySlug = new Map();
  for (const d of expSnap.docs) {
    const data = d.data();
    if (data.slug) bySlug.set(data.slug, { id: d.id, ...data });
  }
  const pontoon = bySlug.get("pontoon");
  const wakesurf = bySlug.get("watersports");
  if (!pontoon || !wakesurf) {
    throw new Error("Need active pontoon + watersports experiences");
  }

  const partyBargeId = await ensureBoat({
    name: "30′ Double Decker Party Barge",
    slug: "party-barge",
    description:
      "Dual waterslides, grill, water toys, and room for the whole crew. Full tank of gas included.",
    photos: [
      "/photos/wakebusters/party-barge.jpg",
      "/photos/wakebusters/hero-slides.jpg",
      "/photos/wakebusters/party-crew.jpg",
    ],
    active: true,
    isListingBoat: true,
    experienceIds: [pontoon.id],
    boatType: "pontoon",
    capacity: 13,
    heroSubtitle: "Dual slides · Grill · Up to 13 · Gas included",
    color: "#0ea5e9",
    timezone: "America/Los_Angeles",
  });

  const wakesurfBoatId = await ensureBoat({
    name: "Mastercraft NXT Wakesurf",
    slug: "wakesurf-nxt",
    description: "Clean wake, boards included, captains who know Tahoe.",
    photos: ["/photos/wakebusters/wakesurf.jpg", "/photos/wakebusters/wakesurf-2.jpg"],
    active: true,
    isListingBoat: true,
    experienceIds: [wakesurf.id],
    boatType: "wake",
    capacity: 10,
    heroSubtitle: "Wakesurf · Wakeboard · Up to 10",
    color: "#ff6b2b",
    timezone: "America/Los_Angeles",
  });

  // Optional luxury tritoon if sunset experience exists later
  console.log("boats:", { partyBargeId, wakesurfBoatId });

  // Rates (availability durations) for booking UI
  const rateSpecs = [
    { boatId: partyBargeId, durationHours: 4, displayName: "Half day (4 hrs)" },
    { boatId: partyBargeId, durationHours: 5, displayName: "5 hours" },
    { boatId: partyBargeId, durationHours: 8, displayName: "Full day (8 hrs)" },
    { boatId: wakesurfBoatId, durationHours: 2, displayName: "2 hours" },
    { boatId: wakesurfBoatId, durationHours: 4, displayName: "Half day (4 hrs)" },
    { boatId: wakesurfBoatId, durationHours: 8, displayName: "Full day (8 hrs)" },
  ];
  for (const r of rateSpecs) {
    const id = `rate-${r.durationHours}h`;
    await db
      .collection("boats")
      .doc(r.boatId)
      .collection("rates")
      .doc(id)
      .set({ durationHours: r.durationHours, displayName: r.displayName, active: true }, { merge: true });
  }

  const expToBoat = new Map([
    [pontoon.id, partyBargeId],
    [wakesurf.id, wakesurfBoatId],
  ]);

  const bookings = await db.collection("bookings").where("demoSeed", "==", true).get();
  let patched = 0;
  let batch = db.batch();
  let ops = 0;
  for (const doc of bookings.docs) {
    const b = doc.data();
    const boatId = expToBoat.get(b.experienceId);
    if (!boatId) continue;
    batch.set(
      doc.ref,
      {
        boatId,
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );
    patched++;
    ops++;
    if (ops >= 400) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }
  if (ops) await batch.commit();

  console.log(`Assigned boatId on ${patched} demo bookings`);
  console.log("Dashboard ‘missing boat ID’ alert should clear after refresh.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
