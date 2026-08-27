/**
 * Update Netlify env for Slipstack tahoe-wakebusters site → twb-demo-2026.
 * Uses active Netlify CLI user token (team@slipstack.io).
 * Usage: node scripts/set-twb-netlify-env.mjs
 */
import fs from "fs";
import path from "path";
import os from "os";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const SITE_ID = process.env.NETLIFY_SITE_ID || "cb7ccf26-b2fa-4168-aa0c-e9e8eafb284b";
const sa = require(path.join(ROOT, ".secrets", "twb-demo-2026-sa.json"));

function loadNetlifyToken() {
  const configPath = path.join(os.homedir(), "AppData", "Roaming", "netlify", "Config", "config.json");
  const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const active = cfg.userId && cfg.users?.[cfg.userId];
  const token = active?.auth?.token || Object.values(cfg.users || {}).find((u) => u?.auth?.token)?.auth?.token;
  if (!token) throw new Error("No Netlify token in CLI config");
  return { token, email: active?.email || "?" };
}

async function api(method, urlPath, body) {
  const { token } = loadNetlifyToken();
  const res = await fetch(`https://api.netlify.com/api/v1${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${urlPath} ${res.status}: ${text.slice(0, 400)}`);
  }
  return text ? JSON.parse(text) : null;
}

const SITE_URL = "https://tahoe-wakebusters.netlify.app";

const WEB = {
  FIREBASE_PROJECT_ID: "twb-demo-2026",
  FIREBASE_CLIENT_EMAIL: sa.client_email,
  FIREBASE_PRIVATE_KEY: sa.private_key.includes("\\n")
    ? sa.private_key
    : sa.private_key.replace(/\n/g, "\\n"),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "twb-demo-2026",
  NEXT_PUBLIC_FIREBASE_API_KEY: "AIzaSyAkd5Jhiir6MuFYiNJd65ELFF_IkONh5As",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "twb-demo-2026.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "twb-demo-2026.firebasestorage.app",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "385993027589",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:385993027589:web:4e71aaf47e300030a5ac6c",
  ADMIN_EMAIL: "usalandspecialist@gmail.com,tahoewakebusters@gmail.com",
  CONTACT_EMAIL: "tahoewakebusters@gmail.com",
  APP_BASE_URL: SITE_URL,
  NEXT_PUBLIC_SITE_URL: SITE_URL,
  // Satisfy production GA gate; replace with real stream later if needed
  NEXT_PUBLIC_GA_MEASUREMENT_ID: "G-DEMO000000",
};

const contexts = ["production", "deploy-preview", "branch-deploy", "dev"];

async function main() {
  const { email } = loadNetlifyToken();
  const site = await api("GET", `/sites/${SITE_ID}`);
  const account_id = site.account_id;
  console.log("user", email);
  console.log("site", site.name, "account", account_id, site.ssl_url);

  for (const [key, value] of Object.entries(WEB)) {
    const isSecret = key === "FIREBASE_PRIVATE_KEY";
    const payload = {
      key,
      scopes: ["builds", "functions", "runtime", "post-processing"],
      values: contexts.map((context) => ({ context, value })),
      is_secret: isSecret,
    };
    try {
      await api("PUT", `/accounts/${account_id}/env/${encodeURIComponent(key)}?site_id=${SITE_ID}`, payload);
      console.log("updated", key);
    } catch (e) {
      console.warn("PUT failed", key, String(e.message).slice(0, 120));
      await api("POST", `/accounts/${account_id}/env?site_id=${SITE_ID}`, [payload]);
      console.log("created", key);
    }
  }
  console.log("DONE");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
