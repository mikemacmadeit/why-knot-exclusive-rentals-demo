/**
 * On pitch demo deploys, strip Netlify `schedule()` so booking crons are not registered.
 * Runtime skip in the handlers is a backup; this is what stops the 2-minute invocations.
 *
 * Only runs on Netlify (`NETLIFY=true`) so local `npm run build` does not rewrite git files.
 */
import fs from "fs";
import path from "path";

function envFlagTruthy(raw) {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

const onNetlify = String(process.env.NETLIFY ?? "").trim().toLowerCase() === "true";
const pitch = envFlagTruthy(process.env.DEMO_PITCH_SITE);

if (!onNetlify || !pitch) {
  process.exit(0);
}

const dir = path.join(process.cwd(), "netlify", "functions");
const stub = `/** Pitch demo: booking crons disabled (DEMO_PITCH_SITE). Generated at Netlify build. */
export const handler = async () => ({
  statusCode: 200,
  body: JSON.stringify({ skipped: true, reason: "DEMO_PITCH_SITE" }),
});
`;

const names = [
  "warm-booking.mts",
  "cleanup-holds.mts",
  "process-confirmation-outbox.mts",
  "reconcile-rollback-pending-holds.mts",
  "reconcile-pending-pi-metadata-cron.mts",
  "process-pending-refunds-cron.mts",
  "run-final-charges.mts",
  "booking-reminder-cron.mts",
  "final-payment-reminder-cron.mts",
  "reconcile-departure-inventory.mts",
  "waiver-reminder-cron.mts",
];

for (const name of names) {
  const file = path.join(dir, name);
  if (!fs.existsSync(file)) {
    console.warn(`[disable-pitch-scheduled-functions] missing ${name}`);
    continue;
  }
  fs.writeFileSync(file, stub, "utf8");
  console.log(`[disable-pitch-scheduled-functions] unscheduled ${name}`);
}
