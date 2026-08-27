"use client";

import { createContext, useContext, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  List,
  Ship,
  Calendar,
  BookOpen,
  Users,
  DollarSign,
  Mail,
  LogOut,
  Menu,
  X,
  Tag,
  FileSignature,
  FileText,
  ClipboardList,
  AlertTriangle,
  UserCog,
  Plug,
  Megaphone,
} from "lucide-react";
import { brand } from "@/content/brand";
import { cn } from "@/lib/utils";
import { notifyAdminAuthChanged } from "@/lib/admin-auth-client";
import { PlatformDevBanner } from "@/components/site/PlatformDevBanner";
import { ADMIN_NAV_FEATURE, hasFeature } from "@/lib/plan";
import { canAccessAdminPath, adminRoleLabel, type AdminRole } from "@/lib/admin/roles";

type AdminPrincipalContextValue = {
  role: AdminRole | null;
  displayName: string | null;
  email: string | null;
};

const AdminPrincipalContext = createContext<AdminPrincipalContextValue>({
  role: null,
  displayName: null,
  email: null,
});

export function useAdminPrincipal(): AdminPrincipalContextValue {
  return useContext(AdminPrincipalContext);
}

const navGroups: {
  label: string;
  links: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
}[] = [
  {
    label: "Overview",
    links: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Content",
    links: [
      { href: "/admin/experiences", label: "Listings", icon: List },
      { href: "/admin/boats", label: "Boats", icon: Ship },
      { href: "/admin/blog", label: "Blog Studio", icon: FileText },
    ],
  },
  {
    label: "Business",
    links: [
      { href: "/admin/calendars", label: "Calendar", icon: Calendar },
      { href: "/admin/bookings", label: "Bookings", icon: BookOpen },
      { href: "/admin/waivers", label: "Waivers", icon: FileSignature },
      { href: "/admin/discounts", label: "Discounts", icon: Tag },
      { href: "/admin/customers", label: "Customers", icon: Users },
      { href: "/admin/financials", label: "Financials", icon: DollarSign },
      { href: "/admin/ads", label: "Ads", icon: Megaphone },
      { href: "/admin/emails", label: "Email notifications", icon: Mail },
      { href: "/admin/integrations", label: "Marketplace Sync", icon: Plug },
      { href: "/admin/team", label: "Team", icon: UserCog },
    ],
  },
  {
    label: "Activity",
    links: [
      { href: "/admin/audit", label: "Audit log", icon: ClipboardList },
      { href: "/admin/system-alerts", label: "System alerts", icon: AlertTriangle },
    ],
  },
];

function navLinkAllowed(href: string, role: AdminRole | null): boolean {
  const feature = ADMIN_NAV_FEATURE[href];
  if (feature != null && !hasFeature(feature)) return false;
  if (role && !canAccessAdminPath(role, href)) return false;
  return true;
}

