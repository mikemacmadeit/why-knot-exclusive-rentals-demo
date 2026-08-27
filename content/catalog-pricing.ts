/**
 * Catalog pricing for Why Knot Exclusive Rentals demo (Florida Keys).
 * DEMO SAMPLE RATES ONLY — not live customer pricing.
 */

export type CharterKind = "half" | "full";

export const FOUNDING_ANGLER_RATE_ACTIVE = false;
export const FOUNDING_ANGLER_LABEL = "LAUNCH RATE";

/** Demo advertised rates (USD cents), before tax. half ≈ half day; full ≈ full day. */
export const STANDARD_RATE_CENTS: Record<CharterKind, number> = {
  half: 75_000, // $750 · demo half day rental / charter
  full: 125_000, // $1,250 · demo full day
};

export const FOUNDING_RATE_CENTS: Record<CharterKind, number> = {
  half: 65_000,
  full: 110_000,
};

export const PEAK_FULL_DAY_CENTS = 125_000;

export function getActiveCatalogRateCents(kind: CharterKind): number {
  return FOUNDING_ANGLER_RATE_ACTIVE ? FOUNDING_RATE_CENTS[kind] : STANDARD_RATE_CENTS[kind];
}

export function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/** Included with Why Knot trips (demo catalog — confirm with operator before go-live). */
export const CHARTER_INCLUDED: string[] = [
  "USCG-licensed captain on captained charters",
  "Local Florida Keys knowledge",
  "Safety gear & life jackets",
  "Snorkel gear on sandbar / snorkel trips",
  "Customized trip plan for conditions",
];
