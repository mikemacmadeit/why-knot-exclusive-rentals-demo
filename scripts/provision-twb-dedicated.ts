/**
 * Point env at twb-demo-2026, seed experiences, ensure logins, mock bookings.
 * Usage: node --import tsx scripts/provision-twb-dedicated.ts
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const SA_PATH = path.join(ROOT, ".secrets", "twb-demo-2026-sa.json");
const WEB = {
  projectId: "twb-demo-2026",
  apiKey: "AIzaSyAkd5Jhiir6MuFYiNJd65ELFF_IkONh5As",
  authDomain: "twb-demo-2026.firebaseapp.com",
  storageBucket: "twb-demo-2026.firebasestorage.app",
  messagingSenderId: "385993027589",
  appId: "1:385993027589:web:4e71aaf47e300030a5ac6c",
};
const SITE = "https://tahoe-wakebusters.netlify.app";
const SUPER = "usalandspecialist@gmail.com";
const CLIENT = "tahoewakebusters@gmail.com";

function installServerOnlyShim() {
  const Module = require("module");
  const shimPath = path.join(ROOT, "scripts", "shims", "server-only.js");
  fs.mkdirSync(path.dirname(shimPath), { recursive: true });
  if (!fs.existsSync(shimPath)) {
    fs.writeFileSync(shimPath, "module.exports = {};\n");
  }
  const origResolve = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, isMain, options) {
    if (request === "server-only") return shimPath;
    return origResolve.call(this, request, parent, isMain, options);
  };
}

function setEnvLocal(updates: Record<string, string>) {
  const envPath = path.join(ROOT, ".env.local");
  let raw = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  for (const [key, value] of Object.entries(updates)) {
    const escaped = value.replace(/\n/g, "\\n");
    const needsQuote = /[\s#"]/.test(escaped) || escaped.includes("=");
    const line = needsQuote ? `${key}="${escaped.replace(/"/g, '\\"')}"` : `${key}=${escaped}`;
    const re = new RegExp(`^${key}=.*$`, "m");
    if (re.test(raw)) raw = raw.replace(re, line);
    else raw = `${raw.replace(/\s*$/, "")}\n${line}\n`;
  }
  fs.writeFileSync(envPath, raw);
}

async function main() {
  if (!fs.existsSync(SA_PATH)) throw new Error(`Missing ${SA_PATH}`);
  const sa = JSON.parse(fs.readFileSync(SA_PATH, "utf8"));

  process.env.FIREBASE_PROJECT_ID = WEB.projectId;
  process.env.FIREBASE_CLIENT_EMAIL = sa.client_email;
  process.env.FIREBASE_PRIVATE_KEY = sa.private_key;
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON_PATH = SA_PATH;
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = WEB.projectId;
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = WEB.apiKey;
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = WEB.authDomain;
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = WEB.storageBucket;
  process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = WEB.messagingSenderId;
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID = WEB.appId;
  process.env.ADMIN_EMAIL = SUPER;
  process.env.APP_BASE_URL = SITE;
  process.env.NEXT_PUBLIC_SITE_URL = SITE;

  setEnvLocal({
    FIREBASE_PROJECT_ID: WEB.projectId,
    FIREBASE_CLIENT_EMAIL: sa.client_email,
    FIREBASE_PRIVATE_KEY: sa.private_key,
    FIREBASE_SERVICE_ACCOUNT_JSON_PATH: SA_PATH.replace(/\\/g, "/"),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: WEB.projectId,
    NEXT_PUBLIC_FIREBASE_API_KEY: WEB.apiKey,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: WEB.authDomain,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: WEB.storageBucket,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: WEB.messagingSenderId,
    NEXT_PUBLIC_FIREBASE_APP_ID: WEB.appId,
    ADMIN_EMAIL: SUPER,
    APP_BASE_URL: SITE,
    NEXT_PUBLIC_SITE_URL: SITE,
    CONTACT_EMAIL: CLIENT,
  });

  installServerOnlyShim();

  const { runSeedExperiences } = await import("../lib/booking/seed-experiences");
  const seed = await runSeedExperiences();
  if (!seed.ok) throw new Error(seed.error);
  console.log("Seeded experiences:", seed.experienceIds.length, seed.experienceIds);

  const admin = require("firebase-admin") as typeof import("firebase-admin");
  const auth = admin.auth();
  const db = admin.firestore();

  async function ensure(email: string, name: string) {
    const password = crypto.randomBytes(12).toString("base64url") + "Aa1!";
    try {
      const u = await auth.getUserByEmail(email);
      await auth.updateUser(u.uid, { password, emailVerified: true, displayName: name });
      return { uid: u.uid, created: false, password };
    } catch (e: unknown) {
      const code = e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
      if (code !== "auth/user-not-found") throw e;
      const u = await auth.createUser({
        email,
        password,
        displayName: name,
        emailVerified: true,
      });
      return { uid: u.uid, created: true, password };
    }
  }

  const s = await ensure(SUPER, "Slipstack Admin");
  const c = await ensure(CLIENT, "Tahoe Wakebusters");
  const now = admin.firestore.Timestamp.now();
  await db.collection("adminTeam").doc(CLIENT.toLowerCase()).set(
    {
      email: CLIENT.toLowerCase(),
      name: "Tahoe Wakebusters",
      role: "operator",
      status: "active",
      invitedBy: SUPER.toLowerCase(),
      invitedAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  const expSnap = await db.collection("experiences").where("active", "==", true).limit(3).get();
  const exps = expSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));
  let mockCount = 0;
  const guests = ["Alex Rivera", "Jordan Lee", "Sam Patel", "Casey Ng", "Riley Brooks", "Morgan Diaz"];
  for (let i = 0; i < 6; i++) {
    const exp = exps[i % Math.max(exps.length, 1)];
    if (!exp) break;
    const day = new Date();
    day.setUTCDate(day.getUTCDate() + 3 + i * 2);
    const y = day.getUTCFullYear();
    const m = String(day.getUTCMonth() + 1).padStart(2, "0");
    const d = String(day.getUTCDate()).padStart(2, "0");
    const startDateStr = `${y}-${m}-${d}`;
    const start = new Date(`${startDateStr}T17:00:00.000Z`);
    const end = new Date(start.getTime() + 4 * 3600 * 1000);
    const id = `mock-twb-${startDateStr}-${i}`;
    await db.collection("bookings").doc(id).set(
      {
        status: "confirmed",
        experienceId: exp.id,
        experienceTitle: exp.title || "Charter",
        customerName: guests[i],
        customerEmail: `guest${i + 1}@example.com`,
        customerPhone: `+1775555010${i}`,
        startDateStr,
        startAt: admin.firestore.Timestamp.fromDate(start),
        endAt: admin.firestore.Timestamp.fromDate(end),
        guestCount: 6 + (i % 5),
        totalCents: 170000 + i * 10000,
        depositCents: 85000,
        remainingCents: 85000 + i * 10000,
        timezone: "America/Los_Angeles",
        source: "demo_seed",
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
    mockCount++;
  }
  console.log("Mock bookings:", mockCount);

  const superReset = await auth.generatePasswordResetLink(SUPER, { url: `${SITE}/admin/login` });
  const clientReset = await auth.generatePasswordResetLink(CLIENT, { url: `${SITE}/admin/login` });

  const out = [
    "Tahoe Wakebusters — dedicated customer Firebase",
    `Project: ${WEB.projectId}`,
    `Generated: ${new Date().toISOString()}`,
    "",
    `SITE:  ${SITE}`,
    `ADMIN: ${SITE}/admin/login`,
    "",
    "YOUR SUPER ADMIN",
    `  email: ${SUPER}`,
    `  created_now: ${s.created}`,
    `  temp_password: ${s.password}`,
    `  reset: ${superReset}`,
    "",
    "CLIENT OPERATOR — give Wakebusters this login",
    `  email: ${CLIENT}`,
    "  role: operator",
    `  created_now: ${c.created}`,
    `  temp_password: ${c.password}`,
    `  reset: ${clientReset}`,
    "",
    "They log in at /admin/login with the temp password (or open the reset link).",
    "Change password after first login.",
    "Do not commit this file.",
  ].join("\n");
  fs.mkdirSync(path.join(ROOT, ".tmp-verify"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, ".tmp-verify", "twb-dedicated-credentials.txt"), out);
  console.log("Wrote .tmp-verify/twb-dedicated-credentials.txt");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
