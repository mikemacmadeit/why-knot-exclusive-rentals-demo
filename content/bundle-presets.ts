/**
 * Marketing packages (Half Day / Full Day / All-In).
 *
 * Bundle IDs are checkout keys. Canonical ids are generic; legacy Nasty ids
 * still resolve in `isNsfHalfDayBundle` / `isNsfFullDayBundle` for old links.
 */

import { siteConfig } from "@/config/site";
import {
  FOUNDING_ANGLER_RATE_ACTIVE,
  formatUsdFromCents,
  getActiveCatalogRateCents,
  STANDARD_RATE_CENTS,
} from "@/content/catalog-pricing";
import { getExperienceBySlug } from "@/content/experiences";

export type BundleId = "half-day" | "full-day" | "all-in";

/** Fleet hero for package cards — aligned with /experiences listing images. */
const BUNDLE_HERO_EXPERIENCE: Record<BundleId, string> = {
  "half-day": "pontoon",
  "full-day": "watersports",
  "all-in": "sunset",
};

export function getBundleHeroImage(bundleId: BundleId): string {
  const exp = getExperienceBySlug(BUNDLE_HERO_EXPERIENCE[bundleId]);
  return exp?.heroImage ?? siteConfig.media.galleryFallback;
}

export type BundleCharterOption = {
  experienceSlug: "pontoon" | "watersports";
  durationHours: number;
  label: string;
};

export type BundlePreset = {
  id: BundleId;
  title: string;
  tagline: string;
  description: string;
  includes: string[];
  fromPriceLabel: string;
  charterOptions: BundleCharterOption[];
  defaultOptionIndex: number;
  addonCatalogKeys: string[];
  badge?: string;
  ctaLabel: string;
  recommended?: boolean;
};

const ADDON_DISPLAY_CENTS: Record<string, number> = {
  "cooler-ice": 15_00,
  "photo-package": 49_00,
};

function sumAddonDisplay(keys: string[]): number {
  return keys.reduce((sum, k) => sum + (ADDON_DISPLAY_CENTS[k] ?? 0), 0);
}

const halfCents = getActiveCatalogRateCents("half");
const fullCents = getActiveCatalogRateCents("full");

const ALL_IN_ADDONS = ["cooler-ice", "photo-package"] as const;

const allInFrom = fullCents + sumAddonDisplay([...ALL_IN_ADDONS]);

export const bundlePresets: BundlePreset[] = [
  {
    id: "half-day",
    title: siteConfig.catalog.halfDay.title,
    tagline: siteConfig.catalog.halfDay.durationLabel,
    description: "Half-day Florida Keys boat rental. Add a captain at checkout if you want one.",
    includes: [
      "Half-day private boat rental",
      "Morning or afternoon departure",
      "Be your own captain (captain optional)",
      "Standard inclusions as listed at checkout",
    ],
    fromPriceLabel: `From ${formatUsdFromCents(halfCents)}`,
    charterOptions: [
      { experienceSlug: "pontoon", durationHours: 5, label: `${siteConfig.catalog.halfDay.title} · ${siteConfig.catalog.halfDay.durationLabel}` },
    ],
    defaultOptionIndex: 0,
    addonCatalogKeys: [],
    ctaLabel: siteConfig.catalog.halfDay.ctaLabel,
  },
  {
    id: "full-day",
    title: siteConfig.catalog.fullDay.title,
    tagline: siteConfig.catalog.fullDay.durationLabel,
    description: "Full-day private fishing charter with a USCG-licensed captain.",
    includes: [
      "Full-day private fishing charter",
      "Offshore, reef, or backcountry plan",
      "Captain included",
      "Standard inclusions as listed at checkout",
    ],
    fromPriceLabel: `From ${formatUsdFromCents(fullCents)}`,
    charterOptions: [
      { experienceSlug: "watersports", durationHours: 8, label: `${siteConfig.catalog.fullDay.title} · ${siteConfig.catalog.fullDay.durationLabel}` },
    ],
    defaultOptionIndex: 0,
    addonCatalogKeys: [],
    ctaLabel: siteConfig.catalog.fullDay.ctaLabel,
  },
  {
    id: "all-in",
    title: siteConfig.catalog.allIn.title,
    tagline: "Luxury sandbar day",
    description: "Sandbar & snorkel charter with popular add-ons preselected.",
    includes: [
      "Private sandbar & snorkel charter",
      "Captain included",
      "Popular add-ons preselected at checkout",
    ],
    fromPriceLabel: `From ${formatUsdFromCents(allInFrom)}+`,
    charterOptions: [
      { experienceSlug: "watersports", durationHours: 8, label: `${siteConfig.catalog.fullDay.title} · All-In` },
    ],
    defaultOptionIndex: 0,
    addonCatalogKeys: [...ALL_IN_ADDONS],
    recommended: true,
    ctaLabel: siteConfig.catalog.allIn.ctaLabel,
  },
];

export function getBundlePreset(id: string): BundlePreset | undefined {
  if (id === "nasty") return bundlePresets.find((b) => b.id === "half-day");
  if (id === "nastier") return bundlePresets.find((b) => b.id === "full-day");
  if (id === "nastiest") return bundlePresets.find((b) => b.id === "all-in");
  return bundlePresets.find((b) => b.id === id);
}

export function foundingRateCallout(): string | null {
  if (!FOUNDING_ANGLER_RATE_ACTIVE) return null;
  return `Launch rates active — Half Day ${formatUsdFromCents(getActiveCatalogRateCents("half"))} / Full Day ${formatUsdFromCents(getActiveCatalogRateCents("full"))} (standard ${formatUsdFromCents(STANDARD_RATE_CENTS.half)} / ${formatUsdFromCents(STANDARD_RATE_CENTS.full)}).`;
}
