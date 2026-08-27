/**
 * Promote tahoewakebusters@gmail.com to Super Admin on twb-demo-2026:
 * - remove conflicting adminTeam operator doc (ADMIN_EMAIL wins)
 * Usage: node scripts/promote-twb-client-super-admin.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const admin = require("firebase-admin");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sa = JSON.parse(fs.readFileSync(path.join(root, ".secrets", "twb-demo-2026-sa.json"), "utf8"));
const CLIENT = "tahoewakebusters@gmail.com";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(sa),
    projectId: "twb-demo-2026",
  });
}

const db = admin.firestore();
const ref = db.collection("adminTeam").doc(CLIENT.toLowerCase());
const snap = await ref.get();
if (snap.exists) {
  await ref.delete();
  console.log("removed adminTeam operator doc for", CLIENT);
} else {
  console.log("no adminTeam doc for", CLIENT);
}
console.log("Sign-in as Super Admin via ADMIN_EMAIL allowlist after Netlify env update.");
