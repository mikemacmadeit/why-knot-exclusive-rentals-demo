/**
 * Create missing Firestore composite indexes used by admin calendar on twb-demo-2026.
 * Usage: node scripts/create-twb-calendar-indexes.mjs
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

const NEEDED = [
  {
    collectionGroup: "bookings",
    fields: [
      { fieldPath: "experienceId", order: "ASCENDING" },
      { fieldPath: "startDateStr", order: "ASCENDING" },
      { fieldPath: "__name__", order: "ASCENDING" },
    ],
  },
  {
    collectionGroup: "bookings",
    fields: [
      { fieldPath: "experienceId", order: "ASCENDING" },
      { fieldPath: "status", order: "ASCENDING" },
      { fieldPath: "startDateStr", order: "ASCENDING" },
      { fieldPath: "__name__", order: "ASCENDING" },
    ],
  },
  {
    collectionGroup: "blocks",
    fields: [
      { fieldPath: "experienceId", order: "ASCENDING" },
      { fieldPath: "endAt", order: "ASCENDING" },
      { fieldPath: "startAt", order: "ASCENDING" },
      { fieldPath: "__name__", order: "ASCENDING" },
    ],
  },
];

function fieldsMatch(idxFields, needed) {
  const fields = (idxFields ?? []).filter((f) => f.fieldPath !== "__name__");
  const want = needed.filter((f) => f.fieldPath !== "__name__");
  if (fields.length !== want.length) return false;
  return want.every((w, i) => fields[i]?.fieldPath === w.fieldPath && fields[i]?.order === w.order);
}

async function main() {
  const client = await auth.getClient();
  for (const spec of NEEDED) {
    const listUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/collectionGroups/${spec.collectionGroup}/indexes`;
    const list = await client.request({ url: listUrl, method: "GET" });
    const indexes = list.data?.indexes ?? [];
    const already = indexes.find((idx) => fieldsMatch(idx.fields, spec.fields));
    if (already) {
      console.log(spec.collectionGroup, "already:", already.state, (already.fields || []).map((f) => f.fieldPath).join("+"));
      continue;
    }
    const body = { queryScope: "COLLECTION", fields: spec.fields };
    try {
      const res = await client.request({ url: listUrl, method: "POST", data: body });
      console.log(spec.collectionGroup, "created", res.status, (spec.fields || []).map((f) => f.fieldPath).join("+"));
    } catch (e) {
      console.error(spec.collectionGroup, "create failed", e.response?.data || e.message);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
