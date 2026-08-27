import { brand } from "@/content/brand";
import { bookingEnv } from "./env";
import {
  EMAIL_BG,
  EMAIL_BLACK,
  EMAIL_BORDER,
  EMAIL_CTA,
  EMAIL_LIGHT_BLUE,
  EMAIL_MUTED,
  EMAIL_NAVY,
  EMAIL_ORANGE,
  EMAIL_WHITE,
  EMAIL_TEAL,
  EMAIL_ACCENT,
} from "./email-palette";

export {
  EMAIL_BG,
  EMAIL_BLACK,
  EMAIL_BORDER,
  EMAIL_CTA,
  EMAIL_LIGHT_BLUE,
  EMAIL_MUTED,
  EMAIL_NAVY,
  EMAIL_ORANGE,
  EMAIL_WHITE,
  EMAIL_TEAL,
  EMAIL_ACCENT,
};

/**
 * Logo display width. Gmail iOS often ignores CSS max-width and uses HTML width.
 * Keep narrow enough for ~320px phones after side padding. Height stays auto.
 */
export const EMAIL_LOGO_WIDTH_PX = 200;

export function getEmailLogoUrl(): string {
  const base = bookingEnv.appBaseUrl.replace(/\/$/, "");
  const path = brand.logoEmailPath?.startsWith("/")
    ? brand.logoEmailPath
    : `/${brand.logoEmailPath || "logo.png"}`;
  return `${base}${path}`;
}

export function renderEmailLogoImg(): string {
  const src = getEmailLogoUrl();
  const w = EMAIL_LOGO_WIDTH_PX;
  const alt = brand.companyName.replace(/"/g, "&quot;");
  return `<table role="presentation" align="center" border="0" cellspacing="0" cellpadding="0" class="email-logo-wrap" style="margin:0 auto;">
  <tr>
    <td align="center" style="padding:0;font-size:0;line-height:0;">
      <img src="${src}" alt="${alt}" width="${w}" class="email-logo" style="display:block;border:0;outline:none;text-decoration:none;width:${w}px;max-width:100%;height:auto;-ms-interpolation-mode:bicubic;" />
    </td>
  </tr>
</table>`;
}

/**
 * Header: solid navy field with orange top accent + teal bottom accent, white subtitle.
 * Matches site theme tokens; no CSS gradients.
 */
export function renderEmailHeaderCell(subtitleHtml: string): string {
  return `<td align="center" bgcolor="${EMAIL_NAVY}" style="padding:0;background-color:${EMAIL_NAVY};">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td bgcolor="${EMAIL_ORANGE}" height="4" style="height:4px;line-height:4px;font-size:0;background-color:${EMAIL_ORANGE};">&nbsp;</td>
    </tr>
    <tr>
      <td align="center" bgcolor="${EMAIL_NAVY}" style="background-color:${EMAIL_NAVY};padding:28px 24px 22px;text-align:center;">
        ${renderEmailLogoImg()}
        <p style="margin:14px 0 0;font-size:13px;letter-spacing:0.04em;line-height:1.4;color:${EMAIL_WHITE};">${subtitleHtml}</p>
      </td>
    </tr>
    <tr>
      <td bgcolor="${EMAIL_LIGHT_BLUE}" height="4" style="height:4px;line-height:4px;font-size:0;background-color:${EMAIL_LIGHT_BLUE};">&nbsp;</td>
    </tr>
  </table>
</td>`;
}

export const EMAIL_HEAD_EXTRAS = `<meta name="x-apple-disable-message-reformatting"><style type="text/css">@media only screen and (max-width:480px){.email-logo{width:168px!important;}}</style>`;
