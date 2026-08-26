import type { NextRequest } from "next/server";
import { shouldBlockSearchIndexing } from "@/lib/seo/block-search-indexing";

const COOKIE_NAME = "demo_access";

/** Secret link gate for sales demos (set DEMO_ACCESS_KEY on Netlify). */
export function getDemoAccessKey(): string | null {
  if (!shouldBlockSearchIndexing()) return null;
  const key = process.env.DEMO_ACCESS_KEY?.trim();
  return key || null;
}

export function demoAccessPathExcluded(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/favicon") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".webp")
  );
}

export function hasValidDemoAccess(request: NextRequest, key: string): boolean {
  if (request.cookies.get(COOKIE_NAME)?.value === key) return true;
  return request.nextUrl.searchParams.get("access") === key;
}

export function demoAccessCookieOptions(key: string) {
  return {
    name: COOKIE_NAME,
    value: key,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 90,
    path: "/",
  };
}
