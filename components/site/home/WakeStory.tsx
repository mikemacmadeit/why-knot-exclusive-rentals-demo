"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { brand } from "@/content/brand";
import { homepageCopy } from "@/content/homepage";
import { AnimatedTooltip } from "@/components/ui/animated-tooltip";
import { LinkPreview } from "@/components/ui/link-preview";

const founders = [
  {
    id: 1,
    name: "Captain Braxton Black",
    designation: "Captain · Keys local",
    image: "/photos/whyknot/gallery-4.jpg",
  },
];

/**
 * Founders story — Jarod & Bobby, with hover portraits.
 */
export function WakeStory() {
  return (
    <section
      id="about"
      className="bg-white px-5 py-20 sm:px-8 sm:py-24 lg:px-14 xl:px-20"
      aria-label="Our story"
    >
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2 lg:items-center lg:gap-14">
        <div className="flex flex-col items-center pt-20 lg:items-start">
          <AnimatedTooltip
            items={founders}
            className="justify-center lg:justify-start"
            avatarClassName="h-44 w-44 border-4 sm:h-56 sm:w-56 lg:h-72 lg:w-72"
            itemClassName="-mr-12 sm:-mr-16 lg:-mr-20"
          />
          <p className="mt-6 text-center text-xs font-semibold uppercase tracking-[0.2em] text-brand-muted lg:text-left">
            Captain Braxton Black · Why Knot
          </p>
        </div>

        <div className="max-w-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-primary">
            {homepageCopy.story.eyebrow}
          </p>
          <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-brand-dark sm:text-4xl">
            {homepageCopy.story.h2}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-brand-muted sm:text-lg">
            Captain Braxton Black is a true local waterman who turns every trip into an
            unforgettable adventure. {brand.companyName} exists for one reason: give every guest
            the best possible day on the Florida Keys.
          </p>

          <h3 className="mt-6 font-display text-lg font-extrabold text-brand-dark">
            {homepageCopy.story.crewLine}
          </h3>
          <p className="mt-2 text-base leading-relaxed text-brand-muted sm:text-lg">
            Finest boats, captains who know these waters, and hidden spots you won&apos;t find on a
            map. From{" "}
            <LinkPreview
              url="/experiences/watersports"
              isStatic
              imageSrc="/photos/whyknot/catch-swordfish.jpg"
              width={240}
              height={150}
              className="font-bold text-brand-dark"
            >
              offshore fishing
            </LinkPreview>{" "}
            to{" "}
            <LinkPreview
              url="/experiences/sunset"
              isStatic
              imageSrc="/photos/whyknot/sandbar-cheers.jpg"
              width={240}
              height={150}
              className="font-bold text-brand-dark"
            >
              sandbar &amp; snorkel
            </LinkPreview>
            , we know where the day wants to go.
          </p>

          <h3 className="mt-6 font-display text-lg font-extrabold text-brand-dark">
            {homepageCopy.story.occasions}
          </h3>
          <p className="mt-2 text-base leading-relaxed text-brand-muted sm:text-lg">
            Families, anglers, sandbar days, sunset cruises — with{" "}
            <LinkPreview
              url="/experiences/pontoon"
              isStatic
              imageSrc="/photos/whyknot/boat-day.png"
              width={240}
              height={150}
              className="font-bold text-brand-dark"
            >
              boat rentals
            </LinkPreview>{" "}
            or a fully captained private charter.
          </p>

          <Link
            href="/our-story"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-brand-dark px-6 py-3.5 text-sm font-bold text-white transition hover:bg-brand-dark/90"
          >
            More about us <ArrowUpRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
