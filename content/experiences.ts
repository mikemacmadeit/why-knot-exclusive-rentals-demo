/**
 * Fleet packages for Why Knot Exclusive Rentals demo (Florida Keys).
 * Firestore slugs remain `pontoon` / `watersports` / `sunset` for seed compatibility.
 *
 * Mapping:
 * - pontoon → Boat Rental (bareboat / be your own captain)
 * - watersports → Fishing Charters
 * - sunset → Luxury Sandbar & Snorkel (Bougie Girl / Sea Fox)
 */

import { siteConfig } from "@/config/site";
import {
  formatUsdFromCents,
  getActiveCatalogRateCents,
} from "@/content/catalog-pricing";

export interface Experience {
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  highlights: string[];
  duration: string;
  durationMinutes?: number;
  capacity: string;
  heroImage: string;
  listingCardImagePosition?: string;
  gallery: string[];
  pricingNote: string;
  fromPriceCents?: number | null;
  faqs?: { q: string; a: string }[];
  ctaLabel?: string;
  bookCtaLabel?: string;
  badge?: string;
  imageAlt?: string;
}

const rentalRate = getActiveCatalogRateCents("half");
const fishingRate = getActiveCatalogRateCents("full");
const sandbarRate = getActiveCatalogRateCents("half");

export const experiences: Experience[] = [
  {
    slug: "pontoon",
    title: siteConfig.catalog.halfDay.title,
    shortDescription:
      "Be your own captain. Explore the Florida Keys at your own pace — sandbars, sightseeing, or a lazy day on the water with family and friends.",
    description:
      "Choose a boat rental to explore the water at your own pace. Perfect for sandbar trips, sightseeing, or simply spending a great day on the ocean with family and friends. We confirm dock details in Tavernier after you book. Captain optional if you’d rather not drive.",
    highlights: [
      "Be your own captain (or add a USCG captain)",
      "Explore at your own pace",
      "Sandbar, sightseeing, or island hopping",
      "Safety gear included",
      "Depart Tavernier Creek",
      "Customized around your group",
    ],
    duration: "Half or full day",
    durationMinutes: 240,
    capacity: "Private group",
    heroImage: "/photos/whyknot/boat-day.png",
    gallery: [
      "/photos/whyknot/boat-day.png",
      "/photos/whyknot/gallery-4.jpg",
    ],
    pricingNote: `Demo sample from ${formatUsdFromCents(rentalRate)}. Confirm live rates with Why Knot before go-live.`,
    fromPriceCents: rentalRate,
    ctaLabel: "BOOK BOAT RENTAL",
    bookCtaLabel: "Book now",
    imageAlt: "Why Knot Exclusive Rentals boat rental in the Florida Keys",
    faqs: [
      {
        q: "Do I need a captain?",
        a: "No — boat rentals are set up so you can be your own captain. If you’d rather relax, we can add a USCG-licensed captain.",
      },
      {
        q: "Where do we launch?",
        a: "We operate out of Tavernier, Florida Keys (Tavernier Creek). Exact dock details come after you book.",
      },
    ],
  },
  {
    slug: "watersports",
    title: siteConfig.catalog.fullDay.title,
    shortDescription:
      "Offshore mahi, reef & wreck snapper and grouper, or light-tackle backcountry. Every fishing trip is customized to the conditions and your experience level.",
    description:
      "From deep offshore waters to the reefs, wrecks, and shallow backcountry of the Florida Keys, we offer fishing charters for every type of angler. Chase mahi offshore, drop lines on the reef for snapper and grouper, or explore mangroves and flats on light tackle. USCG-licensed captains, local knowledge, and a trip plan built around the bite.",
    highlights: [
      "Offshore, reef & wreck, or backcountry",
      "USCG-licensed captain included",
      "Customized to conditions & skill level",
      "Gear and local knowledge provided",
      "All experience levels welcome",
      "Best shot at quality fish",
    ],
    duration: "Half or full day",
    durationMinutes: 240,
    capacity: "Private charter",
    heroImage: "/photos/whyknot/catch-swordfish.jpg",
    gallery: [
      "/photos/whyknot/catch-swordfish.jpg",
      "/photos/whyknot/gallery-3.jpg",
      "/photos/whyknot/gallery-6.jpg",
      "/photos/whyknot/catch-snapper.jpg",
      "/photos/whyknot/catch-lobsters.jpg",
      "/photos/whyknot/catch-barracuda.jpg",
    ],
    pricingNote: `Demo sample from ${formatUsdFromCents(fishingRate)}. Captain included. Confirm live rates before go-live.`,
    fromPriceCents: fishingRate,
    ctaLabel: "BOOK FISHING CHARTER",
    bookCtaLabel: "Book now",
    badge: "Most Popular",
    imageAlt: "Fishing charter with Why Knot Exclusive Rentals in the Florida Keys",
    faqs: [
      {
        q: "What kind of fishing do you run?",
        a: "Offshore, reef & wreck, and backcountry. We match the trip to weather, season, and what you want to catch.",
      },
    ],
  },
  {
    slug: "sunset",
    title: siteConfig.catalog.allIn.title,
    shortDescription:
      "The Bougie Girl experience — designed for comfort, not just getting you there. Sandbar, snorkel, coastline cruise, with a captain handling every detail.",
    description:
      "Escape to crystal-clear Florida Keys water aboard premium charter boats built for comfort and style. Relax at the sandbar, snorkel vibrant reefs, cruise the coastline, or enjoy time with family and friends. Spacious seating, high-end amenities, and experienced captains. Ask about The Bougie Girl or the Sea Fox 26.8 Commander.",
    highlights: [
      "Luxury sandbar & snorkel",
      "Captain included — sit back and enjoy",
      "Snorkeling gear provided",
      "The Bougie Girl & Sea Fox 26.8 Commander",
      "Customized to your group",
      "Stress-free Keys day",
    ],
    duration: "Half or full day",
    durationMinutes: 240,
    capacity: "Private group",
    heroImage: "/photos/whyknot/sandbar-cheers.jpg",
    gallery: [
      "/photos/whyknot/sandbar-cheers.jpg",
      "/photos/whyknot/bougie-girl.jpg",
      "/photos/whyknot/gallery-2.jpg",
      "/photos/whyknot/sandbar-contender.jpg",
    ],
    pricingNote: `Demo sample from ${formatUsdFromCents(sandbarRate)}. Captain included. Confirm live rates before go-live.`,
    fromPriceCents: sandbarRate,
    ctaLabel: "BOOK SANDBAR & SNORKEL",
    bookCtaLabel: "Book now",
    imageAlt: "The Bougie Girl luxury sandbar and snorkel charter in the Florida Keys",
    faqs: [
      {
        q: "Which boats?",
        a: "Luxury sandbar and snorkel trips run on The Bougie Girl and the Sea Fox 26.8 Commander. We’ll match the boat to your group when you book.",
      },
    ],
  },
];

