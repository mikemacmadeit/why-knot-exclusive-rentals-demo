import type { Metadata } from "next";

/** True when this deployment should not appear in search (sales demo / preview). */
export function shouldBlockSearchIndexing(): boolean {
  const raw =
    process.env.BLOCK_SEARCH_INDEXING?.trim() ||
    process.env.DEMO_PITCH_SITE?.trim() ||
    "";
  const v = raw.toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export const NO_INDEX_ROBOTS: NonNullable<Metadata["robots"]> = {
  index: false,
  follow: false,
  googleBot: { index: false, follow: false },
};

export function publicRobotsMetadata(): Metadata["robots"] {
  return shouldBlockSearchIndexing() ? NO_INDEX_ROBOTS : { index: true, follow: true };
}

export const X_ROBOTS_NOINDEX = "noindex, nofollow, noarchive";
