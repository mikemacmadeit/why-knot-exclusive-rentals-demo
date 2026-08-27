"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAdminPrincipal } from "./AdminShell";
import { CaptainDashboardClient } from "@/components/admin/CaptainDashboardClient";
import { cn } from "@/lib/utils";
import { getAdminBookingStatusBadgeClass } from "@/lib/admin/admin-booking-status-badge";
import { MarketplaceSourceBadge } from "@/components/admin/MarketplaceSourceBadge";
import { hasFeature } from "@/lib/plan";
import {
  DollarSign,
  Calendar,
  Users,
  BookOpen,
  List,
  TrendingUp,
  TrendingDown,
  Ship,
  Mail,
  ChevronRight,
  Sparkles,
  Activity,
} from "lucide-react";

type DashboardStats = {
  hideFinancials?: boolean;
  totalRevenueCents: number;
  revenueThisMonthCents: number;
  revenueLastMonthCents: number;
  /** Firestore count of bookings whose status holds slot inventory. */
  slotTakenBookingsCount: number;
  slotTakenBookingStatuses: string[];
  /** `summaries/revenue` bookingCount — increments with revenue attribution, not raw doc volume. */
  summaryIncrementedBookingCount: number;
  /** Count of admin_cancel_summary_adjustment_skipped alerts in operationalAlerts (last 30 days). */
  adminCancelSummaryAdjustmentSkippedCount?: number;
  uniqueCustomerCount: number;
  listingCount: number;
  /** Booking confirmation emails stuck in notification outbox (dead letter). Resend via booking admin. */
  confirmationDeadLetterCount?: number;
  /** Last-500 sample: slot-taken bookings missing boatId where per-boat occupancy applies (shared ticketed excluded). */
  recentBookingsMissingBoatId?: number;
  recentBookings: {
    id: string;
    createdAt: string;
    customerEmail: string;
    customerName: string;
    totalCents: number;
    status: string;
    experienceName: string;
    source?: string | null;
    externalProvider?: string | null;
    externalBookingId?: string | null;
    externalListingName?: string | null;
    externalKey?: string | null;
    marketplaceDetails?: Record<string, string> | null;
    marketplaceEmailExcerpt?: string | null;
  }[];
  upcomingBookings: {
    id: string;
    tripDateStr: string;
    timeLabel: string;
    experienceName: string;
    customerName: string;
    customerEmail: string;
    totalCents: number;
    source?: string | null;
    externalProvider?: string | null;
    externalBookingId?: string | null;
    externalListingName?: string | null;
    externalKey?: string | null;
    marketplaceDetails?: Record<string, string> | null;
    marketplaceEmailExcerpt?: string | null;
  }[];
  notificationOutboxStats?: {
    byType: {
      booking_confirmation: { pending: number; deadLetter: number; stuckClaims: number };
      final_charge_success: { pending: number; deadLetter: number; stuckClaims: number };
      discount_limit_exceeded_notification: { pending: number; deadLetter: number; stuckClaims: number };
      waiver_invite_send: { pending: number; deadLetter: number; stuckClaims: number };
    };
    staleClaimCountsByTemplate: Record<string, number>;
    deadLetterTotal: number;
    pendingTotal: number;
    stuckClaimsTotal: number;
  };
};

function dashboardMarketplaceBooking(b: {
  customerEmail: string;
  source?: string | null;
  externalProvider?: string | null;
  externalBookingId?: string | null;
  externalListingName?: string | null;
  externalKey?: string | null;
  marketplaceDetails?: Record<string, string> | null;
  marketplaceEmailExcerpt?: string | null;
}) {
  return { ...b, customer: { email: b.customerEmail } };
}

