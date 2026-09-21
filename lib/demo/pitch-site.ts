/**
 * Sales / pitch Netlify sites (`DEMO_PITCH_SITE=1`) should not run live-booking jobs.
 */

export function envFlagTruthy(raw: string | undefined): boolean {
  const v = raw?.trim().toLowerCase() ?? "";
  return v === "1" || v === "true" || v === "yes";
}

export function isPitchDemoSite(): boolean {
  return envFlagTruthy(process.env.DEMO_PITCH_SITE);
}
