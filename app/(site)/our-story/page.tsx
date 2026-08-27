import { brand } from "@/content/brand";
import type { Metadata } from "next";
import { OurStoryPageClient } from "@/components/site/OurStoryPageClient";
import { getSiteBaseUrl, siteConfig } from "@/config/site";

const baseUrl = getSiteBaseUrl();
const canonical = `${baseUrl}/our-story`;
const ogImage = siteConfig.seo.defaultOgImage;

/** Dynamic so CSP nonces from middleware match inline scripts (GA / Next). */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Our Story",
  description:
    "Meet Captain Braxton Black — a Florida Keys local waterman. Why Knot Exclusive Rentals exists to give every guest the best possible day on the water.",
  keywords: [brand.companyName, "Captain Braxton Black", "Tavernier boat rentals", "Florida Keys charters"],
  alternates: { canonical },
  openGraph: {
    title: `Our Story | ${brand.companyName}`,
    description: "Boat rentals, fishing charters, and luxury sandbar & snorkel from Tavernier, Florida Keys.",
    url: canonical,
    images: [
      {
        url: ogImage,
        width: 1800,
        height: 2400,
        alt: "Captain Braxton Black and Why Knot Exclusive Rentals in the Florida Keys",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `Our Story | ${brand.companyName}`,
    description: "Boat rentals, fishing charters, and luxury sandbar & snorkel from Tavernier, Florida Keys.",
    images: [ogImage],
  },
};

export default function OurStoryPage() {
  return <OurStoryPageClient />;
}
