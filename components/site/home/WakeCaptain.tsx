"use client";

import { motion } from "framer-motion";
import { Compass, Shield, Users } from "lucide-react";
import { brand } from "@/content/brand";
import { homepageCopy } from "@/content/homepage";
import { BookingCTA } from "@/components/site/BookingCTA";
import { useBookingModal } from "@/components/site/BookingModalContext";

const points = [
  {
    icon: Users,
    title: "You're a guest, not a driver.",
    body: "Everyone in your group gets the same day. Nobody's stuck working.",
  },
  {
    icon: Compass,
    title: "Local knowledge you can't book online.",
    body: "Sandbars, reefs, wrecks, and backcountry — plus the spots that never make the map.",
  },
  {
    icon: Shield,
    title: "Safety handled.",
    body: "Full briefing before departure, certified captain aboard, required gear stocked and checked.",
  },
];

export function WakeCaptain() {
  const { setOpen } = useBookingModal();

  return (
    <section
      id="captain"
      className="bg-brand-dark px-5 py-20 sm:px-8 sm:py-24 lg:px-14 xl:px-20"
      aria-label="Captained Florida Keys charters"
    >
      <div className="mx-auto max-w-6xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-primary">
          Included with every charter
        </p>
        <h2 className="mt-2 max-w-3xl font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
          {homepageCopy.captain.h2}
        </h2>
        <div className="mt-6 max-w-3xl space-y-4 text-base leading-relaxed text-white/70 sm:text-lg">
          <p>
            The Florida Keys stretch for more than 100 miles of reefs, mangroves, and open water.
            Conditions change fast, and the best sandbar or bite is rarely the one on a tourist map.
          </p>
          <p>
            That&apos;s why {brand.companyName} captained charters run with a USCG-licensed
            captain — not as a rule we impose, but as the reason your day actually works. Fish,
            snorkel, or sit back. Nobody in your group is stuck behind the wheel unless they want
            to be.
          </p>
          <p>
            Captain Braxton is a Keys local. He knows which sandbar is empty, where the reef is
            running, and how to keep the day smooth from dock to dock.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {points.map((point, i) => (
            <motion.article
              key={point.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: i * 0.06 }}
              className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-6"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-primary/20 text-brand-primary">
                <point.icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-4 font-display text-lg font-extrabold text-white">{point.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/65">{point.body}</p>
            </motion.article>
          ))}
        </div>

        <p className="mt-8 max-w-3xl text-sm leading-relaxed text-white/55 sm:text-base">
          Prefer to drive? Boat rentals let you be your own captain. Want to relax? We&apos;ll
          quote a captained trip before you book — no surprises at the dock.
        </p>

        <div className="mt-8 max-w-md">
          <BookingCTA
            source="captain"
            page="home"
            variant="primary"
            onDark
            callPinkOnDark
            showCall={false}
            onBookNowClick={() => setOpen(true)}
            className="w-full"
            primaryLabel="Book a Captained Charter"
            primaryHint=""
          />
        </div>
      </div>
    </section>
  );
}
