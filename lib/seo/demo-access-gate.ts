import type { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE_NAME } from "@/lib/admin-auth-constants";
import { shouldBlockSearchIndexing } from "@/lib/seo/block-search-indexing";

const COOKIE_NAME = "demo_access";

/** Secret link gate for sales demos (set DEMO_ACCESS_KEY on Netlify). */
export function getDemoAccessKey(): string | null {
  if (!shouldBlockSearchIndexing()) return null;
  const key = process.env.DEMO_ACCESS_KEY?.trim();
  return key || null;
}

export function demoAccessPathExcluded(pathname: string): boolean {
  const p = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/.netlify/") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/favicon") ||
    pathname === "/site.webmanifest" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    /\.(svg|png|jpe?g|webp|gif|ico|json|webmanifest|woff2?|ttf|eot|txt|xml|map)$/i.test(pathname) ||
    p === "/login" ||
    p.startsWith("/admin") ||
    p.startsWith("/api/admin")
  );
}

export function hasValidDemoAccess(request: NextRequest, key: string): boolean {
  if (request.cookies.get(COOKIE_NAME)?.value === key) return true;
  // Signed-in admins (no public access cookie) must still prefetch/navigate the marketing site.
  if (request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value) return true;
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
