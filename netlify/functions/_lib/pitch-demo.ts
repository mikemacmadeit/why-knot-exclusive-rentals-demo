/** Immediate 200 so pitch scheduled functions do not call booking APIs. */

function envFlagTruthy(raw: string | undefined): boolean {
  const v = raw?.trim().toLowerCase() ?? "";
  return v === "1" || v === "true" || v === "yes";
}

export function skipPitchScheduled(name: string): { statusCode: number; body: string } | null {
  if (!envFlagTruthy(process.env.DEMO_PITCH_SITE)) return null;
  console.log(`[${name}] skipped (DEMO_PITCH_SITE)`);
  return {
    statusCode: 200,
    body: JSON.stringify({ skipped: true, reason: "DEMO_PITCH_SITE" }),
  };
}
