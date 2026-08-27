"use client";

import { homepageCopy } from "@/content/homepage";
import { useBookingModal } from "@/components/site/BookingModalContext";
import { analytics } from "@/lib/analytics";
import { getPublicPhone } from "@/lib/seo/public-contact";
import { CtaCard } from "@/components/ui/cta-card";
import { LinkPreview } from "@/components/ui/link-preview";

const copy = homepageCopy.finale;

/**
 * Closing CTA — 21st.dev lavikatiyar/cta-card (photo + copy overlap),
 * replacing the previous gallery CTA.
 */
export function WakeFinale() {
  const { setOpen } = useBookingModal();
  const phone = getPublicPhone();

  return (
    <section
      className="relative overflow-hidden bg-white px-5 py-20 sm:px-8 sm:py-24 lg:px-14 xl:px-20"
      aria-label={copy.h2}
    >
      <div className="relative mx-auto max-w-6xl">
        <CtaCard
          eyebrow={copy.eyebrow}
          title={copy.h2}
          description={
            <>
              <LinkPreview
                url="/experiences/pontoon"
                isStatic
                imageSrc="/photos/whyknot/boat-day.png"
                width={240}
                height={150}
                className="font-bold text-brand-dark"
              >
                Boat rental
              </LinkPreview>
              ,{" "}
              <LinkPreview
                url="/experiences/watersports"
                isStatic
                imageSrc="/photos/whyknot/catch-swordfish.jpg"
                width={240}
                height={150}
                className="font-bold text-brand-dark"
              >
                fishing charter
              </LinkPreview>
              , or{" "}
              <LinkPreview
                url="/experiences/sunset"
                isStatic
                imageSrc="/photos/whyknot/sandbar-cheers.jpg"
                width={240}
                height={150}
                className="font-bold text-brand-dark"
              >
                sandbar &amp; snorkel
              </LinkPreview>{" "}
              — reserve your day in the Florida Keys. USCG-licensed captains on captained trips.
            </>
          }
          primaryLabel={copy.primaryCta}
          onPrimaryClick={() => {
            analytics.bookCtaClick("finale", "home");
            setOpen(true);
          }}
          secondaryLabel={phone ? `Call ${phone.display}` : undefined}
          secondaryHref={phone ? `tel:${phone.tel}` : undefined}
          onSecondaryClick={phone ? () => analytics.callClick("finale", "home") : undefined}
          hint="Secure your date online · Text or call for same-day questions"
          imageSrc="/photos/whyknot/bougie-girl.jpg"
          imageAlt={copy.imageAlt}
        />
      </div>
    </section>
  );
}