export function getExperienceBySlug(slug: string): Experience | undefined {
  const s = (slug ?? "").toLowerCase().trim();
  if (!s) return undefined;
  if (s === "pontoon" || s === "nasty-half-day" || s === "half-day" || s === "party-barge" || s === "boat-rental") {
    return experiences.find((e) => e.slug === "pontoon");
  }
  if (s === "watersports" || s === "nasty-full-day" || s === "full-day" || s === "wakesurf" || s === "fishing") {
    return experiences.find((e) => e.slug === "watersports");
  }
  if (s === "sunset" || s === "tritoon" || s === "all-in" || s === "sandbar") {
    return experiences.find((e) => e.slug === "sunset");
  }
  return experiences.find((e) => e.slug === s);
}

export function getAllExperienceSlugs(): string[] {
  return experiences.map((e) => e.slug);
}

export function formatExperiencePriceLabel(
  slug: string | null | undefined,
  fromPriceCents: number | null | undefined,
  pricingType?: "charter" | "ticketed"
): string {
  if (fromPriceCents == null || !Number.isFinite(fromPriceCents)) return "See dates for pricing";
  const price = (fromPriceCents / 100).toFixed(0);
  if (pricingType === "ticketed") return `From $${price} per ticket`;
  if (/holiday/i.test(slug ?? "")) return `$${price} per ticket`;
  return `From $${price}`;
}
