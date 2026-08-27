/**
 * Why Knot Exclusive Rentals — sales demo / preview customer config.
 * Branch: demo/why-knot-exclusive-rentals. Not for their live domain until they buy.
 * Source identity: https://www.whyknotexclusiverentals.com/
 */

import type { SiteConfig } from "@/config/site-types";
import {
  assertCustomerConfigForDeploy,
  requireProductionSiteUrl,
} from "@/config/assert-production-config";
import { resolveFeatureFlags } from "@/lib/plan/entitlements";

export type { SiteConfig } from "@/config/site-types";
export { TEMPLATE_PLACEHOLDER } from "@/config/site-types";

const TEMPLATE_PLAN = "full" as const;

export const siteConfig: SiteConfig = {
  tenantId: "why-knot-exclusive-rentals-demo",
  environment: "development",
  plan: TEMPLATE_PLAN,

  company: {
    name: "Why Knot Exclusive Rentals",
    shortName: "Why Knot",
    legalName: "Why Knot Exclusive Rentals",
    publicName: "Why Knot Exclusive Rentals",
    tagline: "Explore the water your way with boat rentals & private charters.",
    domain: "whyknotexclusiverentals.com",
  },

  contact: {
    email: "hello@whyknotexclusiverentals.com",
    phone: "(645) 242-1977",
    phoneTel: "+16452421977",
    sms: "+16452421977",
    address: {
      line1: "167 Gardenia St",
      city: "Tavernier",
      state: "FL",
      zip: "33070",
      country: "US",
    },
    hours: "By reservation — Florida Keys season books fast",
    marinaMeetNote:
      "Meet at 167 Gardenia St, Tavernier, FL. We’ll confirm the exact dock after you book.",
    hoursNote: "Trips depart at your booked time. Call or text to confirm meet-up details.",
    googleMapsPlaceUrl: "https://maps.google.com/?q=167+Gardenia+St+Tavernier+FL+33070",
    mapEmbedSrc: "https://www.google.com/maps?q=167+Gardenia+St,+Tavernier,+FL+33070&output=embed",
    geo: { latitude: 25.0115, longitude: -80.5153 },
    areaServed: ["Tavernier", "Florida Keys", "Key Largo", "Islamorada", "Monroe County"],
  },

  branding: {
    logo: "/brand/logo.png",
    logoDesktop: "/brand/logo-light.png",
    logoMonogram: "/brand/logo-light.png",
    logoNavbar: "/brand/logo-navbar-white.png",
    logoHover: "/brand/logo-light.png",
    logoDark: "/brand/logo-dark.png",
    logoEmail: "/brand/logo.png",
    logoHero: "/brand/logo-light.png",
    logoHeroHover: "/brand/logo-light.png",
    logoAlt: "Why Knot Exclusive Rentals",
    favicon: "/brand/favicon.png",
  },

  // Matched to live whyknotexclusiverentals.com (Wix teal CTA + Keys navy)
  theme: {
    primaryColor: "#047f97",
    secondaryColor: "#08d4c7",
    accentColor: "#044d60",
    darkColor: "#044d60",
    mutedColor: "#5a6b73",
    backgroundColor: "#f4fafb",
    textColor: "#141414",
    silverColor: "#c5d4d8",
    borderRadius: "0.5rem",
    fontDisplay: "Barlow",
  },

  social: {
    instagram: "https://www.instagram.com/whyknotcharters_rentals/",
    facebook: "",
    youtube: "",
    tiktok: "https://www.tiktok.com/@whyknot.boat.rentals",
    yelp: "",
    tripadvisor: "",
  },

  seo: {
    title: "Florida Keys Boat Rentals & Charters | Why Knot Exclusive Rentals",
    description:
      "Boat rentals and private captained charters in Tavernier, Florida Keys. Fishing, sandbar & snorkel, and luxury days on the water with USCG-licensed captains. Book online.",
    defaultOgImage: "/photos/whyknot/hero.jpg",
    defaultOgImageAlt:
      "Why Knot Exclusive Rentals boat on the water in the Florida Keys",
    keywords: [
      "Florida Keys boat rentals",
      "Tavernier boat rental",
      "Key Largo boat charter",
      "Florida Keys fishing charter",
      "sandbar snorkel charter Keys",
      "Why Knot Exclusive Rentals",
      "captained charter Tavernier",
      "Bougie Girl charter",
    ],
    blogName: "Keys Notes",
    blockSearchIndexing: true,
  },

  media: {
    hero: "/photos/whyknot/hero.jpg",
    welcome: "/photos/whyknot/gallery-4.jpg",
    boats: "/photos/whyknot/boat-day.png",
    galleryFallback: "/photos/whyknot/gallery-2.jpg",
    listingFallback: "/photos/whyknot/bougie-girl.jpg",
  },

  catalog: {
    halfDay: {
      title: "Boat Rental",
      durationLabel: "Half or Full Day",
      ctaLabel: "Book a Rental",
    },
    fullDay: {
      title: "Fishing Charter",
      durationLabel: "Half or Full Day",
      ctaLabel: "Book Fishing",
    },
    allIn: {
      title: "Sandbar & Snorkel",
      ctaLabel: "Book Sandbar Trip",
    },
  },

  nav: {
    blogLabel: "Guides",
    experiencesLabel: "Trips",
    packagesLabel: "Packages",
    boatLabel: "Our Fleet",
  },

  business: {
    timezone: "America/New_York",
    currency: "USD",
    country: "US",
    locale: "en-US",
    taxRate: 0,
    legal: {
      governingLaw: "the State of Florida",
      venue: "Monroe County, Florida",
    },
  },

  booking: {
    path: "/booking",
    mode: "link",
    providerUrl: "",
    embedSrc: "",
    depositFraction: 0.5,
    minimumNoticeHours: 24,
    balanceHoursBefore: 48,
    slotSelectionMode: "hourly",
    cancellation: {
      freeCancelDays: 7,
      partialRefundDaysStart: 7,
      partialRefundDaysEnd: 7,
      noRefundWithinDays: 7,
      fullText:
        "Cancel up to 7 days before your trip for a full refund. " +
        "If weather does not cooperate, we will work with you on a rain check or full refund. " +
        "No-shows without prior notice are non-refundable. " +
        "Contact us by phone or text to cancel.",
      summary:
        "Full refund if you cancel 7+ days ahead · Weather rain checks available · No-shows non-refundable.",
    },
  },

  operations: {
    operatingHours: {
      startHour: 7,
      endHour: 20,
      firstDepartureHour: 7,
      lastDepartureHour: 17,
    },
  },

  features: resolveFeatureFlags(TEMPLATE_PLAN),

  phone: "(645) 242-1977",
  phoneTel: "+16452421977",
  sms: "+16452421977",
};