function MetricCard({
  href,
  label,
  value,
  sub,
  icon: Icon,
  tone = "teal",
  trend,
}: {
  href: string;
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "teal" | "pink" | "navy" | "amber";
  trend?: { dir: "up" | "down" | "flat"; text: string };
}) {
  const toneClass =
    tone === "pink"
      ? "bg-brand-secondary/10 text-brand-secondary"
      : tone === "navy"
        ? "bg-brand-dark/10 text-brand-dark"
        : tone === "amber"
          ? "bg-amber-100 text-amber-800"
          : "bg-brand-primary/10 text-brand-primary";
  const barClass =
    tone === "pink"
      ? "from-brand-secondary to-brand-secondary/40"
      : tone === "amber"
        ? "from-amber-400 to-amber-200"
        : tone === "navy"
          ? "from-brand-dark to-brand-primary"
          : "from-brand-primary to-brand-primary/40";
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-2xl border border-brand-dark/10 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", barClass)} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-muted">{label}</p>
          <p className="mt-2 font-display text-2xl font-bold tracking-tight text-brand-dark sm:text-[1.65rem]">{value}</p>
          {sub ? <p className="mt-1 text-xs leading-relaxed text-brand-muted">{sub}</p> : null}
          {trend ? (
            <span
              className={cn(
                "mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                trend.dir === "up"
                  ? "bg-emerald-50 text-emerald-700"
                  : trend.dir === "down"
                    ? "bg-amber-50 text-amber-800"
                    : "bg-brand-dark/5 text-brand-muted"
              )}
            >
              {trend.dir === "up" && <TrendingUp className="h-3.5 w-3.5" aria-hidden />}
              {trend.dir === "down" && <TrendingDown className="h-3.5 w-3.5" aria-hidden />}
              {trend.text}
            </span>
          ) : null}
        </div>
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", toneClass)}>
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      </div>
      <ChevronRight className="absolute right-4 top-4 h-4 w-4 text-brand-muted opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
    </Link>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 sm:space-y-8 animate-pulse">
      <div className="h-40 rounded-3xl border border-slate-200 bg-white" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-2xl border border-brand-dark/10 bg-white" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-72 rounded-3xl border border-brand-dark/10 bg-white" />
        <div className="h-72 rounded-3xl border border-brand-dark/10 bg-white" />
      </div>
    </div>
  );
}

export default function AdminHomePage() {
  const { role } = useAdminPrincipal();
  if (role === "captain") return <CaptainDashboardClient />;
  return <OperatorAdminHomePage />;
}

