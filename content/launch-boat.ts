import { brand } from "@/content/brand";
import { siteConfig } from "@/config/site";
import { DEFAULT_CANCELLATION_POLICY } from "@/lib/booking/cancellation-policy";

/**
 * Flagship boat for seed — The Bougie Girl.
 */

export const LAUNCH_BOAT = {
  name: "The Bougie Girl",
  slug: "bougie-girl",
  previousNames: [] as const,
  previousSlugs: ["charter-boat", "party-barge"] as const,
  year: 2022,
  model: "Luxury Sandbar & Snorkel Charter",
  make: "Why Knot Exclusive Rentals",
  heroSubtitle: "Comfort-first · Captain included · Sandbar & snorkel",
  capacity: 12,
  timezone: brand.timezone,
  capacityMax: 12,
  petsMax: 0,
  defaultLocationText: siteConfig.contact.marinaMeetNote,
  cancellationPolicyText: DEFAULT_CANCELLATION_POLICY,
  photos: [
    "/photos/whyknot/bougie-girl.jpg",
    "/photos/whyknot/sandbar-cheers.jpg",
    "/photos/whyknot/gallery-2.jpg",
  ] as string[],
  description: [
    "The Bougie Girl Experience — designed for comfort, not just getting you there.",
    "Luxury sandbar and snorkel days in the Florida Keys with a USCG-licensed captain handling every detail.",
  ].join("\n\n"),
} as const;

export const OUR_BOAT_PATH = `/boats/${LAUNCH_BOAT.slug}` as const;