function isActive(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

function NavLinks({
  pathname,
  role,
  onLinkClick,
}: {
  pathname: string | null;
  role: AdminRole | null;
  onLinkClick?: () => void;
}) {
  if (role === "captain") {
    const captainLinks = [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/calendars", label: "Calendar", icon: Calendar },
    ];
    return (
      <div className="flex flex-col gap-0.5">
        {captainLinks.map(({ href, label, icon: Icon }) => {
          const active = isActive(href, pathname);
          return (
            <Link
              key={href}
              href={href}
              onClick={onLinkClick}
              className={cn(
                "rounded-xl px-3 py-2.5 text-sm font-medium transition-all min-h-[44px] flex items-center gap-3",
                active
                  ? "bg-brand-secondary text-brand-dark shadow-sm"
                  : "text-white hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className={cn("h-5 w-5 shrink-0", active ? "text-brand-dark" : "text-white")} aria-hidden />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <>
      {navGroups.map((group) => {
        const links = group.links.filter((link) => navLinkAllowed(link.href, role));
        if (links.length === 0) return null;
        return (
          <div key={group.label} className="mb-6 last:mb-0">
            <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/80">
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {links.map(({ href, label, icon: Icon }) => {
                const active = isActive(href, pathname);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onLinkClick}
                    className={cn(
                      "rounded-xl px-3 py-2.5 text-sm font-medium transition-all min-h-[44px] flex items-center gap-3",
                      active
                        ? "bg-brand-secondary text-brand-dark shadow-sm"
                        : "text-white hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <Icon className={cn("h-5 w-5 shrink-0", active ? "text-brand-dark" : "text-white")} aria-hidden />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}

export function AdminShell({
  children,
  role = null,
  displayName = null,
  email = null,
}: {
  children: React.ReactNode;
  role?: AdminRole | null;
  displayName?: string | null;
  email?: string | null;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <AdminPrincipalContext.Provider value={{ role, displayName, email }}>
      <div className="flex flex-col min-h-screen bg-slate-50">
        <PlatformDevBanner />
        <header className="lg:hidden sticky top-0 z-30 flex h-14 items-center gap-3 bg-brand-dark border-b border-white/15 px-4 shrink-0">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-white/80 hover:bg-white/10 transition-colors"
          >
            <Menu className="h-6 w-6" aria-hidden />
          </button>
          <Link href="/" prefetch={false} className="flex items-center min-w-0">
            <Image
              src={brand.logoNavbarPath ?? brand.logoPath}
              alt={brand.logoAlt}
              width={140}
              height={32}
              className="h-8 w-auto max-w-[160px] object-contain"
              unoptimized
            />
          </Link>
        </header>

        <div className="flex flex-1 min-h-0">
          <div
            className={cn(
              "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity lg:hidden",
              sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
            )}
            onClick={() => setSidebarOpen(false)}
            role="presentation"
            aria-hidden
          />
          <aside
            className={cn(
              "fixed top-0 left-0 z-50 flex h-full w-72 max-w-[85vw] flex-col bg-brand-dark shadow-2xl transition-transform duration-200 ease-out lg:static lg:z-0 lg:h-auto lg:w-64 lg:shrink-0 lg:translate-x-0 lg:shadow-none",
              "border-r border-white/15",
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}
          >
            <div className="relative border-b border-white/10 px-4 py-4">
              <Link
                href="/"
                prefetch={false}
                className="flex w-full items-center justify-center rounded-xl p-1 hover:bg-white/5 transition-colors"
                aria-label={`${brand.logoAlt} home`}
              >
                <Image
                  src={brand.logoNavbarPath ?? brand.logoPath}
                  alt={brand.logoAlt}
                  width={220}
                  height={56}
                  className="h-auto w-full max-w-full object-contain"
                  unoptimized
                  priority
                />
              </Link>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-white/80 hover:bg-white/10 hover:text-white lg:hidden transition-colors"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-4 flex flex-col min-h-0">
              <NavLinks pathname={pathname} role={role} onLinkClick={() => setSidebarOpen(false)} />
            </nav>
            <div className="mt-auto border-t border-white/10 p-4 shrink-0">
              <p className="mb-3 px-3 text-xs text-white/70">
                <span className="block truncate font-medium text-white">{brand.companyName}</span>
                {displayName ? (
                  <>
                    <span className="mt-1 block truncate text-white/80">{displayName}</span>
                    <span className="block truncate">{adminRoleLabel(role)}</span>
                  </>
                ) : (
                  <span className="block truncate">{adminRoleLabel(role)}</span>
                )}
              </p>
              <button
                type="button"
                className="w-full rounded-xl px-3 py-2.5 text-sm font-medium text-white hover:bg-white/10 text-left min-h-[44px] flex items-center gap-3 transition-colors"
                onClick={async () => {
                  try {
                    await fetch("/api/admin/logout", {
                      method: "POST",
                      credentials: "include",
                      redirect: "manual",
                    });
                  } catch {
                    // still clear UI in other tabs
                  }
                  notifyAdminAuthChanged();
                  window.location.href = "/admin/login";
                }}
              >
                <LogOut className="h-5 w-5 shrink-0 text-white/80" aria-hidden />
                Sign out
              </button>
            </div>
          </aside>

          <main className="min-w-0 flex-1 overflow-auto py-6 px-4 sm:py-8 sm:px-6 lg:px-8">
            <div
              className={cn(
                "mx-auto w-full",
                pathname === "/admin" ||
                  (pathname &&
                    [
                      "/admin/calendars",
                      "/admin/emails",
                      "/admin/financials",
                      "/admin/ads",
                      "/admin/customers",
                      "/admin/integrations",
                      "/admin/bookings",
                      "/admin/waivers",
                    ].some((p) => pathname.includes(p)))
                  ? "max-w-none"
                  : "max-w-4xl"
              )}
            >
              {children}
            </div>
          </main>
        </div>
      </div>
    </AdminPrincipalContext.Provider>
  );
}
