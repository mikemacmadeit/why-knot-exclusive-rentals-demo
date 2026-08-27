"use client";

import { motion } from "motion/react";
import { Star } from "lucide-react";
import TestimonialMarquee from "@/components/ui/marquee-01";
import { testimonials } from "@/content/testimonials";
import { homepageCopy } from "@/content/homepage";
import { location, reviewCountLabel } from "@/content/location";

export function WakeMarquee() {
  return (
    <section
      id="reviews"
      className="relative w-full overflow-hidden bg-brand-bg py-20 sm:py-24"
      aria-label="Guest reviews"
    >
      <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true }}
          className="flex flex-col items-center justify-center"
        >
          <div className="rounded-lg border border-brand-dark/15 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
            {homepageCopy.reviews.eyebrow}
          </div>
          <h2 className="mt-5 font-display text-xl font-bold tracking-tighter text-brand-dark sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl">
            {homepageCopy.reviews.h2}
          </h2>
          <p className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-dark sm:text-base">
            <span className="inline-flex gap-0.5" aria-hidden>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
              ))}
            </span>
            {location.rating}.0 · {reviewCountLabel()}
          </p>
          <p className="mt-2 text-sm text-brand-muted sm:text-base">{homepageCopy.reviews.stats}</p>
        </motion.div>
      </div>

      <div className="mt-10 w-full">
        <TestimonialMarquee
          reviews={testimonials.map((t) => ({
            name: t.author,
            username: t.when ?? "Guest",
            body: t.quote,
          }))}
        />
      </div>
    </section>
  );
}
