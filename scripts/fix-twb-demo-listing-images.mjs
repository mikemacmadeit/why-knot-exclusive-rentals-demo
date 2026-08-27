/**
 * Fix Wakebusters demo listing heroes/galleries to use boat photos (not founder portrait).
 * Usage: node scripts/fix-twb-demo-listing-images.mjs
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

const BY_SLUG = {
  pontoon: {
    heroMedia: { type: "image", url: "/photos/wakebusters/party-barge.jpg" },
    gallery: [
      "/photos/wakebusters/party-barge.jpg",
      "/photos/wakebusters/hero-slides.jpg",
      "/photos/wakebusters/party-crew.jpg",
      "/photos/wakebusters/wedding.jpg",
    ],
  },
  watersports: {
    heroMedia: { type: "image", url: "/photos/wakebusters/wakesurf.jpg" },
    gallery: [
      "/photos/wakebusters/wakesurf.jpg",
      "/photos/wakebusters/wakesurf-2.jpg",
      "/photos/wakebusters/gallery-2.jpg",
      "/photos/wakebusters/sunset.jpg",
    ],
  },
  sunset: {
    heroMedia: { type: "image", url: "/photos/wakebusters/sunset.jpg" },
    gallery: ["/photos/wakebusters/sunset.jpg", "/photos/wakebusters/tritoon.jpg", "/photos/wakebusters/gallery-1.jpg"],
  },
  holiday: {
    heroMedia: { type: "image", url: "/photos/wakebusters/wedding.jpg" },
    gallery: ["/photos/wakebusters/wedding.jpg", "/photos/wakebusters/party-barge.jpg", "/photos/wakebusters/hero-slides.jpg"],
  },
};

async function main() {
  const snap = await db.collection("experiences").get();
  for (const doc of snap.docs) {
    const slug = doc.data().slug;
    const fix = BY_SLUG[slug];
    if (!fix) {
      console.log("skip", doc.id, slug);
      continue;
    }
    await doc.ref.set({ ...fix, updatedAt: admin.firestore.Timestamp.now() }, { merge: true });
    console.log("fixed", slug, fix.heroMedia.url);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
