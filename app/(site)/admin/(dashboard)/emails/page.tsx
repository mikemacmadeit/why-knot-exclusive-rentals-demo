"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Inbox, Mail, RefreshCw, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ConfirmationEmailCopyEditor,
  type ConfirmationCopyDraft,
} from "@/components/admin/ConfirmationEmailCopyEditor";

type EmailTemplateMeta = {
  id: string;
  name: string;
  description: string;
  subject: string;
};

type EmailLogEntry = {
  id: string;
  to: string;
  toName: string | null;
  templateId: string;
  subject: string;
  bookingId: string | null;
  sentAt: string | null;
  channel?: string;
  audience?: string;
  deliveryState?: string | null;
};

type QueueCounts = { pending: number; deadLetter: number; stuckClaims: number };

type OutboxStats = {
  pending: number;
  deadLetter: number;
  stuckClaims: number;
  byType?: {
    booking_confirmation?: QueueCounts;
    final_charge_success?: QueueCounts;
    discount_limit_exceeded_notification?: QueueCounts;
    waiver_invite_send?: QueueCounts;
  };
  reminderRetryQueue?: Record<
    string,
    { pending: number; sent: number; deadLetter: number; skipped: number; lastErrorSnippet?: string }
  >;
  staleClaimCountsByTemplate?: Record<string, number>;
  reminderRetryDeadLetterTotal?: number;
};

type DeliveryFailure = {
  id: string;
  bookingId: string;
  type?: string;
  templateKey?: string;
  status?: string;
  lastError: string | null;
  attemptCount: number;
  source: "outbox" | "reminder";
};

type PageTab = "compose" | "delivery" | "sent";

const TEMPLATE_SHORT: Record<string, string> = {
  booking_confirmation: "Confirmation",
  booking_reminder_1week: "1 week",
  booking_reminder_24h: "24 hours",
  booking_reminder_dayof: "Day of",
  captain_assignment: "Captain confirmation",
  captain_unassigned: "Captain removed",
  team_invite: "Team invite",
};

const TEMPLATE_LABELS: Record<string, string> = {
  ...TEMPLATE_SHORT,
  booking_reminder_1week: "1 week before",
  booking_reminder_24h: "24 hours before",
  booking_reminder_dayof: "Day of",
  final_payment_request: "Final payment request",
  final_charge_success: "Final charge receipt",
  waiver_invite_send: "Waiver invite",
  discount_limit_exceeded_notification: "Discount limit notice",
  reminder_1week: "1 week before",
  reminder_24h: "24 hours before",
  reminder_dayof: "Day of",
  captain_assignment: "Captain confirmation",
  captain_unassigned: "Captain removed from trip",
  team_invite: "Team invite (set password)",
};

function formatSentAt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function templateLabel(id: string) {
  return TEMPLATE_LABELS[id] ?? id;
}

const SENT_PAGE_SIZE = 12;
const EMAIL_PREVIEW_WIDTH = 600;

