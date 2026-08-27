/**
 * Homepage / site Instagram-style stories.
 * Why Knot social profile URLs were not listed as full links on the public site.
 */

import type { Story } from "@/components/ui/social-stories";
import { siteConfig } from "@/config/site";

export const INSTAGRAM_PROFILE_URL =
  siteConfig.social.instagram || `https://${siteConfig.company.domain}`;

export const socialStoriesProfile = {
  name: siteConfig.company.name,
  avatarUrl: siteConfig.branding.logo,
} as const;

export const socialStories: Story[] = [
  {
    id: "keys-1",
    platform: "instagram",
    mediaUrl: "/photos/whyknot/sandbar-cheers.jpg",
    linkUrl: INSTAGRAM_PROFILE_URL,
    caption: "Explore the water your way.",
    duration: 5,
  },
  {
    id: "sandbar-1",
    platform: "instagram",
    mediaUrl: "/photos/whyknot/bougie-girl.jpg",
    linkUrl: INSTAGRAM_PROFILE_URL,
    caption: "The Bougie Girl experience.",
    duration: 5,
  },
  {
    id: "fish-1",
    platform: "instagram",
    mediaUrl: "/photos/whyknot/catch-swordfish.jpg",
    linkUrl: INSTAGRAM_PROFILE_URL,
    caption: "Offshore, reef, and backcountry.",
    duration: 5,
  },
  {
    id: "day-1",
    platform: "instagram",
    mediaUrl: "/photos/whyknot/boat-day.png",
    linkUrl: INSTAGRAM_PROFILE_URL,
    caption: "Florida Keys boat rentals.",
    duration: 5,
  },
];
