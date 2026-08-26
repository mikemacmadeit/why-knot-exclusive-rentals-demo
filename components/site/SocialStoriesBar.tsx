"use client";

import Link from "next/link";
import { Instagram } from "lucide-react";
import { SocialStories } from "@/components/ui/social-stories";
import {
  socialStories,
  socialStoriesProfile,
  INSTAGRAM_PROFILE_URL,
} from "@/content/social-stories";

/**
 * Story ring + Instagram CTA — uses curated media (see content/social-stories.ts).
 */
export function SocialStoriesBar({ className }: { className?: string }) {
  if (socialStories.length === 0) return null;

  return (
    <div
      className={`flex items-center gap-4 ${className ?? ""}`}
      aria-label="Instagram stories"
    >
      <SocialStories stories={socialStories} profile={socialStoriesProfile} />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-muted">
          On the water
        </p>
        <Link
          href={INSTAGRAM_PROFILE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-dark hover:text-brand-primary"
        >
          <Instagram className="h-4 w-4" aria-hidden />
          @tahoewakebusters
        </Link>
      </div>
    </div>
  );
}