export default function AdminEmailsPage() {
  const [tab, setTab] = useState<PageTab>("compose");
  const [templates, setTemplates] = useState<EmailTemplateMeta[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [log, setLog] = useState<EmailLogEntry[]>([]);
  const [logLoading, setLogLoading] = useState(true);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [outboxStats, setOutboxStats] = useState<OutboxStats | null>(null);
  const [outboxStatsLoading, setOutboxStatsLoading] = useState(true);
  const [deliveryFailures, setDeliveryFailures] = useState<DeliveryFailure[]>([]);
  const [deliveryFailuresLoading, setDeliveryFailuresLoading] = useState(true);
  const previewIframeRef = useRef<HTMLIFrameElement>(null);
  const previewPaneRef = useRef<HTMLDivElement>(null);
  const [previewHeight, setPreviewHeight] = useState(640);
  const [previewScale, setPreviewScale] = useState(1);
  const [copyDraft, setCopyDraft] = useState<ConfirmationCopyDraft | null>(null);
  const [sentPage, setSentPage] = useState(0);

  const fitPreviewToContent = useCallback(() => {
    const iframe = previewIframeRef.current;
    const doc = iframe?.contentDocument ?? iframe?.contentWindow?.document;
    if (!doc?.documentElement) return;
    doc.documentElement.style.overflow = "hidden";
    if (doc.body) doc.body.style.overflow = "hidden";
    const measure = () => {
      const body = doc.body;
      const height = Math.max(
        doc.documentElement.scrollHeight,
        doc.documentElement.offsetHeight,
        body?.scrollHeight ?? 0,
        body?.offsetHeight ?? 0
      );
      if (height > 0) setPreviewHeight(height + 2);
    };
    measure();
    requestAnimationFrame(measure);
    doc.querySelectorAll("img").forEach((img) => {
      if (img.complete) measure();
      else img.addEventListener("load", measure, { once: true });
    });
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(fitPreviewToContent);
    return () => cancelAnimationFrame(frame);
  }, [previewHtml, fitPreviewToContent]);

  useEffect(() => {
    if (tab !== "compose") return;
    const pane = previewPaneRef.current;
    if (!pane) return;
    const updateScale = () => {
      const available = pane.clientWidth;
      setPreviewScale(available > 0 ? Math.min(1, available / EMAIL_PREVIEW_WIDTH) : 1);
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(pane);
    return () => observer.disconnect();
  }, [tab]);

  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const res = await fetch("/api/admin/email-templates", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load templates");
      const data = await res.json();
      setTemplates(data);
      if (data.length > 0 && !selectedId) setSelectedId(data[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setTemplatesLoading(false);
    }
  }, [selectedId]);

  const fetchPreview = useCallback(async (templateId: string, draft?: ConfirmationCopyDraft | null) => {
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/admin/email-preview", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          experienceTitle: draft?.experienceTitle,
          logistics: draft?.logistics,
        }),
      });
      if (!res.ok) throw new Error("Failed to load preview");
      const html = await res.text();
      setPreviewHtml(html);
    } catch {
      setPreviewHtml("<p style='padding:16px;color:#c00'>Failed to load preview.</p>");
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const fetchOutboxStats = useCallback(async () => {
    setOutboxStatsLoading(true);
    try {
      const res = await fetch("/api/admin/notification-outbox-stats", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load outbox stats");
      const data = await res.json();
      setOutboxStats({
        pending: typeof data.pending === "number" ? data.pending : 0,
        deadLetter: typeof data.deadLetter === "number" ? data.deadLetter : 0,
        stuckClaims: typeof data.stuckClaims === "number" ? data.stuckClaims : 0,
        byType: data.byType,
        reminderRetryQueue: data.reminderRetryQueue,
        staleClaimCountsByTemplate: data.staleClaimCountsByTemplate,
        reminderRetryDeadLetterTotal:
          typeof data.reminderRetryDeadLetterTotal === "number" ? data.reminderRetryDeadLetterTotal : undefined,
      });
    } catch {
      setOutboxStats(null);
    } finally {
      setOutboxStatsLoading(false);
    }
  }, []);

  const fetchNotificationStatus = useCallback(async () => {
    setDeliveryFailuresLoading(true);
    try {
      const res = await fetch("/api/admin/notification-status?limit=80", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load notification status");
      const data = await res.json();
      const outbox = Array.isArray(data.notificationOutboxDeadLetters) ? data.notificationOutboxDeadLetters : [];
      const reminders = Array.isArray(data.reminderRetryFailures) ? data.reminderRetryFailures : [];
      setDeliveryFailures([
        ...outbox.map((row: { id: string; bookingId: string; type?: string; lastError?: string | null; attemptCount?: number }) => ({
          id: row.id,
          bookingId: row.bookingId,
          type: row.type,
          lastError: row.lastError ?? null,
          attemptCount: row.attemptCount ?? 0,
          source: "outbox" as const,
        })),
        ...reminders.map(
          (row: {
            id: string;
            bookingId: string;
            templateKey?: string;
            status?: string;
            lastError?: string | null;
            attemptCount?: number;
          }) => ({
            id: row.id,
            bookingId: row.bookingId,
            templateKey: row.templateKey,
            status: row.status,
            lastError: row.lastError ?? null,
            attemptCount: row.attemptCount ?? 0,
            source: "reminder" as const,
          })
        ),
      ]);
    } catch {
      setDeliveryFailures([]);
    } finally {
      setDeliveryFailuresLoading(false);
    }
  }, []);

  const fetchLog = useCallback(async () => {
    setLogLoading(true);
    try {
      const res = await fetch("/api/admin/email-log?limit=200", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load email log");
      const data = await res.json();
      setLog(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLogLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
    fetchLog();
    fetchOutboxStats();
    fetchNotificationStatus();
  }, [fetchTemplates, fetchLog, fetchOutboxStats, fetchNotificationStatus]);

  useEffect(() => {
    if (tab !== "delivery") return;
    void fetchOutboxStats();
    void fetchNotificationStatus();
    void fetchLog();
  }, [tab, fetchOutboxStats, fetchNotificationStatus, fetchLog]);

  useEffect(() => {
    if (!selectedId) return;
    const handle = window.setTimeout(() => {
      void fetchPreview(selectedId, copyDraft);
    }, 350);
    return () => window.clearTimeout(handle);
  }, [selectedId, copyDraft, fetchPreview]);

  const deliveryIssueCount = useMemo(() => {
    if (!outboxStats) return deliveryFailures.length;
    const dead =
      (outboxStats.byType?.booking_confirmation?.deadLetter ?? outboxStats.deadLetter) +
      (outboxStats.byType?.final_charge_success?.deadLetter ?? 0) +
      (outboxStats.byType?.discount_limit_exceeded_notification?.deadLetter ?? 0) +
      (outboxStats.byType?.waiver_invite_send?.deadLetter ?? 0) +
      (outboxStats.reminderRetryDeadLetterTotal ?? 0);
    const stuck =
      (outboxStats.byType?.booking_confirmation?.stuckClaims ?? outboxStats.stuckClaims) +
      (outboxStats.byType?.final_charge_success?.stuckClaims ?? 0) +
      (outboxStats.byType?.waiver_invite_send?.stuckClaims ?? 0);
    return dead + stuck;
  }, [outboxStats, deliveryFailures.length]);

  const sentPageCount = Math.max(1, Math.ceil(log.length / SENT_PAGE_SIZE));
  const safeSentPage = Math.min(sentPage, sentPageCount - 1);
  const pagedLog = log.slice(safeSentPage * SENT_PAGE_SIZE, (safeSentPage + 1) * SENT_PAGE_SIZE);

  const selectedTemplate = templates.find((t) => t.id === selectedId);

  return (
    <div
      className={cn(
        "flex flex-col gap-6",
        // Delivery/Sent stay viewport-bound; Compose grows with the full email preview.
        tab !== "compose" && "xl:h-[calc(100vh-6rem)]"
      )}
    >
      <section className="relative shrink-0 overflow-hidden rounded-3xl bg-brand-dark px-5 py-6 text-white shadow-premium sm:px-8 sm:py-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-brand-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-brand-secondary/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-primary">Notifications</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">Customer emails</h1>
            <p className="mt-2 max-w-xl text-sm text-white/70">
              Edit pickup and reminder copy per listing, then preview the exact email customers receive.
            </p>
          </div>
          <div className="inline-flex flex-wrap rounded-full bg-white/10 p-1">
            {(
              [
                ["compose", "Compose", Mail],
                ["delivery", "Delivery", Inbox],
                ["sent", "Sent", Send],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all",
                  tab === id ? "bg-white text-brand-dark shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
                {id === "delivery" && deliveryIssueCount > 0 ? (
                  <span className="rounded-full bg-amber-300/90 px-1.5 py-0.5 text-[10px] text-amber-950">
                    {deliveryIssueCount}
                  </span>
                ) : null}
                {id === "sent" && log.length > 0 ? (
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[10px]", tab === id ? "bg-brand-dark/10" : "bg-white/15")}>
                    {log.length}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </section>

      {error && tab !== "compose" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>
      )}

      {tab === "compose" && (
        <div className="grid min-h-[32rem] grid-cols-1 items-start gap-6 xl:grid-cols-2">
          <div className="min-h-[28rem] min-w-0 xl:sticky xl:top-4 xl:max-h-[calc(100vh-8rem)] xl:overflow-auto">
            <ConfirmationEmailCopyEditor onDraftChange={setCopyDraft} />
          </div>
          <div className="flex min-h-[28rem] min-w-0">
            <div className="flex w-full flex-col overflow-hidden rounded-3xl border border-brand-dark/10 bg-white shadow-sm">
              <div className="shrink-0 border-b border-brand-dark/10 px-4 py-3 sm:px-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-muted">Preview</p>
                    <p className="text-sm font-semibold text-brand-dark">
                      {selectedTemplate?.name ?? "Email"}
                      {copyDraft?.experienceTitle ? (
                        <span className="font-normal text-brand-muted"> · {copyDraft.experienceTitle}</span>
                      ) : null}
                    </p>
                  </div>
                  {previewLoading ? <span className="text-xs text-brand-muted">Updating…</span> : null}
                </div>
                {templatesLoading ? (
                  <p className="mt-3 text-xs text-brand-muted">Loading templates…</p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {templates.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedId(t.id)}
                        className={cn(
                          "rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
                          selectedId === t.id
                            ? "bg-brand-dark text-white"
                            : "bg-brand-bg text-brand-muted hover:bg-brand-dark/10 hover:text-brand-dark"
                        )}
                      >
                        {TEMPLATE_SHORT[t.id] ?? t.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div ref={previewPaneRef} className="bg-[#e8f4f6] p-4 sm:p-6">
                {previewHtml ? (
                  <div
                    className="mx-auto"
                    style={{
                      width: EMAIL_PREVIEW_WIDTH * previewScale,
                      height: Math.max(previewHeight, 480) * previewScale,
                    }}
                  >
                    <iframe
                      ref={previewIframeRef}
                      title="Email preview"
                      srcDoc={previewHtml}
                      onLoad={fitPreviewToContent}
                      scrolling="no"
                      style={{
                        width: EMAIL_PREVIEW_WIDTH,
                        height: previewHeight,
                        minHeight: 480,
                        transform: `scale(${previewScale})`,
                        transformOrigin: "top left",
                      }}
                      className="block border-0 bg-transparent"
                      sandbox="allow-same-origin"
                    />
                  </div>
                ) : (
                  <div className="flex min-h-[320px] items-center justify-center text-sm text-brand-muted">
                    {previewLoading ? "Loading preview…" : "Select a template to preview."}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "delivery" && (
        <div className="min-h-0 flex-1 overflow-auto">
          <DeliveryPanel
            stats={outboxStats}
            statsLoading={outboxStatsLoading}
            log={log}
            logLoading={logLoading}
            failures={deliveryFailures}
            failuresLoading={deliveryFailuresLoading}
            onRefresh={() => {
              void fetchOutboxStats();
              void fetchNotificationStatus();
              void fetchLog();
            }}
          />
        </div>
      )}

      {tab === "sent" && (
        <div className="min-h-0 flex-1 overflow-auto">
          <SentLog
            log={pagedLog}
            loading={logLoading}
            total={log.length}
            page={safeSentPage}
            pageCount={sentPageCount}
            onPage={setSentPage}
          />
        </div>
      )}
    </div>
  );
}

function DeliveryPanel({
  stats,
  statsLoading,
  log,
  logLoading,
  failures,
  failuresLoading,
  onRefresh,
}: {
  stats: OutboxStats | null;
  statsLoading: boolean;
  log: EmailLogEntry[];
  logLoading: boolean;
  failures: DeliveryFailure[];
  failuresLoading: boolean;
  onRefresh: () => void;
}) {
  const customerLog = log.filter((e) => e.audience !== "staff");
  const sentByTemplate = customerLog.reduce<Record<string, number>>((acc, entry) => {
    const key = entry.templateId || "unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const sentRows = Object.entries(sentByTemplate).sort((a, b) => b[1] - a[1]);
  const latest = customerLog[0] ?? log[0];
  const activeRetryRows = Object.entries(stats?.reminderRetryQueue ?? {}).filter(([, row]) => {
    return row.pending + row.sent + row.deadLetter + row.skipped > 0;
  });
  const cards = [
    {
      label: "Booking confirmation",
      pending: stats?.byType?.booking_confirmation?.pending ?? stats?.pending ?? 0,
      dead: stats?.byType?.booking_confirmation?.deadLetter ?? stats?.deadLetter ?? 0,
      stuck: stats?.byType?.booking_confirmation?.stuckClaims ?? stats?.stuckClaims ?? 0,
    },
    {
      label: "Final charge receipt",
      pending: stats?.byType?.final_charge_success?.pending ?? 0,
      dead: stats?.byType?.final_charge_success?.deadLetter ?? 0,
      stuck: stats?.byType?.final_charge_success?.stuckClaims ?? 0,
    },
    {
      label: "Waiver invites",
      pending: stats?.byType?.waiver_invite_send?.pending ?? 0,
      dead: stats?.byType?.waiver_invite_send?.deadLetter ?? 0,
      stuck: stats?.byType?.waiver_invite_send?.stuckClaims ?? 0,
    },
    {
      label: "Discount limit notices",
      pending: stats?.byType?.discount_limit_exceeded_notification?.pending ?? 0,
      dead: stats?.byType?.discount_limit_exceeded_notification?.deadLetter ?? 0,
      stuck: stats?.byType?.discount_limit_exceeded_notification?.stuckClaims ?? 0,
    },
  ];
  const queueIssueCount = cards.reduce((n, c) => n + c.pending + c.dead + c.stuck, 0) + (stats?.reminderRetryDeadLetterTotal ?? 0);
  const loading = statsLoading && logLoading && failuresLoading;

  if (loading) {
    return (
      <div className="rounded-3xl border border-brand-dark/10 bg-white p-8 text-sm text-brand-muted shadow-sm">
        Loading delivery status…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-3xl border border-brand-dark/10 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          {queueIssueCount === 0 && failures.length === 0 ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
          ) : (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          )}
          <div>
            <p className="text-sm font-semibold text-brand-dark">
              {queueIssueCount === 0 && failures.length === 0
                ? "Send pipeline is connected and clear"
                : `${queueIssueCount + failures.length} item${queueIssueCount + failures.length === 1 ? "" : "s"} need attention`}
            </p>
            <p className="mt-1 text-sm text-brand-muted">
              {logLoading
                ? "Loading recent sends…"
                : latest
                  ? `Last send: ${templateLabel(latest.templateId)} to ${latest.toName || latest.to} · ${formatSentAt(latest.sentAt)}`
                  : "No sends in the email log yet."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-brand-dark/10 px-3 py-2 text-sm font-semibold text-brand-dark hover:bg-brand-bg"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Refresh
        </button>
      </div>

      <div className="overflow-hidden rounded-3xl border border-brand-dark/10 bg-white shadow-sm">
        <div className="border-b border-brand-dark/10 px-5 py-4">
          <h2 className="text-sm font-semibold text-brand-dark">Recent sends from the live log</h2>
          <p className="mt-1 text-xs text-brand-muted">
            {logLoading ? "Loading…" : `${customerLog.length} customer message${customerLog.length === 1 ? "" : "s"} in the latest ${log.length} log rows.`}
          </p>
        </div>
        {sentRows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-brand-muted">No customer emails in the log yet.</p>
        ) : (
          <ul className="divide-y divide-brand-dark/5">
            {sentRows.map(([id, count]) => (
              <li key={id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="font-medium text-brand-dark">{templateLabel(id)}</span>
                <span className="tabular-nums text-brand-muted">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {statsLoading && !stats ? (
        <p className="text-sm text-brand-muted">Loading outbox queues…</p>
      ) : !stats ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Could not load the send queues. Recent sends above still come from the email log.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <div key={card.label} className="rounded-3xl border border-brand-dark/10 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-brand-dark">{card.label}</p>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-brand-muted">Pending</dt>
                  <dd className="mt-1 font-display text-2xl font-bold tabular-nums text-brand-dark">{card.pending}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-brand-muted">Failed</dt>
                  <dd className={cn("mt-1 font-display text-2xl font-bold tabular-nums", card.dead > 0 ? "text-amber-700" : "text-brand-dark")}>
                    {card.dead}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-brand-muted">Stuck</dt>
                  <dd className={cn("mt-1 font-display text-2xl font-bold tabular-nums", card.stuck > 0 ? "text-amber-700" : "text-brand-dark")}>
                    {card.stuck}
                  </dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-3xl border border-brand-dark/10 bg-white shadow-sm">
        <div className="border-b border-brand-dark/10 px-5 py-4">
          <h2 className="text-sm font-semibold text-brand-dark">Failed sends</h2>
          <p className="mt-1 text-xs text-brand-muted">Dead letters and reminder retries that did not go out.</p>
        </div>
        {failuresLoading ? (
          <p className="px-5 py-6 text-sm text-brand-muted">Loading failures…</p>
        ) : failures.length === 0 ? (
          <p className="px-5 py-6 text-sm text-brand-muted">No failed sends right now.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-brand-dark/10 bg-brand-bg/50 text-left">
                  <th className="px-4 py-3 font-medium text-brand-muted">Type</th>
                  <th className="px-4 py-3 font-medium text-brand-muted">Booking</th>
                  <th className="px-4 py-3 font-medium text-brand-muted">Attempts</th>
                  <th className="px-4 py-3 font-medium text-brand-muted">Error</th>
                </tr>
              </thead>
              <tbody>
                {failures.map((row) => (
                  <tr key={`${row.source}-${row.id}`} className="border-b border-brand-dark/5">
                    <td className="px-4 py-3 text-brand-dark">{templateLabel(row.templateKey || row.type || row.source)}</td>
                    <td className="px-4 py-3">
                      <a href={`/admin/bookings?highlight=${row.bookingId}`} className="text-brand-primary hover:underline">
                        {row.bookingId.slice(0, 8)}…
                      </a>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{row.attemptCount}</td>
                    <td className="max-w-[360px] truncate px-4 py-3 text-xs text-brand-muted" title={row.lastError ?? ""}>
                      {row.lastError ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {typeof stats?.reminderRetryDeadLetterTotal === "number" && stats.reminderRetryDeadLetterTotal > 0 ? (
        <p className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {stats.reminderRetryDeadLetterTotal} reminder retries are dead-lettered and need attention.
        </p>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-brand-dark/10 bg-white shadow-sm">
        <div className="border-b border-brand-dark/10 px-5 py-4">
          <h2 className="text-sm font-semibold text-brand-dark">Reminder retry queue</h2>
        </div>
        {activeRetryRows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-brand-muted">No reminder retries waiting.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-brand-dark/10 bg-brand-bg/50 text-left">
                  <th className="px-4 py-3 font-medium text-brand-muted">Template</th>
                  <th className="px-4 py-3 font-medium text-brand-muted">Pending</th>
                  <th className="px-4 py-3 font-medium text-brand-muted">Sent</th>
                  <th className="px-4 py-3 font-medium text-brand-muted">Failed</th>
                  <th className="px-4 py-3 font-medium text-brand-muted">Skipped</th>
                  <th className="px-4 py-3 font-medium text-brand-muted">Last error</th>
                </tr>
              </thead>
              <tbody>
                {activeRetryRows.map(([key, row]) => (
                  <tr key={key} className="border-b border-brand-dark/5">
                    <td className="px-4 py-3 text-brand-dark">{templateLabel(key)}</td>
                    <td className="px-4 py-3 tabular-nums">{row.pending}</td>
                    <td className="px-4 py-3 tabular-nums">{row.sent}</td>
                    <td className="px-4 py-3 tabular-nums">{row.deadLetter}</td>
                    <td className="px-4 py-3 tabular-nums">{row.skipped}</td>
                    <td className="max-w-[280px] truncate px-4 py-3 text-xs text-brand-muted" title={row.lastErrorSnippet}>
                      {row.lastErrorSnippet ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {stats?.staleClaimCountsByTemplate && Object.keys(stats.staleClaimCountsByTemplate).length > 0 ? (
        <div className="rounded-3xl border border-brand-dark/10 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-brand-dark">Stale send claims</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {Object.entries(stats.staleClaimCountsByTemplate).map(([k, n]) => (
              <li key={k} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-950">
                <span className="font-mono">{k}</span> · {n}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function SentLog({
  log,
  loading,
  total,
  page,
  pageCount,
  onPage,
}: {
  log: EmailLogEntry[];
  loading: boolean;
  total: number;
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-brand-dark/10 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-brand-dark/10 px-5 py-4">
        <h2 className="text-sm font-semibold text-brand-dark">Emails sent</h2>
        {total > SENT_PAGE_SIZE ? (
          <div className="flex items-center gap-2 text-xs text-brand-muted">
            <span>
              {page * SENT_PAGE_SIZE + 1}–{Math.min(total, (page + 1) * SENT_PAGE_SIZE)} of {total}
            </span>
            <button
              type="button"
              onClick={() => onPage(page - 1)}
              disabled={page <= 0}
              className="rounded-lg border border-brand-dark/10 px-2 py-1 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => onPage(page + 1)}
              disabled={page >= pageCount - 1}
              className="rounded-lg border border-brand-dark/10 px-2 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
      {loading ? (
        <div className="p-8 text-center text-sm text-brand-muted">Loading…</div>
      ) : total === 0 ? (
        <div className="p-8 text-center text-sm text-brand-muted">No emails sent yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-brand-dark/10 bg-brand-bg/50">
                <th className="px-4 py-3 text-left font-medium text-brand-muted">To</th>
                <th className="px-4 py-3 text-left font-medium text-brand-muted">Audience</th>
                <th className="px-4 py-3 text-left font-medium text-brand-muted">Channel</th>
                <th className="px-4 py-3 text-left font-medium text-brand-muted">Template</th>
                <th className="px-4 py-3 text-left font-medium text-brand-muted">Subject</th>
                <th className="px-4 py-3 text-left font-medium text-brand-muted">Booking</th>
                <th className="px-4 py-3 text-left font-medium text-brand-muted">Sent at</th>
              </tr>
            </thead>
            <tbody>
              {log.map((entry) => (
                <tr key={entry.id} className="border-b border-brand-dark/5 hover:bg-brand-bg/30">
                  <td className="px-4 py-3">
                    <span className="font-medium text-brand-dark">{entry.toName || entry.to}</span>
                    {entry.toName ? <span className="block text-xs text-brand-muted">{entry.to}</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        entry.audience === "staff" ? "bg-violet-100 text-violet-800" : "bg-slate-100 text-slate-700"
                      )}
                    >
                      {entry.audience === "staff" ? "Staff" : "Customer"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        (entry.channel ?? "email") === "sms" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"
                      )}
                    >
                      {(entry.channel ?? "email") === "sms" ? "SMS" : "Email"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-brand-muted">{entry.templateId}</td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-brand-dark" title={entry.subject}>
                    {entry.subject}
                  </td>
                  <td className="px-4 py-3 text-brand-muted">
                    {entry.bookingId ? (
                      <a href={`/admin/bookings?highlight=${entry.bookingId}`} className="text-brand-primary hover:underline">
                        {entry.bookingId.slice(0, 8)}…
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-brand-muted">{formatSentAt(entry.sentAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
