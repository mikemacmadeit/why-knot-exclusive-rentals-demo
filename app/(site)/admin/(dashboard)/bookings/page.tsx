/**
 * Admin bookings list and calendar. Background polling uses {@link ADMIN_BOOKING_VISIBILITY_SLA_MS} (60s)
 * so the list and calendar view stay within roughly a one-minute visibility window when auto-refresh is enabled,
 * without masking concurrent edits from other admins when diagnostics or silent merges run too often.
 */
"use client";

import { useEffect, useState, useCallback, Fragment, useRef, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { AdminBookingCalendar, type AdminBookingCalendarItem } from "@/components/booking/AdminBookingCalendar";
import { getChicagoToday, getMonthRange, toDateStr } from "@/lib/booking/booking-date-range";
import { formatTripDateYyyyMmDd, formatTripDateYyyyMmDdShort } from "@/lib/booking/format-booking-datetime";
import { List, CalendarDays, ChevronDown, ChevronUp, AlertCircle, Plus, Search, FileSpreadsheet, Mail, Ban, ArrowUpDown, Download, RefreshCw, BookOpen, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddBookingModal } from "./AddBookingModal";
import { AdminSessionRedirectError, subscribeAdminAuthRevalidate, throwIfAdminApiError } from "@/lib/admin-auth-client";
import { ADMIN_BOOKING_VISIBILITY_SLA_MS } from "@/lib/admin-booking-visibility-sla";
import { BOOKING_STATUSES_SLOT_TAKEN } from "@/lib/booking/types";
import { getAdminBookingStatusBadgeClass } from "@/lib/admin/admin-booking-status-badge";
import { formatAdminFinancialExportDiscount } from "@/lib/booking/admin-booking-discount-fields";
import { MarketplaceSourceBadge } from "@/components/admin/MarketplaceSourceBadge";
import { MarketplaceEmailDetails } from "@/components/admin/MarketplaceEmailDetails";
import { bookingExpectsWebsiteGuestConfirmation, displayMarketplaceGuestEmail, resolveMarketplaceSource } from "@/lib/admin/marketplace-source";
import { AssignCaptainControl } from "@/components/admin/AssignCaptainControl";
import { OperatorNotesControl } from "@/components/admin/OperatorNotesControl";
import { RescheduleBookingControls } from "@/components/admin/RescheduleBookingControls";
import { formatSlotIdAdminLabel } from "@/lib/booking/admin-reschedule";

type StripeEventItem = {
  id: string;
  eventType: string | null;
  receivedAt: string | null;
  processedAt: string | null;
  status: string | null;
  error: string | null;
  outcome: string | null;
  bookingId: string | null;
  holdId: string | null;
  sessionId: string | null;
  paymentIntentId: string | null;
  amountTotal: number | null;
  currency: string | null;
};

type AddonWithName = { addonId: string; name: string; qty: number };

type BookingItem = {
  id: string;
  experienceId?: string;
  experienceName: string;
  boatId?: string | null;
  boatName?: string | null;
  customer: { name: string; email: string; phone: string };
  partySize: number | null;
  petsCount: number;
  specialNotes: string | null;
  operatorNotes?: string | null;
  operatorNotesUpdatedAt?: string | null;
  operatorNotesBy?: string | null;
  operatorNotesLog?: { id: string; text: string; by: string; at: string }[];
  answers: Record<string, string>;
  addonSelections: { addonId: string; qty: number }[];
  addonsWithNames: AddonWithName[];
  durationHours: number | null;
  slotId: string | null;
  rateId: string | null;
  pricing: {
    subtotalCents?: number;
    taxCents?: number;
    feesCents?: number;
    totalCents: number;
    currency: string;
  };
  tipCents?: number | null;
  discountCode?: string | null;
  discountCents?: number | null;
  stripe?: {
    paymentIntentId?: string;
    checkoutSessionId?: string;
    amountTotalCents?: number;
    currency?: string;
    customerId?: string;
    paymentMethodId?: string;
    depositPaymentIntentId?: string;
    finalPaymentIntentId?: string;
    depositAmountCents?: number;
    finalAmountCents?: number;
    totalAmountCents?: number;
    depositPaidAt?: unknown;
    finalChargedAt?: unknown;
    finalChargeAttemptedAt?: unknown;
    finalChargeLockAt?: unknown;
    finalError?: { code?: string; message?: string };
  };
  card?: { brand?: string; last4?: string; expMonth?: number; expYear?: number };
  finalChargeAt?: string | null;
  status: string;
  createdAt: string | null;
  startDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  waiver?: { requestId: string; status: string; templateId: string; templateVersion: number };
  confirmationSentAt?: string | null;
  source?: string | null;
  externalProvider?: string | null;
  externalBookingId?: string | null;
  externalListingName?: string | null;
  externalKey?: string | null;
  marketplaceDetails?: Record<string, string> | null;
  marketplaceEmailExcerpt?: string | null;
  assignedCaptain?: { email: string; name: string; assignedAt?: string | null; assignedBy?: string | null } | null;
  bookingMode?: string | null;
  pricingType?: string | null;
  rescheduledAt?: string | null;
  rescheduledFromSlotId?: string | null;
  rescheduledFromStartDateStr?: string | null;
  rescheduleCount?: number;
  rescheduleHistory?: { fromSlotId: string; toSlotId: string; fromDateStr?: string; toDateStr?: string; at: string }[];
};

type TripQuickFilter = "today" | "tomorrow" | "next7";
type BookingSortField = "trip" | "created";
type BookingSortDirection = "asc" | "desc";

type ExperienceOption = { id: string; title: string };

function MarketplaceBookingOrigin({ booking }: { booking: BookingItem }) {
  const market = resolveMarketplaceSource(booking);
  if (!market) return null;
  return (
    <span className="block text-xs mt-1 text-brand-muted">
      From {market.label}
      {booking.externalBookingId ? ` · ${booking.externalBookingId}` : ""}
    </span>
  );
}

function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return toDateStr(new Date(y, m - 1, d + days));
}

function resolveTripQuickFilter(fromTrip: string, toTrip: string): TripQuickFilter | null {
  const today = getChicagoToday();
  if (fromTrip === today && toTrip === today) return "today";
  const tomorrow = addDaysToDateStr(today, 1);
  if (fromTrip === tomorrow && toTrip === tomorrow) return "tomorrow";
  const next7End = addDaysToDateStr(today, 6);
  if (fromTrip === today && toTrip === next7End) return "next7";
  return null;
}

function getTripQuickFilterRange(filter: TripQuickFilter): { from: string; to: string } {
  const today = getChicagoToday();
  if (filter === "today") return { from: today, to: today };
  if (filter === "tomorrow") {
    const tomorrow = addDaysToDateStr(today, 1);
    return { from: tomorrow, to: tomorrow };
  }
  return { from: today, to: addDaysToDateStr(today, 6) };
}

function parseDisplayTimeToMinutes(time: string | null | undefined): number {
  if (!time || time === "—") return 0;
  const m = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return 0;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ampm = m[3].toUpperCase();
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return h * 60 + min;
}

/** Sortable trip instant: YYYY-MM-DD + start time (Chicago display strings from API). */
function tripSortKey(b: BookingItem): number {
  const date = b.startDate?.trim();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return Number.MAX_SAFE_INTEGER;
  const [y, mo, d] = date.split("-").map(Number);
  const dayMs = Date.UTC(y, mo - 1, d);
  return dayMs + parseDisplayTimeToMinutes(b.startTime) * 60_000;
}

function sortBookingsList(
  items: BookingItem[],
  field: BookingSortField,
  direction: BookingSortDirection
): BookingItem[] {
  const mult = direction === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    if (field === "trip") {
      const ka = tripSortKey(a);
      const kb = tripSortKey(b);
      if (ka !== kb) return (ka - kb) * mult;
    } else {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (ta !== tb) return (ta - tb) * mult;
    }
    return b.id.localeCompare(a.id);
  });
}

function mergeBookingLists(
  prev: BookingItem[],
  fresh: BookingItem[],
  field: BookingSortField,
  direction: BookingSortDirection
): BookingItem[] {
  const byId = new Map(prev.map((b) => [b.id, b]));
  for (const b of fresh) byId.set(b.id, b);
  return sortBookingsList(Array.from(byId.values()), field, direction);
}

function intersectMonthWithTripFilters(
  year: number,
  month0: number,
  fromTrip: string,
  toTrip: string
): { start: string; end: string } | null {
  const { start: mStart, end: mEnd } = getMonthRange(year, month0);
  let start = mStart;
  let end = mEnd;
  if (fromTrip && fromTrip > start) start = fromTrip;
  if (toTrip && toTrip < end) end = toTrip;
  if (start > end) return null;
  return { start, end };
}

type CalendarEventApi = {
  type: string;
  id: string;
  bookingId?: string;
  experienceName?: string;
  customer?: { name: string; email: string; phone: string };
  partySize?: number | null;
  pricing?: { totalCents: number; currency: string };
  status?: string;
  createdAt?: string | null;
  startDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  source?: string | null;
  externalProvider?: string | null;
  externalBookingId?: string | null;
  specialNotes?: string | null;
};