assertCustomerConfigForDeploy(siteConfig);

export function getSiteBaseUrl(): string {
  const fromEnv = requireProductionSiteUrl();
  if (fromEnv) return fromEnv;
  return `https://${siteConfig.company.domain}`.replace(/\/+$/, "");
}

export function getNoreplyEmail(): string {
  return process.env.BREVO_SENDER_EMAIL?.trim() || `noreply@${siteConfig.company.domain}`;
}

export function getSenderName(): string {
  return process.env.BREVO_SENDER_NAME?.trim() || siteConfig.company.name;
}

export function getContactEmail(): string {
  return process.env.CONTACT_EMAIL?.trim() || siteConfig.contact.email;
}

export function emailSubjectSuffix(): string {
  return ` – ${siteConfig.company.name}`;
}

export function isPlatformDevBannerEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SHOW_PLATFORM_BANNER === "1";
}

export function siteThemeCssVars(): Record<string, string> {
  const t = siteConfig.theme;
  return {
    "--brand-primary": t.primaryColor,
    "--brand-secondary": t.secondaryColor,
    "--brand-accent": t.accentColor,
    "--brand-dark": t.darkColor,
    "--brand-muted": t.mutedColor,
    "--brand-bg": t.backgroundColor,
    "--brand-text": t.textColor,
    "--brand-silver": t.silverColor,
    "--brand-radius": t.borderRadius,
  };
}