function OperatorAdminHomePage() {
  const { displayName, role } = useAdminPrincipal();
  const firstName = displayName?.trim() || "there";
  const showFinancials = role !== "operator" && hasFeature("financials");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [healthResult, setHealthResult] = useState<Record<string, unknown> | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [headerNow, setHeaderNow] = useState<Date | null>(null);
  const checkBookingHealth = useCallback(() => {
    setHealthLoading(true);
    setHealthResult(null);
    fetch("/api/health", { credentials: "include" })
      .then(async (res) => ({ status: res.status, ...(await res.json().catch(() => ({}))) }))
      .then(setHealthResult)
      .catch((e) => setHealthResult({ error: e instanceof Error ? e.message : String(e) }))
      .finally(() => setHealthLoading(false));
  }, []);
  useEffect(() => {
    fetch("/api/admin/dashboard", { credentials: "include" })
      .then(async (res) => {
        const d = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = d.error ?? "Failed to load";
          const hint = d.hint;
          throw new Error(hint ? `${msg} ${hint}` : msg);
        }
        return d;
      })
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // Avoid SSR/CSR hydration mismatches from locale/timezone-dependent date rendering.
    setHeaderNow(new Date());
  }, []);

  function formatCents(cents: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(cents / 100);
  }

  function monthTrendInfo(thisMonth: number, lastMonth: number): { dir: "up" | "down" | "flat"; text: string } {
    const pct = lastMonth === 0 ? (thisMonth > 0 ? 100 : 0) : Math.round(((thisMonth - lastMonth) / lastMonth) * 100);
    const dir: "up" | "down" | "flat" = pct > 2 ? "up" : pct < -2 ? "down" : "flat";
    return { dir, text: `${pct > 0 ? "+" : ""}${pct}% vs last month` };
  }

  const greeting = (() => {
    if (!headerNow) return `Welcome back, ${firstName}`;
    const h = headerNow.getHours();
    if (h < 12) return `Good morning, ${firstName}`;
    if (h < 18) return `Good afternoon, ${firstName}`;
    return `Good evening, ${firstName}`;
  })();
  const dateLabel =
    headerNow?.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    }) ?? "Today";

  const quickActions: {
    href: string;
    label: string;
    sub: string;
    icon: React.ComponentType<{ className?: string }>;
    tone: "teal" | "pink" | "navy" | "amber";
    primary?: boolean;
  }[] = [
    { href: "/admin/experiences/new", label: "Create listing", sub: "New experience", icon: Sparkles, tone: "teal", primary: true },
    { href: "/admin/experiences", label: "Listings", sub: stats ? `${stats.listingCount} live` : "Manage", icon: List, tone: "navy" },
    { href: "/admin/boats", label: "Boats", sub: "Fleet & occupancy", icon: Ship, tone: "pink" },
    { href: "/admin/bookings", label: "Bookings", sub: "Trips & guests", icon: BookOpen, tone: "amber" },
    ...(showFinancials
      ? [{ href: "/admin/financials", label: "Financials", sub: "Revenue & payouts", icon: DollarSign, tone: "teal" as const }]
      : []),
    { href: "/admin/emails", label: "Emails", sub: "Templates & log", icon: Mail, tone: "navy" },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      {loading && <DashboardSkeleton />}

      {error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-800 shadow-sm">
          <p className="font-medium">{error}</p>
          {(error.includes("Unauthorized") || error.includes("not configured")) && (
            <Link href="/admin/login" className="mt-3 inline-block text-sm font-semibold text-brand-primary hover:underline">
              Sign in →
            </Link>
          )}
        </div>
      )}

      {!loading && stats && (
        <>
          <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white px-5 py-6 shadow-sm sm:px-8 sm:py-8">
            <div className="absolute inset-x-0 top-0 h-1 bg-brand-secondary" aria-hidden />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <h1 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-primary">Dashboard</h1>
                <p className="mt-3 font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                  {greeting}
                </p>
                <p className="mt-2 text-sm text-slate-500">{dateLabel}</p>
                {showFinancials ? (
                  <>
                    <p className="mt-4 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                      {formatCents(stats.totalRevenueCents)}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">All-time attributed revenue</p>
                  </>
                ) : (
                  <p className="mt-4 text-sm text-slate-600">Calendar, bookings, customers, and waivers</p>
                )}
              </div>
              <div className="flex flex-wrap gap-3 lg:justify-end">
                {showFinancials && (
                <div className="min-w-[140px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">This month</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{formatCents(stats.revenueThisMonthCents)}</p>
                  <p className="text-[11px] text-slate-500">Last {formatCents(stats.revenueLastMonthCents ?? 0)}</p>
                </div>
                )}
                <div className="min-w-[140px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Active bookings</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{stats.slotTakenBookingsCount.toLocaleString()}</p>
                  <p className="text-[11px] text-slate-500">Holding a slot</p>
                </div>
                <div className="min-w-[140px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Customers</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{stats.uniqueCustomerCount.toLocaleString()}</p>
                  <p className="text-[11px] text-slate-500">Last 500 bookings</p>
                </div>
                <div className="min-w-[140px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Listings</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{stats.listingCount.toLocaleString()}</p>
                  <p className="text-[11px] text-slate-500">Experiences</p>
                </div>
              </div>
            </div>
            <div className="relative mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
              <p className="max-w-xl text-xs leading-relaxed text-slate-500">
                {showFinancials
                  ? "Snapshot of revenue, upcoming trips, and recent bookings. Open Financials for date filters, platforms, and Stripe."
                  : "Upcoming trips and recent bookings. Dollar amounts are hidden for Operator accounts."}
              </p>
              {showFinancials && (
              <button
                type="button"
                onClick={checkBookingHealth}
                disabled={healthLoading}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-40"
              >
                <Activity className={cn("h-3.5 w-3.5", healthLoading && "animate-pulse")} aria-hidden />
                {healthLoading ? "Checking…" : "Check booking health"}
              </button>
              )}
            </div>
          </section>

          {showFinancials && healthResult != null && (
            <div className="space-y-3">
              {(healthResult as Record<string, unknown>).manageBookingSecret === "not_configured" && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900" role="alert">
                  <p className="font-semibold">MANAGE_BOOKING_SECRET not set</p>
                  <p className="mt-1 text-sm">
                    Receipt links, manage-booking links, and release-token signing are degraded or unavailable. Set MANAGE_BOOKING_SECRET in your environment so confirmation emails and customer links work correctly.
                  </p>
                </div>
              )}
              <div className="overflow-hidden rounded-3xl border border-brand-dark/10 bg-white p-4 font-mono text-xs text-brand-dark shadow-sm">
                <pre className="whitespace-pre-wrap break-words overflow-x-auto">{JSON.stringify(healthResult, null, 2)}</pre>
              </div>
            </div>
          )}

          {showFinancials && (stats.confirmationDeadLetterCount ?? 0) > 0 && (
            <div
              className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 sm:px-5 sm:py-4"
              role="status"
            >
              <p className="font-semibold">Confirmation emails need attention</p>
              <p className="mt-1 text-sm text-amber-900/95">
                {stats.confirmationDeadLetterCount} booking confirmation
                {stats.confirmationDeadLetterCount === 1 ? " is" : "s are"} in a failed queue (dead letter). Open the
                booking in{" "}
                <Link href="/admin/bookings" className="font-medium text-amber-950 underline underline-offset-2">
                  Bookings
                </Link>{" "}
                and use resend confirmation, or check operational alerts in Firestore.
              </p>
            </div>
          )}
          {showFinancials && (stats.adminCancelSummaryAdjustmentSkippedCount ?? 0) > 0 && (
            <div
              className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 sm:px-5 sm:py-4"
              role="alert"
            >
              <p className="font-semibold">Canceled bookings may have left revenue summaries overstated</p>
              <p className="mt-1 text-sm text-amber-900/95">
                {stats.adminCancelSummaryAdjustmentSkippedCount} recent{" "}
                <code className="rounded bg-amber-100/80 px-1 text-xs">admin_cancel_summary_adjustment_skipped</code>{" "}
                event{stats.adminCancelSummaryAdjustmentSkippedCount === 1 ? "" : "s"} in{" "}
                <code className="rounded bg-amber-100/80 px-1 text-xs">operationalAlerts</code> (last 30 days): a legacy or
                non-counter booking was canceled without decrementing summary revenue. Review those alerts and correct
                summaries if needed. Open{" "}
                <Link href="/admin/bookings" className="font-medium text-amber-950 underline underline-offset-2">
                  Bookings
                </Link>{" "}
                or Firestore operational alerts for details.
              </p>
            </div>
          )}
          {showFinancials && stats.notificationOutboxStats && (
            <div className="overflow-hidden rounded-3xl border border-brand-dark/10 bg-white px-5 py-4 text-sm shadow-sm sm:px-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-muted">Notification outbox</p>
              <p className="mt-2 text-brand-dark">
                Booking confirmations — pending: {stats.notificationOutboxStats.byType.booking_confirmation.pending}, dead
                letter: {stats.notificationOutboxStats.byType.booking_confirmation.deadLetter}, stuck claims:{" "}
                {stats.notificationOutboxStats.byType.booking_confirmation.stuckClaims}. Final-charge / waiver / discount
                rows also tracked in ops; see cron logs for full breakdown.
              </p>
            </div>
          )}
          {showFinancials && (stats.recentBookingsMissingBoatId ?? 0) > 0 && (
            <div
              className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-red-950 sm:px-5 sm:py-4"
              role="alert"
            >
              <p className="font-semibold">Bookings missing boat ID (per-boat occupancy)</p>
              <p className="mt-1 text-sm text-red-900/95">
                {stats.recentBookingsMissingBoatId} of the last 500 bookings (by creation time) are in a slot-taken status, have no{" "}
                <code className="rounded bg-red-100/80 px-1">boatId</code>, and are on experiences where a boat is required for calendar occupancy
                (charter listings, and ticketed departures booked as private charter). This count does{" "}
                <span className="font-medium">not</span> include shared ticketed tickets (pooled inventory; no per-boat{" "}
                <code className="rounded bg-red-100/80 px-1">boatId</code> on the booking). Open{" "}
                <Link href="/admin/backfill-tools" className="font-medium text-red-950 underline underline-offset-2">
                  Admin → Backfill tools
                </Link>{" "}
                to run a dry-run preview, then apply the boatId backfill after explicit confirmation. The API accepts{" "}
                <code className="rounded bg-red-100/80 px-1">{`{ "dryRun": true }`}</code> / preview via GET for read-only inspection, and{" "}
                <code className="rounded bg-red-100/80 px-1">{`{ "applyUpdates": true }`}</code> or{" "}
                <code className="rounded bg-red-100/80 px-1">{`{ "dryRun": false }`}</code> to write inferred{" "}
                <code className="rounded bg-red-100/80 px-1">boatId</code> on booking documents. You can also assign{" "}
                <code className="rounded bg-red-100/80 px-1">boatId</code> manually. See docs/BOOKING_AVAILABILITY.md.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {showFinancials && (
              <>
            <MetricCard
              href="/admin/financials"
              label="Revenue (all time)"
              value={formatCents(stats.totalRevenueCents)}
              icon={DollarSign}
              tone="teal"
            />
            <MetricCard
              href="/admin/financials"
              label="This month"
              value={formatCents(stats.revenueThisMonthCents)}
              sub={`Last month ${formatCents(stats.revenueLastMonthCents ?? 0)}`}
              trend={monthTrendInfo(stats.revenueThisMonthCents, stats.revenueLastMonthCents ?? 0)}
              icon={TrendingUp}
              tone="pink"
            />
              </>
            )}
            <MetricCard
              href="/admin/bookings"
              label="Bookings (slot-taken)"
              value={stats.slotTakenBookingsCount}
              sub={
                showFinancials
                  ? `Statuses: ${stats.slotTakenBookingStatuses.join(", ")}. Summary counter: ${stats.summaryIncrementedBookingCount}.`
                  : "Trips currently holding a slot"
              }
              icon={BookOpen}
              tone="navy"
            />
            <MetricCard
              href="/admin/customers"
              label="Recent customers"
              value={stats.uniqueCustomerCount}
              sub="Last 500 bookings, unique by email"
              icon={Users}
              tone="amber"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="overflow-hidden rounded-3xl border border-brand-dark/10 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-brand-dark/10 px-5 py-4 sm:px-6">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-brand-dark">
                  <Calendar className="h-5 w-5 text-brand-primary" aria-hidden />
                  Upcoming trips
                </h2>
                <Link
                  href="/admin/bookings"
                  className="text-sm font-medium text-brand-primary hover:underline"
                >
                  View all
                </Link>
              </div>
              <div className="min-h-[200px]">
                {Array.isArray(stats.upcomingBookings) && stats.upcomingBookings.length > 0 ? (
                  <ul className="divide-y divide-brand-dark/5">
                    {stats.upcomingBookings.slice(0, 7).map((b) => (
                      <li key={b.id}>
                        <Link
                          href={`/admin/bookings?highlight=${b.id}`}
                          className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-brand-bg/80 sm:px-6"
                        >
                          <div className="flex min-w-[4.5rem] flex-col">
                            <span className="text-sm font-medium text-brand-dark">
                              {new Date(b.tripDateStr + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                            </span>
                            <span className="text-xs text-brand-muted">{b.timeLabel}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="flex min-w-0 items-center gap-2">
                              <span className="truncate text-sm font-medium text-brand-dark">{b.experienceName}</span>
                              <MarketplaceSourceBadge
                                booking={dashboardMarketplaceBooking(b)}
                                className="px-1.5 py-0.5 text-[8px]"
                              />
                            </p>
                            <p className="truncate text-xs text-brand-muted">{b.customerName || b.customerEmail || "—"}</p>
                          </div>
                          {showFinancials ? (
                            <span className="text-sm font-bold text-brand-dark">{formatCents(b.totalCents)}</span>
                          ) : null}
                          <ChevronRight className="h-4 w-4 shrink-0 text-brand-muted" aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                    <Calendar className="h-12 w-12 text-brand-dark/20" aria-hidden />
                    <p className="mt-3 text-sm text-brand-muted">No trips in the next 7 days</p>
                    <Link href="/admin/bookings" className="mt-2 text-sm font-medium text-brand-primary hover:underline">
                      View bookings
                    </Link>
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-brand-dark/10 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-brand-dark/10 px-5 py-4 sm:px-6">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-brand-dark">
                  <BookOpen className="h-5 w-5 text-brand-primary" aria-hidden />
                  Recent bookings
                </h2>
                <Link
                  href="/admin/bookings"
                  className="text-sm font-medium text-brand-primary hover:underline"
                >
                  View all
                </Link>
              </div>
              <div className="min-h-[200px]">
                {stats.recentBookings && stats.recentBookings.length > 0 ? (
                  <ul className="divide-y divide-brand-dark/5">
                    {stats.recentBookings.slice(0, 6).map((b) => (
                      <li key={b.id}>
                        <Link
                          href={`/admin/bookings?highlight=${b.id}`}
                          className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-brand-bg/80 sm:px-6"
                        >
                          <span className="text-xs text-brand-muted">
                            {b.createdAt ? new Date(b.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }) : "—"}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="flex min-w-0 items-center gap-2">
                              <span className="truncate text-sm font-medium text-brand-dark">{b.experienceName}</span>
                              <MarketplaceSourceBadge
                                booking={dashboardMarketplaceBooking(b)}
                                className="px-1.5 py-0.5 text-[8px]"
                              />
                            </p>
                            <p className="truncate text-xs text-brand-muted">{b.customerName || b.customerEmail || "—"}</p>
                          </div>
                          {showFinancials ? (
                            <span className="text-sm font-bold text-brand-dark">{formatCents(b.totalCents)}</span>
                          ) : null}
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getAdminBookingStatusBadgeClass(b.status)}`}
                          >
                            {b.status}
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-brand-muted" aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                    <BookOpen className="h-12 w-12 text-brand-dark/20" aria-hidden />
                    <p className="mt-3 text-sm text-brand-muted">No bookings yet</p>
                    <p className="mt-1 text-xs text-brand-muted">Share your listing link to get started</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-brand-dark/10 bg-white shadow-sm">
            <div className="border-b border-brand-dark/10 px-5 py-4 sm:px-6">
              <h2 className="text-lg font-semibold text-brand-dark">Quick actions</h2>
              <p className="mt-1 text-xs text-brand-muted">Jump into the pages you use most.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 sm:p-5 xl:grid-cols-6">
              {quickActions.map((action) => {
                const Icon = action.icon;
                const toneClass =
                  action.tone === "pink"
                    ? "bg-brand-secondary/10 text-brand-secondary"
                    : action.tone === "navy"
                      ? "bg-brand-dark/10 text-brand-dark"
                      : action.tone === "amber"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-brand-primary/10 text-brand-primary";
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className={cn(
                      "group flex flex-col gap-3 rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md",
                      action.primary
                        ? "border-slate-200 bg-slate-900 text-white shadow-sm hover:bg-slate-800"
                        : "border-brand-dark/10 bg-white hover:border-brand-primary/25 hover:shadow-sm"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-2xl",
                        action.primary ? "bg-white/20 text-white" : toneClass
                      )}
                    >
                      <Icon className="h-5 w-5" aria-hidden />
                    </div>
                    <div>
                      <p className={cn("text-sm font-semibold", action.primary ? "text-white" : "text-brand-dark")}>
                        {action.label}
                      </p>
                      <p className={cn("mt-0.5 text-xs", action.primary ? "text-white/75" : "text-brand-muted")}>
                        {action.sub}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