function mapCalendarEventToItem(e: CalendarEventApi): AdminBookingCalendarItem | null {
  if (e.type !== "booking" || !e.bookingId) return null;
  return {
    id: e.bookingId,
    experienceName: e.experienceName ?? "—",
    customer: e.customer ?? { name: "", email: "", phone: "" },
    partySize: e.partySize ?? undefined,
    pricing: e.pricing ?? { totalCents: 0, currency: "usd" },
    status: e.status ?? "",
    createdAt: e.createdAt ?? null,
    startDate: e.startDate ?? null,
    startTime: e.startTime ?? null,
    endTime: e.endTime ?? null,
    source: e.source ?? null,
    externalProvider: e.externalProvider ?? null,
    externalBookingId: e.externalBookingId ?? null,
    specialNotes: e.specialNotes ?? null,
  };
}

export default function AdminBookingsPage() {
  const [list, setList] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [requiresManualReviewOnly, setRequiresManualReviewOnly] = useState(false);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [fromTripDate, setFromTripDate] = useState<string>("");
  const [toTripDate, setToTripDate] = useState<string>("");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [selectedBooking, setSelectedBooking] = useState<BookingItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [webhookEventsOpen, setWebhookEventsOpen] = useState(false);
  const [webhookEvents, setWebhookEvents] = useState<StripeEventItem[]>([]);
  const [webhookEventsLoading, setWebhookEventsLoading] = useState(false);
  const [webhookEventsError, setWebhookEventsError] = useState<string | null>(null);
  const [webhookEventsRefreshKey, setWebhookEventsRefreshKey] = useState(0);
  const [addBookingOpen, setAddBookingOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [customerSearch, setCustomerSearch] = useState("");
  const [experienceFilter, setExperienceFilter] = useState("");
  const [experiences, setExperiences] = useState<ExperienceOption[]>([]);
  const [sortField, setSortField] = useState<BookingSortField>("created");
  const [sortDirection, setSortDirection] = useState<BookingSortDirection>("desc");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelRefund, setCancelRefund] = useState(true);
  const [cancelOverridePolicy, setCancelOverridePolicy] = useState(false);
  const [cancelNoRefundWarning, setCancelNoRefundWarning] = useState<string | null>(null);
  const [cancelRefundFailures, setCancelRefundFailures] = useState<Array<{ paymentIntentId: string; error?: string }>>([]);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [listLastUpdatedAt, setListLastUpdatedAt] = useState<Date | null>(null);
  const [marketplacePayoutDollars, setMarketplacePayoutDollars] = useState("");
  const [marketplacePayoutBusy, setMarketplacePayoutBusy] = useState(false);
  const [marketplacePayoutError, setMarketplacePayoutError] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendFinalLoading, setResendFinalLoading] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [calendarEvents, setCalendarEvents] = useState<AdminBookingCalendarItem[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [calendarPollTick, setCalendarPollTick] = useState(0);
  /** When false, no background interval merge — use Refresh or explicit actions only (avoids surprise overwrites). */
  const [autoBackgroundRefresh, setAutoBackgroundRefresh] = useState(false);
  const listFetchGenRef = useRef(0);
  const loadMoreGenRef = useRef(0);
  const calendarFetchGenRef = useRef(0);
  const reconcileDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return subscribeAdminAuthRevalidate(() => {
      setRefreshKey((k) => k + 1);
      setCalendarPollTick((t) => t + 1);
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = new URLSearchParams(window.location.search).get("requiresManualReview");
    if (v === "true") setRequiresManualReviewOnly(true);
  }, []);

  useEffect(() => {
    fetch("/api/admin/experiences", { credentials: "include" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throwIfAdminApiError(res, data);
        return data;
      })
      .then((data) => {
        const rows = Array.isArray(data) ? data : [];
        setExperiences(
          rows
            .filter((e: { id?: string; title?: string }) => typeof e.id === "string" && typeof e.title === "string")
            .map((e: { id: string; title: string }) => ({ id: e.id, title: e.title }))
        );
      })
      .catch(() => {
        // Non-fatal — experience filter stays empty
      });
  }, []);

  const buildParams = useCallback((cursor?: string | null) => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (experienceFilter) params.set("experienceId", experienceFilter);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    if (fromTripDate) params.set("fromTripDate", fromTripDate);
    if (toTripDate) params.set("toTripDate", toTripDate);
    if (requiresManualReviewOnly) params.set("requiresManualReview", "true");
    params.set("limit", "50");
    if (cursor) params.set("cursor", cursor);
    return params.toString();
  }, [statusFilter, experienceFilter, fromDate, toDate, fromTripDate, toTripDate, requiresManualReviewOnly]);

  const silentMergeFirstPage = useCallback(async () => {
    const genSnapshot = listFetchGenRef.current;
    setLoadError(null);
    setLoadMoreError(null);
    try {
      const qs = buildParams();
      const url = qs ? `/api/admin/bookings?${qs}` : "/api/admin/bookings";
      const res = await fetch(url, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throwIfAdminApiError(res, data);
      if (genSnapshot !== listFetchGenRef.current) return;
      const fresh = Array.isArray(data) ? data : (data.bookings ?? []);
      setList((prev) => mergeBookingLists(prev, fresh, sortField, sortDirection));
      setNextCursor(data.nextCursor ?? null);
      setLoadError(null);
    } catch (e) {
      if (e instanceof AdminSessionRedirectError) return;
      if (genSnapshot !== listFetchGenRef.current) return;
      setLoadError(e instanceof Error ? e.message : "Error");
    }
  }, [buildParams, sortField, sortDirection]);

  useEffect(() => {
    const gen = ++listFetchGenRef.current;
    loadMoreGenRef.current += 1;
    const ac = new AbortController();
    setLoadError(null);
    setLoadMoreError(null);
    setLoading(true);
    setNextCursor(null);
    const qs = buildParams();
    const url = qs ? `/api/admin/bookings?${qs}` : "/api/admin/bookings";
    fetch(url, { credentials: "include", signal: ac.signal })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throwIfAdminApiError(res, data);
        return data;
      })
      .then((data) => {
        if (gen !== listFetchGenRef.current) return;
        const rows = Array.isArray(data) ? data : (data.bookings ?? []);
        setList(sortBookingsList(rows, sortField, sortDirection));
        setNextCursor(data.nextCursor ?? null);
        setLoadError(null);
      })
      .catch((e) => {
        if (e instanceof AdminSessionRedirectError) return;
        if (e instanceof Error && e.name === "AbortError") return;
        if (gen !== listFetchGenRef.current) return;
        setLoadError(e instanceof Error ? e.message : "Error");
      })
      .finally(() => {
        if (gen === listFetchGenRef.current) setLoading(false);
      });
    return () => ac.abort();
  }, [buildParams, refreshKey]);

  /** Re-sort loaded rows when the user toggles column headers (no refetch). */
  useEffect(() => {
    setList((prev) => (prev.length === 0 ? prev : sortBookingsList(prev, sortField, sortDirection)));
  }, [sortField, sortDirection]);

  useEffect(() => {
    if (!loading) setListLastUpdatedAt(new Date());
  }, [loading, list, refreshKey]);

  const loadMore = useCallback(() => {
    if (!nextCursor || loadingMore) return;
    const gen = ++loadMoreGenRef.current;
    const ac = new AbortController();
    setLoadMoreError(null);
    setLoadingMore(true);
    const qs = buildParams(nextCursor);
    const url = `/api/admin/bookings?${qs}`;
    fetch(url, { credentials: "include", signal: ac.signal })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throwIfAdminApiError(res, data, "Failed to load more");
        return data;
      })
      .then((data) => {
        if (gen !== loadMoreGenRef.current) return;
        const fresh = Array.isArray(data) ? data : (data.bookings ?? []);
        setList((prev) => mergeBookingLists(prev, fresh, sortField, sortDirection));
        setNextCursor(data.nextCursor ?? null);
        setLoadMoreError(null);
      })
      .catch((e) => {
        if (e instanceof AdminSessionRedirectError) return;
        if (e instanceof Error && e.name === "AbortError") return;
        if (gen !== loadMoreGenRef.current) return;
        setLoadMoreError(e instanceof Error ? e.message : "Error");
      })
      .finally(() => {
        if (gen === loadMoreGenRef.current) setLoadingMore(false);
      });
  }, [nextCursor, loadingMore, buildParams, sortField, sortDirection]);

  const handleCalendarMonthChange = useCallback((year: number, month: number) => {
    setCalendarMonth({ year, month });
  }, []);

  useEffect(() => {
    if (viewMode !== "calendar") return;
    const gen = ++calendarFetchGenRef.current;
    const ac = new AbortController();
    setCalendarError(null);
    setCalendarLoading(true);
    const range = intersectMonthWithTripFilters(calendarMonth.year, calendarMonth.month, fromTripDate, toTripDate);
    if (!range) {
      setCalendarEvents([]);
      setCalendarLoading(false);
      return;
    }
    const params = new URLSearchParams({ from: range.start, to: range.end });
    if (statusFilter) params.set("status", statusFilter);
    if (experienceFilter) params.set("experienceId", experienceFilter);
    const url = `/api/admin/calendar-events?${params.toString()}`;
    fetch(url, { credentials: "include", signal: ac.signal })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throwIfAdminApiError(res, data, "Failed to load calendar");
        return data;
      })
      .then((data) => {
        if (gen !== calendarFetchGenRef.current) return;
        const raw = (data.events ?? []) as CalendarEventApi[];
        const items = raw.map(mapCalendarEventToItem).filter(Boolean) as AdminBookingCalendarItem[];
        setCalendarEvents(items);
        setCalendarError(null);
      })
      .catch((e) => {
        if (e instanceof AdminSessionRedirectError) return;
        if (e instanceof Error && e.name === "AbortError") return;
        if (gen !== calendarFetchGenRef.current) return;
        setCalendarError(e instanceof Error ? e.message : "Error");
      })
      .finally(() => {
        if (gen === calendarFetchGenRef.current) setCalendarLoading(false);
      });
    return () => ac.abort();
  }, [viewMode, calendarMonth, fromTripDate, toTripDate, statusFilter, experienceFilter, calendarPollTick]);

  useEffect(() => {
    if (!autoBackgroundRefresh) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void silentMergeFirstPage();
      setCalendarPollTick((t) => t + 1);
    }, ADMIN_BOOKING_VISIBILITY_SLA_MS);
    return () => clearInterval(id);
  }, [silentMergeFirstPage, autoBackgroundRefresh]);

  const scheduleReconcile = useCallback(() => {
    if (reconcileDebounceRef.current) clearTimeout(reconcileDebounceRef.current);
    reconcileDebounceRef.current = setTimeout(() => {
      reconcileDebounceRef.current = null;
      if (document.visibilityState !== "visible") return;
      void silentMergeFirstPage();
      setCalendarPollTick((t) => t + 1);
    }, 2000);
  }, [silentMergeFirstPage]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") scheduleReconcile();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (reconcileDebounceRef.current) clearTimeout(reconcileDebounceRef.current);
    };
  }, [scheduleReconcile]);

  useEffect(() => {
    if (!webhookEventsOpen) return;
    const endpoint = "/api/admin/stripe-events?limit=50";
    setWebhookEventsLoading(true);
    setWebhookEventsError(null);
    fetch(endpoint, { credentials: "include" })
      .then(async (res) => {
        const data: unknown = await res.json().catch(() => null);
        if (!res.ok) {
          try {
            throwIfAdminApiError(res, data, `Failed to load webhook diagnostics (${res.status})`);
          } catch (e) {
            if (e instanceof AdminSessionRedirectError) return;
            console.error("[admin] stripe-events diagnostics fetch failed", {
              endpoint,
              httpStatus: res.status,
              response: data,
            });
            setWebhookEventsError(e instanceof Error ? e.message : "Error");
            return;
          }
        }
        const list = Array.isArray(data) ? (data as StripeEventItem[]) : [];
        setWebhookEvents(list);
        setWebhookEventsError(null);
      })
      .catch((e) => {
        console.error("[admin] stripe-events diagnostics fetch failed", {
          endpoint,
          httpStatus: "network",
          error: e instanceof Error ? e.message : String(e),
        });
        setWebhookEventsError(e instanceof Error ? e.message : "Network error");
      })
      .finally(() => setWebhookEventsLoading(false));
  }, [webhookEventsOpen, webhookEventsRefreshKey]);

  function exportCsv() {
    const headers = ["Date", "Trip date", "Experience", "Party (guests)", "Customer name", "Email", "Phone", "Amount (USD)", "Status", "Source"];
    const rows = sortedFilteredList.map((b) => {
      const date = b.createdAt ? new Date(b.createdAt).toISOString() : "";
      const tripDate = b.startDate ?? "";
      const party = b.partySize != null ? String(b.partySize) : "";
      const amount = b.pricing ? (b.pricing.totalCents / 100).toFixed(2) : "";
      return [
        date,
        tripDate,
        b.experienceName ?? "",
        party,
        b.customer?.name ?? "",
        b.customer?.email ?? "",
        b.customer?.phone ?? "",
        amount,
        b.status ?? "",
        resolveMarketplaceSource(b)?.label ?? b.source ?? "",
      ];
    });
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bookings-${fromDate || "all"}-${toDate || "all"}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportFinancialsCsv() {
    const headers = [
      "Booking ID",
      "Created",
      "Trip date",
      "Trip time",
      "Experience",
      "Boat",
      "Customer name",
      "Email",
      "Phone",
      "Party size",
      "Subtotal (USD)",
      "Tax (USD)",
      "Fees (USD)",
      "Discount code",
      "Discount (USD)",
      "Total (USD)",
      "Status",
      "Stripe Payment Intent ID",
    ];
    const rows = sortedFilteredList.map((b) => {
      const created = b.createdAt ? new Date(b.createdAt).toISOString().slice(0, 10) : "";
      const tripTime = [b.startTime, b.endTime].filter(Boolean).join(" – ") || "";
      const subtotal = b.pricing?.subtotalCents != null ? (b.pricing.subtotalCents / 100).toFixed(2) : "";
      const tax = b.pricing?.taxCents != null ? (b.pricing.taxCents / 100).toFixed(2) : "";
      const fees = b.pricing?.feesCents != null ? (b.pricing.feesCents / 100).toFixed(2) : "";
      const { discountCode, discountUsd: discount } = formatAdminFinancialExportDiscount(b);
      const total = b.pricing?.totalCents != null ? (b.pricing.totalCents / 100).toFixed(2) : "";
      const piId = b.stripe?.paymentIntentId ?? b.stripe?.finalPaymentIntentId ?? b.stripe?.depositPaymentIntentId ?? "";
      return [
        b.id,
        created,
        b.startDate ?? "",
        tripTime,
        b.experienceName ?? "",
        b.boatName ?? "",
        b.customer?.name ?? "",
        b.customer?.email ?? "",
        b.customer?.phone ?? "",
        b.partySize != null ? String(b.partySize) : "",
        subtotal,
        tax,
        fees,
        discountCode,
        discount,
        total,
        b.status ?? "",
        piId,
      ];
    });
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `financial-export-${fromTripDate || fromDate || "all"}-${toTripDate || toDate || "all"}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function formatDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function formatCents(cents: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
  }

  function formatPhoneDisplay(phone: string): string {
    const d = phone.replace(/\D/g, "");
    if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    if (d.length === 11 && d.startsWith("1")) return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
    return phone;
  }

  function formatStatusLabel(status: string): string {
    return status.replace(/_/g, " ");
  }

  const guestEmailDisplay = displayMarketplaceGuestEmail(selectedBooking?.customer?.email);

  const refreshSelectedBooking = async (bookingId: string) => {
    const res = await fetch(`/api/admin/bookings/${bookingId}`, { credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throwIfAdminApiError(res, data, "Failed to load booking");
    setSelectedBooking(data as BookingItem);
    setRefreshKey((k) => k + 1);
  };

  const saveMarketplacePayout = async (opts: { fromStoredEmail?: boolean }) => {
    if (!selectedBooking) return;
    setMarketplacePayoutBusy(true);
    setMarketplacePayoutError(null);
    try {
      const res = await fetch(`/api/admin/bookings/${selectedBooking.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          opts.fromStoredEmail
            ? { fromStoredEmail: true }
            : { marketplacePayoutDollars: marketplacePayoutDollars.trim() }
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Could not save payout");
      setMarketplacePayoutDollars("");
      await refreshSelectedBooking(selectedBooking.id);
    } catch (e) {
      if (e instanceof AdminSessionRedirectError) return;
      setMarketplacePayoutError(e instanceof Error ? e.message : "Could not save payout");
    } finally {
      setMarketplacePayoutBusy(false);
    }
  };

  const handleBookingClick = async (booking: AdminBookingCalendarItem) => {
    const fromList = list.find((b) => b.id === booking.id);
    if (fromList) {
      setSelectedBooking(fromList);
      setDetailOpen(true);
    } else {
      setSelectedBooking(null);
      setDetailOpen(true);
    }
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throwIfAdminApiError(res, data, "Failed to load booking");
      setSelectedBooking(data as BookingItem);
    } catch (e) {
      if (e instanceof AdminSessionRedirectError) return;
      setLoadError(e instanceof Error ? e.message : "Failed to open booking");
    }
  };

  const openBookingDetailFromList = (b: BookingItem) => {
    setSelectedBooking(b);
    setDetailOpen(true);
    setMarketplacePayoutDollars("");
    setMarketplacePayoutError(null);
    void (async () => {
      try {
        const res = await fetch(`/api/admin/bookings/${b.id}`, { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throwIfAdminApiError(res, data, "Failed to load booking");
        setSelectedBooking(data as BookingItem);
      } catch (e) {
        if (e instanceof AdminSessionRedirectError) return;
        setLoadError(e instanceof Error ? e.message : "Failed to refresh booking");
      }
    })();
  };

  const filteredList = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((b) => {
      const name = (b.customer?.name ?? "").toLowerCase();
      const email = (b.customer?.email ?? "").toLowerCase();
      const phone = (b.customer?.phone ?? "").replace(/\D/g, "");
      const qNorm = q.replace(/\D/g, "");
      return name.includes(q) || email.includes(q) || phone.includes(qNorm) || (qNorm.length >= 4 && phone.includes(qNorm));
    });
  }, [list, customerSearch]);

  const sortedFilteredList = useMemo(
    () => sortBookingsList(filteredList, sortField, sortDirection),
    [filteredList, sortField, sortDirection]
  );

  const toggleSort = useCallback((field: BookingSortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  }, [sortField]);

  const renderSortIcon = (field: BookingSortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 shrink-0 text-brand-muted/70" aria-hidden />;
    }
    return sortDirection === "asc" ? (
      <ChevronUp className="w-3.5 h-3.5 shrink-0 text-brand-primary" aria-hidden />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 shrink-0 text-brand-primary" aria-hidden />
    );
  };

  const filteredCalendarEvents = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return calendarEvents;
    return calendarEvents.filter((b) => {
      const name = (b.customer?.name ?? "").toLowerCase();
      const email = (b.customer?.email ?? "").toLowerCase();
      const phone = (b.customer?.phone ?? "").replace(/\D/g, "");
      const qNorm = q.replace(/\D/g, "");
      return name.includes(q) || email.includes(q) || phone.includes(qNorm) || (qNorm.length >= 4 && phone.includes(qNorm));
    });
  }, [calendarEvents, customerSearch]);

  const showInitialLoading = loading && list.length === 0;
  const showFatalBlock = loadError && list.length === 0 && !loading;

  const activeTripQuickFilter = useMemo(
    () => resolveTripQuickFilter(fromTripDate, toTripDate),
    [fromTripDate, toTripDate]
  );

  const applyTripQuickFilter = useCallback((filter: TripQuickFilter) => {
    const { from, to } = getTripQuickFilterRange(filter);
    setFromTripDate(from);
    setToTripDate(to);
  }, []);

  const heroStats = useMemo(() => {
    const today = getChicagoToday();
    const next7 = addDaysToDateStr(today, 6);
    const rows = sortedFilteredList;
    const active = (b: BookingItem) => BOOKING_STATUSES_SLOT_TAKEN.has(b.status as never);
    return {
      count: rows.length,
      todayTrips: rows.filter((b) => b.startDate === today && active(b)).length,
      upcoming: rows.filter((b) => b.startDate && b.startDate >= today && b.startDate <= next7 && active(b)).length,
      marketplace: rows.filter((b) => resolveMarketplaceSource(b)).length,
    };
  }, [sortedFilteredList]);

  const inputClass =
    "min-h-[44px] rounded-xl border border-brand-dark/15 bg-brand-bg/40 px-3 py-2 text-sm text-brand-dark focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary sm:min-h-0";

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-brand-dark px-5 py-6 text-white shadow-premium sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-brand-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-brand-secondary/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-primary">Bookings</h1>
            <p className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">
              {heroStats.count.toLocaleString()}
            </p>
            <p className="mt-2 text-sm text-white/70">
              {customerSearch.trim() || experienceFilter || statusFilter || fromDate || toDate || fromTripDate || toTripDate
                ? "Matching this view"
                : "Loaded in this list"}
              {listLastUpdatedAt
                ? ` · updated ${Math.max(0, Math.floor((Date.now() - listLastUpdatedAt.getTime()) / 1000))}s ago`
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <div className="min-w-[140px] rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/55">Today</p>
              <p className="mt-1 text-lg font-bold">{heroStats.todayTrips.toLocaleString()}</p>
              <p className="text-[11px] text-white/60">Trips holding a slot</p>
            </div>
            <div className="min-w-[140px] rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/55">Next 7 days</p>
              <p className="mt-1 text-lg font-bold">{heroStats.upcoming.toLocaleString()}</p>
              <p className="text-[11px] text-white/60">Upcoming in this list</p>
            </div>
            <div className="min-w-[140px] rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/55">Other platforms</p>
              <p className="mt-1 text-lg font-bold">{heroStats.marketplace.toLocaleString()}</p>
              <p className="text-[11px] text-white/60">Boatsetter / Getmyboat / Viator</p>
            </div>
          </div>
        </div>
        <div className="relative mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
          <div className="inline-flex flex-wrap rounded-full bg-white/10 p-1">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wide transition-all",
                viewMode === "list" ? "bg-white text-brand-dark shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              <List className="h-3.5 w-3.5" aria-hidden />
              List
            </button>
            <button
              type="button"
              onClick={() => setViewMode("calendar")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wide transition-all",
                viewMode === "calendar" ? "bg-white text-brand-dark shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
              aria-label="View bookings by day (calendar)"
            >
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              By day
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-xs text-white/60">
              <input
                type="checkbox"
                checked={autoBackgroundRefresh}
                onChange={(e) => setAutoBackgroundRefresh(e.target.checked)}
                className="rounded border-white/30 bg-white/10"
              />
              Auto-refresh {ADMIN_BOOKING_VISIBILITY_SLA_MS / 1000}s
            </label>
            <button
              type="button"
              onClick={() => {
                setRefreshKey((k) => k + 1);
                setCalendarPollTick((t) => t + 1);
              }}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />
              Refresh
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={list.length === 0}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/20 disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              CSV
            </button>
            <button
              type="button"
              onClick={exportFinancialsCsv}
              disabled={list.length === 0}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/20 disabled:opacity-40"
              title="Tax-ready financial export (subtotal, tax, fees, total)."
            >
              <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
              Financials
            </button>
            <button
              type="button"
              onClick={() => setAddBookingOpen(true)}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-brand-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-primary/90"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add booking
            </button>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-brand-dark/10 bg-white/80 p-4 shadow-sm backdrop-blur-sm sm:p-5">
        <div className="flex min-w-[220px] flex-1 items-center gap-2">
          <Search className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden />
          <input
            id="customer-search"
            type="search"
            placeholder="Search name, email, or phone"
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            className={cn(inputClass, "w-full")}
            aria-label="Search by customer name, email, or phone"
          />
        </div>
        <div className="flex min-w-[180px] items-center gap-2">
          <label htmlFor="experience-filter" className="text-xs font-semibold uppercase tracking-wider text-brand-muted">
            Experience
          </label>
          <select
            id="experience-filter"
            value={experienceFilter}
            onChange={(e) => setExperienceFilter(e.target.value)}
            className={cn(inputClass, "min-w-[180px]")}
          >
            <option value="">All</option>
            {experiences.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-[160px] items-center gap-2">
          <label htmlFor="status" className="text-xs font-semibold uppercase tracking-wider text-brand-muted">
            Status
          </label>
          <select
            id="status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={inputClass}
            disabled={requiresManualReviewOnly}
          >
            <option value="">All</option>
            <option value="paid">Paid (full)</option>
            <option value="deposit_paid">Deposit paid</option>
            <option value="final_due">Final due</option>
            <option value="final_processing">Final processing</option>
            <option value="final_paid">Final paid</option>
            <option value="final_requires_action">Final requires action</option>
            <option value="final_failed">Final failed</option>
            <option value="canceled">Canceled</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { key: "today" as const, label: "Today" },
              { key: "tomorrow" as const, label: "Tomorrow" },
              { key: "next7" as const, label: "Next 7 days" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => applyTripQuickFilter(key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                activeTripQuickFilter === key
                  ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                  : "border-brand-dark/15 bg-white text-brand-dark hover:border-brand-primary/50 hover:bg-brand-primary/5"
              )}
              aria-pressed={activeTripQuickFilter === key}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="fromTrip" className="text-xs font-semibold uppercase tracking-wider text-brand-muted">
            Trip
          </label>
          <input
            id="fromTrip"
            type="date"
            value={fromTripDate}
            onChange={(e) => setFromTripDate(e.target.value)}
            className={inputClass}
            aria-label="Filter from date (trip start)"
          />
          <span className="text-brand-muted">–</span>
          <input
            id="toTrip"
            type="date"
            value={toTripDate}
            onChange={(e) => setToTripDate(e.target.value)}
            className={inputClass}
            aria-label="Filter to date (trip start)"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="from" className="text-xs font-semibold uppercase tracking-wider text-brand-muted">
            Booked
          </label>
          <input
            id="from"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className={inputClass}
            aria-label="Filter from date (booking created)"
          />
          <span className="text-brand-muted">–</span>
          <input
            id="to"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className={inputClass}
            aria-label="Filter to date (booking created)"
          />
        </div>
        <label className="flex min-h-[44px] items-center gap-2 text-sm text-brand-dark">
          <input
            type="checkbox"
            checked={requiresManualReviewOnly}
            onChange={(e) => {
              setRequiresManualReviewOnly(e.target.checked);
              setRefreshKey((k) => k + 1);
            }}
            className="rounded border-brand-dark/30"
          />
          Manual payment review
        </label>
      </div>
      {requiresManualReviewOnly && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Showing bookings tied to pending refunds flagged for review. Clear the checkbox to return to the normal list.
        </p>
      )}

      {loadError && list.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {loadError}
          <Link href="/admin/login" className="ml-2 text-brand-primary hover:underline">Sign in</Link>
        </div>
      )}

      {loadMoreError && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {loadMoreError}
        </div>
      )}

      {showFatalBlock && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {loadError}
          <Link href="/admin/login" className="ml-2 text-brand-primary hover:underline">Sign in</Link>
        </div>
      )}

      {showInitialLoading && (
        <div className="overflow-hidden rounded-3xl border border-brand-dark/10 bg-white px-6 py-16 text-center text-sm text-brand-muted shadow-sm">
          Loading bookings…
        </div>
      )}

      {!loading && !loadError && list.length === 0 && viewMode === "list" && (
        <div className="overflow-hidden rounded-3xl border border-brand-dark/10 bg-white px-6 py-16 text-center shadow-sm">
          <BookOpen className="mx-auto h-10 w-10 text-brand-primary/40" aria-hidden />
          <p className="mt-3 text-sm font-medium text-brand-dark">No bookings yet</p>
          <p className="mx-auto mt-2 max-w-md text-xs text-brand-muted">
            When guests book, they show up here with trip time, party size, and payment details. Click a row for the full briefing.
          </p>
        </div>
      )}

      {!loading && !loadError && list.length > 0 && sortedFilteredList.length === 0 && viewMode === "list" && (
        <div className="overflow-hidden rounded-3xl border border-brand-dark/10 bg-white px-6 py-16 text-center shadow-sm">
          <p className="text-sm font-medium text-brand-dark">No bookings match these filters</p>
          <p className="mt-1 text-xs text-brand-muted">Clear search, experience, or date filters to widen the list.</p>
        </div>
      )}

      {!loading && !loadError && list.length > 0 && sortedFilteredList.length > 0 && viewMode === "list" && (
        <>
          <div className="hidden overflow-hidden rounded-3xl border border-brand-dark/10 bg-white shadow-sm md:block">
            <div className="flex items-center justify-between border-b border-brand-dark/10 px-5 py-4 sm:px-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-brand-dark">
                <BookOpen className="h-5 w-5 text-brand-primary" aria-hidden />
                {customerSearch.trim() ? `${sortedFilteredList.length} of ${list.length} bookings` : "All loaded bookings"}
              </h2>
              <p className="text-xs text-brand-muted">Click a row for guest, add-ons, and payment</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b border-brand-dark/10 bg-brand-bg/50 text-left">
                    <th className="px-4 py-3 font-medium text-brand-dark">
                      <button
                        type="button"
                        onClick={() => toggleSort("trip")}
                        className={cn(
                          "inline-flex items-center gap-1 transition-colors",
                          sortField === "trip" ? "text-brand-primary font-semibold" : "text-brand-dark hover:text-brand-primary"
                        )}
                        aria-sort={sortField === "trip" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                      >
                        Trip
                        {renderSortIcon("trip")}
                      </button>
                    </th>
                    <th className="px-4 py-3 font-medium text-brand-dark">
                      <button
                        type="button"
                        onClick={() => toggleSort("created")}
                        className={cn(
                          "inline-flex items-center gap-1 transition-colors",
                          sortField === "created" ? "text-brand-primary font-semibold" : "text-brand-dark hover:text-brand-primary"
                        )}
                        aria-sort={sortField === "created" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                      >
                        Booked
                        {renderSortIcon("created")}
                      </button>
                    </th>
                    <th className="px-4 py-3 font-medium text-brand-dark">Experience</th>
                    <th className="px-4 py-3 font-medium text-brand-dark">Boat</th>
                    <th className="px-4 py-3 font-medium text-brand-dark">Party</th>
                    <th className="px-4 py-3 font-medium text-brand-dark">Customer</th>
                    <th className="px-4 py-3 text-right font-medium text-brand-dark">Amount</th>
                    <th className="px-4 py-3 font-medium text-brand-dark">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFilteredList.map((b) => {
                    const market = resolveMarketplaceSource(b);
                    return (
                    <tr
                      key={b.id}
                      onClick={() => openBookingDetailFromList(b)}
                      className="cursor-pointer border-b border-brand-dark/5 transition-colors hover:bg-brand-bg/80"
                      style={market ? { boxShadow: `inset 4px 0 0 ${market.rgb}` } : undefined}
                    >
                      <td className="whitespace-nowrap px-4 py-3.5 text-brand-dark">
                        {formatTripDateYyyyMmDdShort(b.startDate ?? null)}
                        {(b.startTime ?? b.endTime) && (
                          <span className="mt-0.5 block text-xs text-brand-muted">
                            {[b.startTime, b.endTime].filter(Boolean).join(" – ")}
                            {b.durationHours != null && ` (${b.durationHours}h)`}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-xs text-brand-muted">
                        {b.createdAt
                          ? new Date(b.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                          : "—"}
                      </td>
                      <td className="px-4 py-3.5 text-brand-dark">{b.experienceName}</td>
                      <td className="px-4 py-3.5 text-sm text-brand-muted">{b.boatName || "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-brand-dark">
                        {b.partySize != null ? `${b.partySize} guest${b.partySize !== 1 ? "s" : ""}` : "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-semibold text-brand-dark">{b.customer?.name || "—"}</span>
                        <span className="mt-0.5 block max-w-[220px] truncate text-xs text-brand-muted">{b.customer?.email}</span>
                        <MarketplaceSourceBadge booking={b} className="mt-1" />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold text-brand-dark">
                        {b.pricing ? formatCents(b.pricing.totalCents) : "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getAdminBookingStatusBadgeClass(b.status)}`}
                        >
                          {b.status}
                        </span>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {customerSearch.trim() && (
              <p className="text-xs text-brand-muted">
                Showing {sortedFilteredList.length} of {list.length} bookings
              </p>
            )}
            {sortedFilteredList.map((b) => {
              const market = resolveMarketplaceSource(b);
              return (
              <button
                key={b.id}
                type="button"
                onClick={() => openBookingDetailFromList(b)}
                className="w-full space-y-2 rounded-3xl border border-brand-dark/10 bg-white p-4 text-left shadow-sm transition hover:bg-brand-bg/50"
                style={market ? { borderLeftWidth: 4, borderLeftColor: market.rgb } : undefined}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-brand-dark">{b.customer?.name || "—"}</span>
                  <span
                    className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${getAdminBookingStatusBadgeClass(b.status)}`}
                  >
                    {b.status}
                  </span>
                </div>
                <MarketplaceSourceBadge booking={b} />
                <div className="text-xs text-brand-muted">
                  {formatTripDateYyyyMmDdShort(b.startDate ?? null)}
                  {(b.startTime ?? b.endTime) && ` · ${[b.startTime, b.endTime].filter(Boolean).join(" – ")}`}
                  {" · "}{b.experienceName}
                  {b.boatName ? ` · ${b.boatName}` : ""}
                </div>
                <div className="text-right text-sm font-bold text-brand-dark">
                  {b.pricing ? formatCents(b.pricing.totalCents) : "—"}
                </div>
              </button>
              );
            })}
          </div>
        </>
      )}

      {!loading && !loadError && nextCursor && viewMode === "list" && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={loadMore}
            disabled={loadingMore}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full"
          >
            {loadingMore ? (
              <>
                <svg className="animate-spin h-4 w-4 text-brand-muted" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Loading…
              </>
            ) : (
              "Load more"
            )}
          </Button>
        </div>
      )}

      {!loadError && viewMode === "calendar" && (
        <div className="overflow-hidden rounded-3xl border border-brand-dark/10 bg-white shadow-sm">
          <div className="border-b border-brand-dark/10 px-5 py-4 sm:px-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-brand-dark">
              <CalendarDays className="h-5 w-5 text-brand-primary" aria-hidden />
              Bookings by day
            </h2>
            <p className="mt-1 text-xs text-brand-muted">
              Loads the visible month from the server. Trip date, experience, and status filters apply; booking-date filters do not.
            </p>
          </div>
          <div className="p-4 sm:p-5">
          {calendarError && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{calendarError}</div>
          )}
          {calendarLoading && calendarEvents.length === 0 && (
            <div className="py-12 text-center text-sm text-brand-muted">
              Loading calendar…
            </div>
          )}
          {!calendarError && (calendarEvents.length > 0 || !calendarLoading) && (
            <>
              {calendarEvents.length > 0 && filteredCalendarEvents.length === 0 && customerSearch.trim() && (
                <p className="mb-3 text-sm text-brand-muted">No bookings match your customer search for this month.</p>
              )}
              <AdminBookingCalendar
                bookings={filteredCalendarEvents}
                onBookingClick={handleBookingClick}
                onMonthChange={handleCalendarMonthChange}
              />
            </>
          )}
          </div>
        </div>
      )}

      <section className="overflow-hidden rounded-3xl border border-brand-dark/10 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setWebhookEventsOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 px-5 py-4 text-left text-sm font-semibold text-brand-dark transition-colors hover:bg-brand-bg/50 sm:px-6"
        >
          <span>Webhook events (Stripe → booking)</span>
          {webhookEventsOpen ? <ChevronUp className="h-4 w-4 text-brand-muted" /> : <ChevronDown className="h-4 w-4 text-brand-muted" />}
        </button>
        {webhookEventsOpen && (
          <div className="border-t border-brand-dark/10 p-4">
            <p className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
              <AlertCircle className="w-4 h-4 shrink-0" />
              If a charge appears in Stripe but no booking shows above: (1) In Stripe Dashboard → Developers → Webhooks, ensure the endpoint is <code className="bg-amber-100 px-1 rounded">APP_BASE_URL/api/stripe/webhook</code> and events <strong>checkout.session.completed</strong> and <strong>payment_intent.succeeded</strong> are enabled. (2) Check the table below for errors (e.g. &quot;Hold not found&quot;, &quot;Missing holdId&quot;). Match Stripe payment by Payment ID or Session ID to find the event and its error.
            </p>
            {webhookEventsLoading && (
              <p className="text-sm text-brand-muted py-2">Loading…</p>
            )}
            {webhookEventsError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 mb-4" role="alert">
                <p className="font-medium">Could not load webhook events</p>
                <p className="mt-1">{webhookEventsError}</p>
                <button
                  type="button"
                  className="mt-3 text-sm font-semibold text-brand-primary hover:underline"
                  onClick={() => {
                    setWebhookEventsError(null);
                    setWebhookEventsRefreshKey((k) => k + 1);
                  }}
                >
                  Retry
                </button>
              </div>
            )}
            {!webhookEventsLoading && !webhookEventsError && webhookEvents.length === 0 && (
              <p className="text-sm text-brand-muted py-2">No webhook events recorded yet. Complete a test payment to see events here.</p>
            )}
            {!webhookEventsLoading && webhookEvents.length > 0 && (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-brand-dark/15">
                      <th className="px-2 py-2 text-left font-medium text-brand-dark">Event</th>
                      <th className="px-2 py-2 text-left font-medium text-brand-dark">Received</th>
                      <th className="px-2 py-2 text-left font-medium text-brand-dark">Error / Outcome</th>
                      <th className="px-2 py-2 text-left font-medium text-brand-dark">Booking / Hold</th>
                      <th className="px-2 py-2 text-left font-medium text-brand-dark">Stripe ID / Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {webhookEvents.map((ev) => (
                      <tr key={ev.id} className="border-b border-brand-dark/5">
                        <td className="px-2 py-2 text-brand-dark font-mono text-xs">{ev.eventType ?? "—"}</td>
                        <td className="px-2 py-2 text-brand-muted text-xs whitespace-nowrap">
                          {ev.receivedAt ? new Date(ev.receivedAt).toLocaleString() : "—"}
                        </td>
                        <td className="px-2 py-2">
                          {ev.error ? (
                            <span className="text-red-700 font-medium" title={ev.error}>{ev.error}</span>
                          ) : ev.outcome ? (
                            <span className="text-green-700">{ev.outcome}</span>
                          ) : (
                            <span className="text-brand-muted">—</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-brand-muted text-xs">
                          {ev.bookingId ? `Booking: ${ev.bookingId}` : ev.holdId ? `Hold: ${ev.holdId}` : "—"}
                        </td>
                        <td className="px-2 py-2 text-brand-muted text-xs font-mono">
                          {ev.paymentIntentId && <span title="Payment Intent ID">{ev.paymentIntentId.slice(0, 20)}…</span>}
                          {ev.sessionId && ev.eventType === "checkout.session.completed" && (
                            <span title="Session ID" className="block truncate max-w-[12rem]">{ev.sessionId}</span>
                          )}
                          {ev.amountTotal != null && (
                            <span className="block">{(ev.amountTotal / 100).toFixed(2)} {ev.currency ?? "USD"}</span>
                          )}
                          {!ev.paymentIntentId && !ev.sessionId && ev.amountTotal == null && "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      <AddBookingModal
        open={addBookingOpen}
        onOpenChange={setAddBookingOpen}
        onSuccess={() => {
          setRefreshKey((k) => k + 1);
          setCalendarPollTick((t) => t + 1);
        }}
      />

      {/* Booking detail modal */}
      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setSelectedBooking(null);
            setCancelConfirmOpen(false);
            setCancelRefund(true);
            setCancelOverridePolicy(false);
            setCancelNoRefundWarning(null);
            setCancelRefundFailures([]);
            void silentMergeFirstPage();
            setCalendarPollTick((t) => t + 1);
          }
        }}
        title={selectedBooking ? selectedBooking.customer?.name ?? "Booking" : undefined}
        description={
          selectedBooking
            ? `${selectedBooking.experienceName}${selectedBooking.startDate ? ` · ${formatTripDateYyyyMmDd(selectedBooking.startDate)}` : ""}${selectedBooking.startTime ? ` · ${selectedBooking.startTime}` : ""}`
            : undefined
        }
        fullScreenOnMobile
        bodyScroll={false}
        className="sm:max-w-3xl sm:max-h-[90vh]"
      >
        <div className="flex min-h-0 flex-1 flex-col">
        {!selectedBooking && detailOpen && (
          <div className="py-12 text-center text-brand-muted text-sm">Loading booking…</div>
        )}
        {selectedBooking && (
          <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto overscroll-contain text-sm pr-1 pb-2">
            {BOOKING_STATUSES_SLOT_TAKEN.has(selectedBooking.status as never) &&
              bookingExpectsWebsiteGuestConfirmation(selectedBooking) &&
              !selectedBooking.confirmationSentAt &&
              selectedBooking.createdAt &&
              Date.now() - new Date(selectedBooking.createdAt).getTime() > 15 * 60 * 1000 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950" role="status">
                  Confirmation email is not on file yet. You can resend it below.
                </div>
              )}

            <section className="rounded-2xl border border-brand-dark/10 bg-brand-bg/50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${getAdminBookingStatusBadgeClass(selectedBooking.status)}`}
                >
                  {formatStatusLabel(selectedBooking.status)}
                </span>
                <MarketplaceSourceBadge booking={selectedBooking} className="text-[11px] px-2.5 py-0.5" />
                {(selectedBooking.rescheduleCount ?? 0) > 0 && (
                  <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-900">
                    Rescheduled
                  </span>
                )}
                {selectedBooking.waiver?.status === "signed" && (
                  <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-800">
                    Waiver signed
                  </span>
                )}
                {selectedBooking.waiver && selectedBooking.waiver.status !== "signed" && (
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      selectedBooking.waiver.status === "partial"
                        ? "bg-amber-100 text-amber-900"
                        : selectedBooking.waiver.status === "pending"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    Waiver {selectedBooking.waiver.status}
                  </span>
                )}
              </div>
              <p className="mt-3 text-lg font-semibold text-brand-dark leading-snug">{selectedBooking.experienceName}</p>
              {selectedBooking.boatName && (
                <p className="text-xs text-brand-muted mt-0.5">{selectedBooking.boatName}</p>
              )}
              <MarketplaceBookingOrigin booking={selectedBooking} />
              <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">When</p>
                  <p className="mt-0.5 font-medium text-brand-dark">
                    {formatTripDateYyyyMmDd(selectedBooking.startDate ?? null)}
                  </p>
                  <p className="text-sm text-brand-muted">
                    {[selectedBooking.startTime, selectedBooking.endTime].filter(Boolean).join(" – ")}
                    {selectedBooking.durationHours != null ? ` · ${selectedBooking.durationHours}h` : ""}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Party</p>
                  <p className="mt-0.5 font-medium text-brand-dark">
                    {selectedBooking.partySize != null
                      ? `${selectedBooking.partySize} guest${selectedBooking.partySize !== 1 ? "s" : ""}`
                      : "—"}
                  </p>
                  <p className="text-xs text-brand-muted">
                    Booked {selectedBooking.createdAt ? formatDate(selectedBooking.createdAt) : "—"}
                  </p>
                </div>
              </div>
              {(selectedBooking.rescheduleCount ?? 0) > 0 && selectedBooking.rescheduledFromSlotId && (
                <p className="mt-2 text-xs text-amber-800">
                  Moved from {formatSlotIdAdminLabel(selectedBooking.rescheduledFromSlotId)}
                </p>
              )}
              {selectedBooking.waiver && (
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  <Link
                    href={`/admin/waivers/requests/${selectedBooking.waiver.requestId}`}
                    className="text-brand-primary hover:underline"
                  >
                    View waiver
                  </Link>
                  {(selectedBooking.waiver.status === "signed" || selectedBooking.waiver.status === "partial") && (
                    <a
                      href={`/api/waiver/pdf/${selectedBooking.waiver.requestId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-primary hover:underline"
                    >
                      Open PDF
                    </a>
                  )}
                </div>
              )}
            </section>

            {selectedBooking.addonsWithNames && selectedBooking.addonsWithNames.length > 0 && (
              <section className="rounded-2xl border border-brand-dark/10 px-4 py-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Add-ons</h3>
                <ul className="mt-2 space-y-1">
                  {selectedBooking.addonsWithNames.map((a) => (
                    <li key={a.addonId} className="flex justify-between text-brand-dark">
                      <span>{a.name}</span>
                      <span className="text-brand-muted">×{a.qty}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <section className="rounded-2xl border border-brand-dark/10 p-4 min-w-0">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Guest</h3>
              <p className="mt-2 font-semibold text-brand-dark">{selectedBooking.customer?.name ?? "—"}</p>
              <div className="mt-2 space-y-1.5">
                {guestEmailDisplay && (
                  <a
                    href={`mailto:${guestEmailDisplay}`}
                    className="flex items-center gap-2 text-sm text-brand-primary hover:underline break-all"
                  >
                    <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {guestEmailDisplay}
                  </a>
                )}
                {selectedBooking.customer?.phone && (
                  <a
                    href={`tel:${selectedBooking.customer.phone}`}
                    className="flex items-center gap-2 text-sm text-brand-dark hover:underline"
                  >
                    <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {formatPhoneDisplay(selectedBooking.customer.phone)}
                  </a>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-brand-dark/10 p-4 min-w-0">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Payment</h3>
              {selectedBooking.pricing && (
                <dl className="mt-2 space-y-1">
                  {selectedBooking.pricing.subtotalCents != null && (
                    <div className="flex justify-between">
                      <dt className="text-brand-muted">Subtotal</dt>
                      <dd className="text-brand-dark">{formatCents(selectedBooking.pricing.subtotalCents)}</dd>
                    </div>
                  )}
                  {selectedBooking.pricing.taxCents != null && selectedBooking.pricing.taxCents > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-brand-muted">Tax</dt>
                      <dd className="text-brand-dark">{formatCents(selectedBooking.pricing.taxCents)}</dd>
                    </div>
                  )}
                  {selectedBooking.pricing.feesCents != null && selectedBooking.pricing.feesCents > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-brand-muted">Fees</dt>
                      <dd className="text-brand-dark">{formatCents(selectedBooking.pricing.feesCents)}</dd>
                    </div>
                  )}
                  {typeof selectedBooking.discountCents === "number" && selectedBooking.discountCents > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-brand-muted">
                        Discount{selectedBooking.discountCode ? ` (${selectedBooking.discountCode})` : ""}
                      </dt>
                      <dd className="text-brand-dark">−{formatCents(selectedBooking.discountCents)}</dd>
                    </div>
                  )}
                  {typeof selectedBooking.tipCents === "number" &&
                    selectedBooking.tipCents > 0 &&
                    selectedBooking.pricing.subtotalCents != null &&
                    selectedBooking.pricing.subtotalCents > 0 && (
                      <div className="flex justify-between">
                        <dt className="text-brand-muted">
                          Tip (
                          {Math.round(
                            (selectedBooking.tipCents / selectedBooking.pricing.subtotalCents) * 100
                          )}
                          %)
                        </dt>
                        <dd className="text-brand-dark">{formatCents(selectedBooking.tipCents)}</dd>
                      </div>
                    )}
                  <div className="flex justify-between font-semibold pt-2 border-t border-brand-dark/10">
                    <dt className="text-brand-dark">Total</dt>
                    <dd className="text-brand-dark">{formatCents(selectedBooking.pricing.totalCents)}</dd>
                  </div>
                </dl>
              )}
              {resolveMarketplaceSource(selectedBooking) && (selectedBooking.pricing?.totalCents ?? 0) <= 0 && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 space-y-2">
                  <p className="text-xs text-amber-950">
                    Marketplace payout was missing from the first email. Enter the payout you received, or fill it from the saved email if the amount is in the notes below.
                  </p>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="text-xs text-brand-muted">
                      Payout
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="81.90"
                        value={marketplacePayoutDollars}
                        onChange={(e) => setMarketplacePayoutDollars(e.target.value)}
                        className="mt-1 block w-28 rounded border border-brand-dark/20 px-2 py-1 text-sm text-brand-dark"
                      />
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      disabled={marketplacePayoutBusy || !marketplacePayoutDollars.trim()}
                      onClick={() => void saveMarketplacePayout({})}
                    >
                      {marketplacePayoutBusy ? "Saving…" : "Save payout"}
                    </Button>
                    {(selectedBooking.marketplaceEmailExcerpt || selectedBooking.marketplaceDetails) && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={marketplacePayoutBusy}
                        onClick={() => void saveMarketplacePayout({ fromStoredEmail: true })}
                      >
                        Fill from saved email
                      </Button>
                    )}
                  </div>
                  {marketplacePayoutError && <p className="text-xs text-red-700">{marketplacePayoutError}</p>}
                </div>
              )}
              {selectedBooking.stripe?.paymentIntentId && (
                <a
                  href={`https://dashboard.stripe.com/payments/${selectedBooking.stripe.paymentIntentId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 block truncate text-[11px] font-mono text-brand-muted hover:text-brand-primary hover:underline"
                  title={selectedBooking.stripe.paymentIntentId}
                >
                  Stripe {selectedBooking.stripe.paymentIntentId}
                </a>
              )}
              {(selectedBooking.stripe?.depositPaymentIntentId ?? selectedBooking.stripe?.depositAmountCents != null) && (
                <div className="mt-3 pt-3 border-t border-brand-dark/10 space-y-1">
                  <p className="text-xs font-semibold text-brand-muted uppercase tracking-wide">50/50 deposit flow</p>
                  {selectedBooking.stripe?.customerId && (
                    <p className="text-brand-muted text-xs font-mono truncate" title={selectedBooking.stripe.customerId}>
                      Customer: {selectedBooking.stripe.customerId}
                    </p>
                  )}
                  {selectedBooking.stripe?.paymentMethodId && (
                    <p className="text-brand-muted text-xs font-mono truncate" title={selectedBooking.stripe.paymentMethodId}>
                      PM: {selectedBooking.stripe.paymentMethodId.slice(0, 20)}…
                    </p>
                  )}
                  {selectedBooking.card && (
                    <p className="text-brand-dark text-xs">
                      Card: {selectedBooking.card.brand ?? "Card"} •••• {selectedBooking.card.last4 ?? ""}
                      {selectedBooking.card.expMonth != null && selectedBooking.card.expYear != null && (
                        <span> exp {selectedBooking.card.expMonth}/{selectedBooking.card.expYear}</span>
                      )}
                    </p>
                  )}
                  {selectedBooking.stripe?.depositAmountCents != null && (
                    <p className="text-brand-dark text-xs">Deposit: {formatCents(selectedBooking.stripe.depositAmountCents)}</p>
                  )}
                  {selectedBooking.stripe?.finalAmountCents != null && (
                    <p className="text-brand-dark text-xs">Final: {formatCents(selectedBooking.stripe.finalAmountCents)}</p>
                  )}
                  {selectedBooking.finalChargeAt && (
                    <p className="text-brand-muted text-xs">
                      Final charge at: {new Date(selectedBooking.finalChargeAt).toLocaleString()}
                    </p>
                  )}
                  {selectedBooking.stripe?.finalPaymentIntentId && (
                    <p className="text-brand-muted text-xs font-mono truncate" title={selectedBooking.stripe.finalPaymentIntentId}>
                      Final PI: {selectedBooking.stripe.finalPaymentIntentId}
                    </p>
                  )}
                  {selectedBooking.stripe?.finalError && (
                    <p className="text-red-700 text-xs" title={selectedBooking.stripe.finalError.message}>
                      Final error: {selectedBooking.stripe.finalError.code ?? "—"} {selectedBooking.stripe.finalError.message ?? ""}
                    </p>
                  )}
                </div>
              )}
            </section>
            </div>

            {selectedBooking.slotId && BOOKING_STATUSES_SLOT_TAKEN.has(selectedBooking.status as never) && (
              <RescheduleBookingControls
                booking={selectedBooking}
                notifyGuest={bookingExpectsWebsiteGuestConfirmation(selectedBooking)}
                onMoved={() => {
                  setRefreshKey((k) => k + 1);
                  setCalendarPollTick((t) => t + 1);
                  void (async () => {
                    try {
                      const res = await fetch(`/api/admin/bookings/${selectedBooking.id}`, { credentials: "include" });
                      const data = await res.json().catch(() => ({}));
                      if (res.ok) setSelectedBooking(data as BookingItem);
                    } catch {
                      /* list refresh still ran */
                    }
                  })();
                }}
              />
            )}

            <div className="flex min-w-0 flex-wrap gap-2">
                {bookingExpectsWebsiteGuestConfirmation(selectedBooking) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={resendLoading}
                  onClick={async () => {
                    if (!selectedBooking?.id) return;
                    setResendLoading(true);
                    try {
                      const res = await fetch(`/api/admin/bookings/${selectedBooking.id}/resend-confirmation`, {
                        method: "POST",
                        credentials: "include",
                      });
                      const data = await res.json().catch(() => ({}));
                      if (!res.ok) throw new Error(data.error ?? "Failed to send");
                      setLoadError(null);
                      setDetailOpen(false);
                      setSelectedBooking(null);
                      setRefreshKey((k) => k + 1);
                    } catch (e) {
                      setLoadError(e instanceof Error ? e.message : "Failed to resend email");
                    } finally {
                      setResendLoading(false);
                    }
                  }}
                  className="inline-flex max-w-full h-auto whitespace-normal items-center gap-1.5 py-2"
                >
                  <Mail className="w-4 h-4 shrink-0" aria-hidden />
                  {resendLoading ? "Sending…" : "Resend confirmation"}
                </Button>
                )}
                {["final_due", "final_requires_action", "final_failed"].includes(selectedBooking.status) &&
                  (selectedBooking.stripe?.finalAmountCents ?? 0) > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={resendFinalLoading}
                    onClick={async () => {
                      if (!selectedBooking?.id) return;
                      setResendFinalLoading(true);
                      try {
                        const res = await fetch(`/api/admin/bookings/${selectedBooking.id}/resend-final-payment-request`, {
                          method: "POST",
                          credentials: "include",
                        });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok) throw new Error(data.error ?? "Failed to send");
                        setLoadError(null);
                        setDetailOpen(false);
                        setSelectedBooking(null);
                        setRefreshKey((k) => k + 1);
                      } catch (e) {
                        setLoadError(e instanceof Error ? e.message : "Failed to resend final payment request");
                      } finally {
                        setResendFinalLoading(false);
                      }
                    }}
                    className="inline-flex max-w-full h-auto whitespace-normal items-center gap-1.5 py-2"
                  >
                    <Mail className="w-4 h-4 shrink-0" aria-hidden />
                    {resendFinalLoading ? "Sending…" : "Resend final payment request"}
                  </Button>
                )}
                {selectedBooking.status !== "canceled" && selectedBooking.status !== "refunded" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="inline-flex max-w-full h-auto whitespace-normal items-center gap-1.5 py-2 text-amber-700 border-amber-300 hover:bg-amber-50"
                    onClick={() => setCancelConfirmOpen(true)}
                  >
                    <Ban className="w-4 h-4" aria-hidden />
                    Cancel booking
                  </Button>
                )}
            </div>

            <div className="space-y-3">
              <AssignCaptainControl
                bookingId={selectedBooking.id}
                current={selectedBooking.assignedCaptain ?? null}
                onAssigned={(next) => {
                  setSelectedBooking((prev) => (prev ? { ...prev, assignedCaptain: next } : prev));
                  setList((prev) =>
                    prev.map((b) => (b.id === selectedBooking.id ? { ...b, assignedCaptain: next } : b))
                  );
                }}
              />
              <OperatorNotesControl
                bookingId={selectedBooking.id}
                current={selectedBooking.operatorNotes ?? null}
                updatedAt={selectedBooking.operatorNotesUpdatedAt ?? null}
                updatedBy={selectedBooking.operatorNotesBy ?? null}
                log={selectedBooking.operatorNotesLog}
                captainAssigned={Boolean(selectedBooking.assignedCaptain?.email)}
                onSaved={(next) => {
                  setSelectedBooking((prev) => (prev ? { ...prev, ...next } : prev));
                  setList((prev) =>
                    prev.map((b) => (b.id === selectedBooking.id ? { ...b, ...next } : b))
                  );
                }}
              />
            </div>

            {(selectedBooking.specialNotes || (selectedBooking.answers && Object.keys(selectedBooking.answers).length > 0)) && (
              <section className="rounded-2xl border border-brand-dark/10 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Guest notes</h3>
                <dl className="mt-2 space-y-2">
                  {selectedBooking.specialNotes && (
                    <>
                      <dt className="text-brand-muted text-xs">Special requests</dt>
                      <dd className="text-brand-dark mt-0.5 rounded-lg bg-brand-bg/50 px-3 py-2 whitespace-pre-wrap">
                        {selectedBooking.specialNotes}
                      </dd>
                    </>
                  )}
                  {selectedBooking.answers && Object.entries(selectedBooking.answers).map(([key, value]) =>
                    value ? (
                      <Fragment key={key}>
                        <dt className="text-brand-muted text-xs capitalize">{key.replace(/_/g, " ")}</dt>
                        <dd className="text-brand-dark mt-0.5">{value}</dd>
                      </Fragment>
                    ) : null
                  )}
                </dl>
              </section>
            )}

            <MarketplaceEmailDetails
              details={selectedBooking.marketplaceDetails}
              excerpt={selectedBooking.marketplaceEmailExcerpt}
            />
          </div>
        )}
        </div>
      </Dialog>

      {/* Cancel booking confirmation */}
      <Dialog
        open={cancelConfirmOpen}
        onOpenChange={(open) => {
          setCancelConfirmOpen(open);
          if (!open) {
            setCancelRefund(true);
            setCancelOverridePolicy(false);
            setCancelNoRefundWarning(null);
            setCancelRefundFailures([]);
          }
        }}
        title="Cancel booking?"
      >
        {selectedBooking && (
          <div className="space-y-4 text-sm">
            <p className="text-brand-dark">
              This will cancel the booking for <strong>{selectedBooking.customer?.name ?? "the customer"}</strong>
              {selectedBooking.pricing && (
                <> (amount: <strong>{formatCents(selectedBooking.pricing.totalCents)}</strong>)</>
              )}.
            </p>
            <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              A Stripe refund will be issued to the customer unless you opt out below (e.g. for penalty-free cancellations).
            </p>
            {cancelNoRefundWarning && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-950">
                <p className="text-sm">{cancelNoRefundWarning}</p>
                <label className="mt-2 flex items-center gap-2 cursor-pointer text-brand-dark">
                  <input
                    type="checkbox"
                    checked={cancelOverridePolicy}
                    onChange={(e) => setCancelOverridePolicy(e.target.checked)}
                    className="rounded border-brand-dark/30"
                  />
                  <span>Override policy and proceed with cancellation</span>
                </label>
              </div>
            )}
            {cancelRefundFailures.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-950" role="alert">
                <p className="font-medium">Stripe refund issue</p>
                <ul className="mt-1 list-disc pl-5 text-xs font-mono space-y-0.5">
                  {cancelRefundFailures.map((r) => (
                    <li key={r.paymentIntentId}>
                      {r.paymentIntentId}: {r.error ?? "failed"}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs">Resolve in Stripe or retry; the booking is already canceled.</p>
              </div>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={cancelRefund}
                onChange={(e) => setCancelRefund(e.target.checked)}
                className="rounded border-brand-dark/30"
              />
              <span className="text-brand-dark">Issue refund via Stripe</span>
            </label>
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCancelConfirmOpen(false)}
              >
                Back
              </Button>
              <Button
                type="button"
                className="bg-amber-600 hover:bg-amber-700"
                disabled={cancelLoading}
                onClick={async () => {
                  if (!selectedBooking?.id) return;
                  setCancelLoading(true);
                  setCancelNoRefundWarning(null);
                  try {
                    const res = await fetch(`/api/admin/bookings/${selectedBooking.id}/cancel`, {
                      method: "POST",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ refund: cancelRefund, overridePolicy: cancelOverridePolicy }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (res.status === 409 && (data as { code?: string }).code === "NO_REFUND_WINDOW_REQUIRES_CONFIRMATION") {
                      setCancelNoRefundWarning(
                        typeof (data as { error?: string }).error === "string"
                          ? (data as { error: string }).error
                          : "Policy confirmation required."
                      );
                      return;
                    }
                    if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to cancel");
                    const refunds = Array.isArray((data as { refunds?: unknown }).refunds)
                      ? ((data as { refunds: Array<{ paymentIntentId: string; error?: string }> }).refunds)
                      : [];
                    const failed = refunds.filter((r) => r.error);
                    if (failed.length > 0) {
                      setCancelRefundFailures(failed);
                      return;
                    }
                    setLoadError(null);
                    setCancelConfirmOpen(false);
                    setCancelRefundFailures([]);
                    setDetailOpen(false);
                    setSelectedBooking(null);
                    setCancelRefund(true);
                    setCancelOverridePolicy(false);
                    setRefreshKey((k) => k + 1);
                  } catch (e) {
                    setLoadError(e instanceof Error ? e.message : "Failed to cancel booking");
                  } finally {
                    setCancelLoading(false);
                  }
                }}
              >
                {cancelLoading ? "Canceling…" : "Confirm cancel"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
