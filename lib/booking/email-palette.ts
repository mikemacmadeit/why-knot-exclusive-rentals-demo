/**
 * Email color tokens from siteConfig.theme — safe for client and server.
 * Keep Node-only helpers (logo URL via bookingEnv) in email-brand.ts.
 */

import { siteConfig } from "@/config/site";

const theme = siteConfig.theme;

/** Solid brand palette for transactional emails (no gradients — email clients mangle them). */
export const EMAIL_NAVY = theme.darkColor || "#0a1628";
export const EMAIL_LIGHT_BLUE = theme.primaryColor || "#00b4d8";
export const EMAIL_ORANGE = theme.secondaryColor || "#ff6b2b";
export const EMAIL_WHITE = "#ffffff";
export const EMAIL_BLACK = theme.textColor || "#1a2535";
export const EMAIL_BG = theme.backgroundColor || "#f7f9fc";
export const EMAIL_MUTED = theme.mutedColor || "#7a8899";
/** Primary CTA fill (Book Now orange on Wakebusters). */
export const EMAIL_CTA = EMAIL_ORANGE;
/** Soft border using navy at low opacity (email-safe). */
export const EMAIL_BORDER = "rgba(10,22,40,0.08)";

/** @deprecated Use EMAIL_LIGHT_BLUE */
export const EMAIL_TEAL = EMAIL_LIGHT_BLUE;
/** @deprecated Use EMAIL_ORANGE */
export const EMAIL_ACCENT = EMAIL_ORANGE;
