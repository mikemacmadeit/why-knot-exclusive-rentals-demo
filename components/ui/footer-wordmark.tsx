"use client";

import Link from "next/link";
import Image from "next/image";
import { Facebook, Instagram, Music2, Youtube } from "lucide-react";
import { brand } from "@/content/brand";
import { siteConfig } from "@/config/site";
import {
  getMarinaMeetNote,
  getPublicAreaLabel,
  getPublicPhone,
  getVerifiedHours,
} from "@/lib/seo/public-contact";
import { hasFeature } from "@/lib/plan";
import { SocialTooltip, type SocialItem } from "@/components/ui/social-media";

const linkClass =
  "whitespace-nowrap text-sm font-semibold text-white transition-colors hover:text-brand-secondary";

const headingClass =
  "font-display text-sm font-semibold uppercase tracking-[0.18em] text-brand-secondary";

/**
 * Glass footer over Keys water — same layout as the dusk wordmark footer,
 * with Why Knot trips, teal accents, and a white lockup on navy.
 */
export function FooterWordmark() {
  const currentYear = new Date().getFullYear();
  const phone = getPublicPhone();
  const areaLabel = getPublicAreaLabel();
  const marinaNote = getMarinaMeetNote();
  const hours = getVerifiedHours();

  const experienceLinks = [
    { href: "/experiences", label: "Our Trips" },
    { href: "/experiences/pontoon", label: "Boat Rental" },
    { href: "/experiences/watersports", label: "Fishing Charters" },
    { href: "/experiences/sunset", label: "Sandbar & Snorkel" },
    ...(hasFeature("packages") ? [{ href: "/packages", label: "Packages" }] : []),
  ];

  const companyLinks = [
    { href: "/our-story", label: "Our Story" },
    { href: "/faqs", label: "FAQs" },
    { href: "/location", label: "Location" },
    { href: "/contact", label: "Contact" },
    ...(hasFeature("blogStudio") ? [{ href: "/blog", label: siteConfig.nav.blogLabel }] : []),
  ];

  const isUsableSocialUrl = (href: string | undefined) => {
    const u = (href ?? "").trim();
    if (!u) return false;
    try {
      const parsed = new URL(u);
      return parsed.pathname !== "/" && parsed.pathname !== "";
    } catch {
      return false;
    }
  };

  const socialLinks: SocialItem[] = (
    [
      {
        href: brand.socials.instagram,
        ariaLabel: "Instagram",
        tooltip: "Instagram",
        icon: Instagram,
        color: "#E4405F",
      },
      {
        href: brand.socials.facebook,
        ariaLabel: "Facebook",
        tooltip: "Facebook",
        icon: Facebook,
        color: "#1877F2",
      },
      {
        href: brand.socials.youtube,
        ariaLabel: "YouTube",
        tooltip: "YouTube",
        icon: Youtube,
        color: "#FF0000",
      },
      {
        href: brand.socials.tiktok,
        ariaLabel: "TikTok",
        tooltip: "TikTok",
        icon: Music2,
        color: "#010101",
      },
    ] satisfies Array<SocialItem>
  ).filter((s) => isUsableSocialUrl(s.href));

  return (
    <footer className="relative overflow-hidden bg-brand-dark text-white" role="contentinfo">
      <Image
        src="/photos/whyknot/hero.jpg"
        alt=""
        fill
        unoptimized
        sizes="100vw"
        className="object-cover object-[30%_70%] brightness-[0.4]"
      />
      <div className="absolute inset-0 bg-brand-dark/60" aria-hidden />
      <div
        className="absolute inset-0 bg-gradient-to-b from-brand-dark/85 via-brand-dark/45 to-brand-dark/92"
        aria-hidden
      />

      <div className="relative z-10 px-4 pt-10 sm:px-6 sm:pt-12 lg:px-8 lg:pt-14">
        <p
          aria-hidden
          className="select-none text-center font-display text-[11vw] font-extrabold leading-none tracking-[-0.04em] text-white/25 sm:text-[9vw] lg:text-[8.5rem] [-webkit-text-stroke:2px_rgba(255,255,255,0.7)]"
        >
          THE KEYS
        </p>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-5 pb-16 pt-4 sm:px-8 lg:px-10 lg:pb-20 lg:pt-6">
        <div className="flex flex-col gap-12 rounded-3xl bg-brand-dark/75 px-6 py-8 shadow-[0_20px_60px_rgba(0,0,0,0.35)] ring-1 ring-white/10 backdrop-blur-md sm:px-8 sm:py-10 lg:flex-row lg:justify-between lg:gap-16">
          <div className="flex max-w-sm flex-col justify-between gap-8">
            <div className="flex flex-col gap-4">
              <Link href="/" className="flex w-fit items-center" aria-label={`${brand.companyName} home`}>
                <Image
                  src={brand.logoNavbarPath || brand.logoDarkPath || brand.logoPath}
                  alt={brand.logoAlt}
                  width={220}
                  height={72}
                  className="h-16 w-auto object-contain object-left sm:h-[4.5rem]"
                  unoptimized
                />
              </Link>
              <p className="text-base leading-relaxed text-white">
                {brand.tagline} From Tavernier in the Florida Keys — USCG licensed captains.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              {socialLinks.length > 0 ? (
                <SocialTooltip items={socialLinks} className="justify-start gap-3" />
              ) : null}
              <p className="text-xs text-white/80">
                ©{currentYear} {brand.companyName}. All rights reserved.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 sm:gap-14">
            <div className="flex flex-col gap-4">
              <h2 className={headingClass}>Experiences</h2>
              <nav className="flex flex-col gap-2.5" aria-label="Experiences">
                {experienceLinks.map((link) => (
                  <Link key={link.href} className={linkClass} href={link.href}>
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="flex flex-col gap-4">
              <h2 className={headingClass}>Company</h2>
              <nav className="flex flex-col gap-2.5" aria-label="Company">
                {companyLinks.map((link) => (
                  <Link key={link.href} className={linkClass} href={link.href}>
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="col-span-2 flex flex-col gap-4 sm:col-span-1">
              <h2 className={headingClass}>Contact</h2>
              <div className="flex flex-col items-start gap-2 text-sm">
                {phone ? (
                  <a href={`tel:${phone.tel}`} className={linkClass}>
                    {phone.display}
                  </a>
                ) : null}
                <a href={`mailto:${brand.email}`} className={linkClass}>
                  {brand.email}
                </a>
                <p className="text-sm font-medium text-white">{areaLabel}</p>
                <p className="max-w-[16rem] text-sm text-white/85">{marinaNote}</p>
                {hours ? <p className="text-sm text-white/85">{hours}</p> : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

export const Component = FooterWordmark;
