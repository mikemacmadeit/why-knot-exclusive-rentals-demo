/**
 * Enable Netlify visitor password on tahoe-wakebusters (Slipstack team).
 * Usage: node scripts/set-demo-site-password.mjs
 */
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";

const SITE_ID = "cb7ccf26-b2fa-4168-aa0c-e9e8eafb284b";
const SITE_URL = "https://tahoe-wakebusters.netlify.app";

const cfg = JSON.parse(
  fs.readFileSync(path.join(os.homedir(), "AppData", "Roaming", "netlify", "Config", "config.json"), "utf8")
);
const token = cfg.users[cfg.userId].auth.token;
const password = `WakeBusters-Demo-${crypto.randomBytes(4).toString("hex")}!`;

const res = await fetch(`https://api.netlify.com/api/v1/sites/${SITE_ID}`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ password, sso_login: false }),
});
const text = await res.text();
if (!res.ok) {
  console.error("PATCH failed", res.status, text.slice(0, 400));
  process.exit(1);
}
const site = JSON.parse(text);
console.log("password enabled:", Boolean(site.password));

const outDir = path.join(process.cwd(), ".tmp-verify");
fs.mkdirSync(outDir, { recursive: true });
const accessPath = path.join(outDir, "twb-demo-access.txt");
const block = [
  "Tahoe Wakebusters demo — visitor access",
  `URL: ${SITE_URL}`,
  `Site password: ${password}`,
  "",
  "Share the URL and password together. Without both, the site is not reachable.",
  "Search engines are blocked (noindex + robots disallow).",
  "",
].join("\n");
fs.writeFileSync(accessPath, block);
console.log("Wrote", accessPath);
