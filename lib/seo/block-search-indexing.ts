import type { Metadata } from "next";
import { siteConfig } from "@/config/site";

function envFlagTruthy(raw: string | undefined): boolean {
  const v = raw?.trim().toLowerCase() ?? "";
  return v === "1" || v === "true" || v === "yes";
}

/** True when this deployment should not appear in search (sales demo / preview). */
export function shouldBlockSearchIndexing(): boolean {
  if (siteConfig.seo.blockSearchIndexing) return true;
  return (
    envFlagTruthy(process.env.BLOCK_SEARCH_INDEXING) ||
    envFlagTruthy(process.env.DEMO_PITCH_SITE)
  );
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
