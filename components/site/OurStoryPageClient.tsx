"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { brand } from "@/content/brand";
import { homepageCopy } from "@/content/homepage";
import { BookingCTA } from "@/components/site/BookingCTA";
import { LipScrollZoominAnimation } from "@/components/ui/lip-scroll-zoomin-animation";
import { LayeredText } from "@/components/ui/layered-text";
import { AnimatedTooltip } from "@/components/ui/animated-tooltip";

const WATER_PHOTO = "/photos/wakebusters/tahoe-aerial.jpg";

const FOUNDERS = [
  {
    id: 1,
    name: "Jarod Minghini",
    designation: "Founder · Captain",
    image: "/photos/wakebusters/founder-wakesurf.jpg",
  },
  {
    id: 2,
    name: "Bobby Minghini",
    designation: "Founder · Captain",
    image: "/photos/wakebusters/founder-portrait.jpg",
  },
];

const STORY_LAYERED_LINES = [
  { top: "\u00A0", bottom: "BROTHERS" },
  { top: "BROTHERS", bottom: "LOCALS" },
  { top: "LOCALS", bottom: "MAKE" },
  { top: "MAKE", bottom: "WAKES" },
  { top: "WAKES", bottom: "CREATE" },
  { top: "CREATE", bottom: "MEMORIES" },
  { top: "MEMORIES", bottom: "\u00A0" },
];

function FadeIn({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay }}
    >
      {children}
    </motion.div>
  );
}

function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-3 mb-4">
      <span className="h-px w-8 bg-brand-secondary" aria-hidden />
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-secondary">{children}</p>
    </div>
  );
}

export function OurStoryPageClient() {
  return (
    <div className="min-h-screen w-full bg-brand-dark">
      <LipScrollZoominAnimation
        title={homepageCopy.story.h2}
        watermark="TAHOE"
        posterSrc="/photos/wakebusters/tahoe-shoreline.jpg"
        imageAlt={homepageCopy.story.imageAlt}
        className="bg-brand-dark"
        firstSlide={
          <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl flex-col items-center justify-center px-2 text-center sm:px-4">
            <h1 className="sr-only">{homepageCopy.story.h2}</h1>
            <LayeredText
              lines={STORY_LAYERED_LINES}
              className="font-display shrink-0 !py-0"
              color="#7dd3fc"
              activeColor="#ff6b2b"
              fontSize="96px"
              fontSizeMd="44px"
              lineHeight={82}
              lineHeightMd={44}
              offset={48}
              offsetMd={22}
            />
          </div>
        }
        outroSlide={
          <div
            id="crew"
            className="mx-auto flex w-full max-w-5xl scroll-mt-28 flex-col items-center px-2 text-center sm:px-4"
          >
            <div className="mb-6 inline-flex items-center gap-3">
              <span className="h-px w-8 bg-brand-secondary" aria-hidden />
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-secondary">
                Why we exist
              </p>
            </div>

            <div className="mb-8 flex flex-col items-center pt-8 sm:mb-10 sm:pt-10">
              <AnimatedTooltip
                items={FOUNDERS}
                className="justify-center"
                avatarClassName="h-28 w-28 border-[3px] sm:h-36 sm:w-36 lg:h-44 lg:w-44"
                itemClassName="-mr-6 sm:-mr-8 lg:-mr-10"
              />
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-brand-muted">
                Jarod &amp; Bobby · Founders
              </p>
            </div>

            <h2 className="max-w-2xl font-display text-3xl font-bold leading-[1.15] tracking-tight text-brand-dark sm:text-4xl lg:text-[2.65rem]">
              {brand.companyName} exists for one reason: give every guest the best possible day on
              the water.
            </h2>
            <div className="mt-8 max-w-2xl space-y-6 text-base leading-relaxed text-brand-muted sm:text-lg">
              <p>
                Ten years of Lake Tahoe boat rentals from a family-owned crew who actually grew up
                on this water. One flat rate. No hidden fuel charges. USCG-certified captains who
                know every cove from Emerald Bay to Camp Richardson.
              </p>
              <p>
                A real crew on a real lake. Finest boats, everything included, honest prices, and
                cove knowledge no booking widget can fake. From Emerald Bay to Camp Richardson, we
                know where the day wants to go.
              </p>
              <p>
                Bachelorettes to board meetings. Birthdays, weddings, corporate outings, 4th of July
                chaos — groups of 2 to 40+, with single boats or the full fleet running together.
              </p>
            </div>

            <Link
              href="/experiences"
              className="mt-10 inline-flex items-center justify-center rounded-xl bg-brand-secondary px-6 py-3.5 text-sm font-bold text-white transition-transform duration-200 hover:scale-[1.02] hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary focus-visible:ring-offset-2"
            >
              See the fleet
            </Link>
          </div>
        }
      />

      <section className="relative overflow-hidden bg-brand-dark" aria-labelledby="crew-lake-heading">
        <div className="absolute inset-0" aria-hidden>
          <Image
            src={WATER_PHOTO}
            alt=""
            fill
            className="object-cover object-center opacity-30"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-brand-dark via-brand-dark/92 to-brand-dark/80" />
        </div>

        <div className="relative section-padding">
          <div className="container-wide px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 max-w-6xl mx-auto">
              <FadeIn className="lg:col-span-5">
                <SectionEyebrow>How we run it</SectionEyebrow>
                <h2
                  id="crew-lake-heading"
                  className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-tight"
                >
                  A real crew on a real lake.
                </h2>
              </FadeIn>

              <FadeIn delay={0.08} className="lg:col-span-7 space-y-6 text-base sm:text-lg text-white/75 leading-relaxed">
                <p>
                  Finest boats, everything included, honest prices, and cove knowledge no booking
                  widget can fake. From Emerald Bay to Camp Richardson, we know where the day wants
                  to go.
                </p>
                <p>
                  Every charter runs with a USCG-certified captain — Tahoe locals who know which
                  cove is empty on a Saturday, where the wake is cleanest at 9 a.m., and exactly how
                  long you&apos;ve got before the wind comes up.
                </p>
              </FadeIn>
            </div>
          </div>
        </div>
      </section>

      <section className="section-padding bg-white" aria-labelledby="close-heading">
        <div className="container-wide px-4 sm:px-6 lg:px-8">
          <FadeIn className="max-w-2xl mx-auto text-center">
            <h2
              id="close-heading"
              className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-brand-dark tracking-tight"
            >
              Ready to Book Your Lake Tahoe Boat Rental?
            </h2>
            <p className="mt-5 text-base sm:text-lg text-brand-muted leading-relaxed">
              Party barge, wakesurf charter, or luxury tritoon — reserve your day on Lake Tahoe with
              a captain who knows the water. Gas and toys included, no hidden fees.
            </p>
            <div className="mt-8 flex justify-center">
              <BookingCTA
                source="our_story_page"
                page="our-story"
                variant="secondary"
                showCall
                primaryHint="Instant confirmation · Easy reschedule · Flexible weather policy"
                className="justify-center"
              />
            </div>
          </FadeIn>
        </div>
      </section>
    </div>
  );
}
