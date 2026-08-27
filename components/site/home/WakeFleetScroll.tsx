"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { iconForHighlight } from "@/components/site/icons/nautical";
import { experiences, formatExperiencePriceLabel } from "@/content/experiences";
import { useBookingModal } from "@/components/site/BookingModalContext";
import { brand } from "@/content/brand";
import { homepageCopy } from "@/content/homepage";

/**
 * Fleet + pricing cards. Bottom fade uses brand tokens so it bleeds into In the Keys.
 */
export function WakeFleetScroll() {
  const { openWithSelection } = useBookingModal();

  return (
    <section
      id="fleet"
      className="relative w-full bg-white pt-20 sm:pt-24"
      aria-label="Our Florida Keys boat rental and charter fleet"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-primary">
          {homepageCopy.fleet.eyebrow}
        </p>
        <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-brand-dark sm:text-4xl lg:text-5xl">
          {homepageCopy.fleet.h2}
        </h2>
        <p className="mt-3 text-base text-brand-muted sm:text-lg">
          {homepageCopy.fleet.intro}
        </p>
      </div>

      <div className="mt-12 grid gap-4 lg:grid-cols-3 lg:gap-5">
        {experiences.map((boat, i) => (
          <motion.article
            key={boat.slug}
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className="group flex flex-col overflow-hidden rounded-[1.25rem] bg-white shadow-soft ring-1 ring-brand-dark/5"
          >
            <div className="relative aspect-[4/3] overflow-hidden">
              <Image
                src={boat.heroImage}
                alt={boat.imageAlt ?? boat.title}
                fill
                sizes="(max-width: 1024px) 100vw, 360px"
                className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
              />
              {boat.badge ? (
                <span className="absolute left-3 top-3 rounded-full bg-brand-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                  {boat.badge}
                </span>
              ) : null}
            </div>

            <div className="flex flex-1 flex-col p-5 sm:p-6 lg:p-7">
              <h3 className="font-display text-xl font-extrabold text-brand-dark sm:text-2xl">
                {boat.title}
              </h3>
              <p className="mt-1 font-display text-base font-bold text-brand-dark">
                {formatExperiencePriceLabel(boat.slug, boat.fromPriceCents)} · {boat.capacity}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-brand-muted lg:text-[15px]">
                {boat.shortDescription}
              </p>

              <ul className="mt-4 space-y-2">
                {boat.highlights.map((h) => {
                  const Icon = iconForHighlight(h);
                  return (
                    <li key={h} className="flex items-start gap-2 text-sm text-brand-dark/80">
                      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-primary" />
                      <span>{h}</span>
                    </li>
                  );
                })}
              </ul>

              <p className="mt-5 text-xs text-brand-muted">
                {homepageCopy.fleet.captainNote}
              </p>

              <div className="mt-auto flex flex-col gap-2 pt-5 sm:flex-row">
                <button
                  type="button"
                  onClick={() => openWithSelection({ experienceSlug: boat.slug })}
                  className="inline-flex flex-1 items-center justify-center rounded-xl bg-brand-secondary px-4 py-3 text-sm font-bold text-white transition hover:bg-brand-secondary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-secondary"
                >
                  {boat.bookCtaLabel ?? `Book the ${boat.title}`}
                </button>
                <Link
                  href={`/experiences/${boat.slug}`}
                  className="inline-flex flex-1 items-center justify-center rounded-xl border-2 border-brand-dark/10 px-4 py-3 text-sm font-semibold text-brand-dark transition hover:border-brand-primary hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                >
                  View Details
                </Link>
              </div>
            </div>
          </motion.article>
        ))}
      </div>

      <p className="mx-auto mt-10 max-w-2xl text-center text-sm leading-relaxed text-brand-muted">
        Not sure which boat fits your group?{" "}
        <a
          href={brand.phoneTel ? `tel:${brand.phoneTel}` : "/contact"}
          className="font-semibold text-brand-primary hover:underline"
        >
          Call {brand.phone}
        </a>{" "}
        and we&apos;ll match you in two minutes. Running a group of 20, 30, or 40+? We send the
        full fleet out together.
      </p>
      </div>
      <div
        className="pointer-events-none h-64 sm:h-80 lg:h-[22rem]"
        style={{
          background:
            "linear-gradient(180deg, #ffffff 0%, var(--brand-bg) 12%, color-mix(in srgb, var(--brand-bg) 72%, var(--brand-dark) 28%) 28%, color-mix(in srgb, var(--brand-bg) 42%, var(--brand-dark) 58%) 48%, color-mix(in srgb, var(--brand-bg) 18%, var(--brand-dark) 82%) 70%, var(--brand-dark) 100%)",
        }}
        aria-hidden
      />
    </section>
  );
}
