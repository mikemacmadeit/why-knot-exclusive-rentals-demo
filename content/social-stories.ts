/**
 * Homepage / site Instagram-style stories.
 *
 * Instagram does NOT allow scraping https://www.instagram.com/tahoewakebusters/
 * for live Stories. Use one of:
 *
 * 1) Manual curation (what this file is) — drop media in /public and list here.
 * 2) Meta Instagram Graph API — Business/Creator IG + Facebook Page + app token,
 *    then GET /{ig-user-id}/stories (media URLs expire; cache via cron).
 *
 * Profile link opens their Instagram; story media must be files you host.
 */

import type { Story } from "@/components/ui/social-stories";

export const INSTAGRAM_PROFILE_URL = "https://www.instagram.com/tahoewakebusters/";

export const socialStoriesProfile = {
  name: "Tahoe Wakebusters",
  /** Prefer a square brand mark / founder crop for the ring avatar */
  avatarUrl: "/brand/logo.png",
} as const;

/**
 * Curated story slides — replace/add entries as you publish new clips.
 * `linkUrl` should point at the Instagram profile (or a specific post if you have one).
 */
export const socialStories: Story[] = [
  {
    id: "wake-1",
    platform: "instagram",
    mediaUrl: "/photos/wakebusters/hero-wake.jpg",
    linkUrl: INSTAGRAM_PROFILE_URL,
    caption: "Make wakes. Create memories.",
    duration: 5,
  },
  {
    id: "party-1",
    platform: "instagram",
    mediaUrl: "/photos/wakebusters/party-barge.jpg",
    linkUrl: INSTAGRAM_PROFILE_URL,
    caption: "Party barge days on Tahoe.",
    duration: 5,
  },
  {
    id: "crew-1",
    platform: "instagram",
    mediaUrl: "/photos/wakebusters/crew.jpg",
    linkUrl: INSTAGRAM_PROFILE_URL,
    caption: "Real crew. Real lake.",
    duration: 5,
  },
  {
    id: "shore-1",
    platform: "instagram",
    mediaUrl: "/photos/wakebusters/tahoe-shoreline.jpg",
    linkUrl: INSTAGRAM_PROFILE_URL,
    caption: "Follow @tahoewakebusters for more.",
    duration: 5,
  },
];
