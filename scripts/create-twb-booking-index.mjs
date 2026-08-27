/**
 * Create the bookings (status, startDateStr) composite index on twb-demo-2026.
 * Usage: node scripts/create-twb-booking-index.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { GoogleAuth } = require("google-auth-library");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sa = JSON.parse(fs.readFileSync(path.join(root, ".secrets", "twb-demo-2026-sa.json"), "utf8"));
const projectId = "twb-demo-2026";

const auth = new GoogleAuth({
  credentials: sa,
  scopes: ["https://www.googleapis.com/auth/datastore", "https://www.googleapis.com/auth/cloud-platform"],
});

const client = await auth.getClient();
const listUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/collectionGroups/bookings/indexes`;

const list = await client.request({ url: listUrl, method: "GET" });
const indexes = list.data?.indexes ?? [];
const already = indexes.find((idx) => {
  const fields = (idx.fields ?? []).filter((f) => f.fieldPath !== "__name__");
  return (
    fields.length === 2 &&
    fields[0]?.fieldPath === "status" &&
    fields[0]?.order === "ASCENDING" &&
    fields[1]?.fieldPath === "startDateStr" &&
    fields[1]?.order === "ASCENDING"
  );
});

if (already) {
  console.log("index already exists:", already.name, "state:", already.state);
  process.exit(0);
}

const body = {
  queryScope: "COLLECTION",
  fields: [
    { fieldPath: "status", order: "ASCENDING" },
    { fieldPath: "startDateStr", order: "ASCENDING" },
    { fieldPath: "__name__", order: "ASCENDING" },
  ],
};

try {
  const res = await client.request({ url: listUrl, method: "POST", data: body });
  console.log("created:", JSON.stringify(res.data, null, 2));
} catch (err) {
  const msg = err?.response?.data ?? err?.message ?? err;
  console.error("create failed:", JSON.stringify(msg, null, 2));
  process.exit(1);
}
