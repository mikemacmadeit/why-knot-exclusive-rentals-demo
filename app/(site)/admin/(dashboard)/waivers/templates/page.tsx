"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { WaiversSectionTabs } from "../WaiversSectionTabs";

type TemplateItem = {
  id: string;
  title: string;
  description: string;
  isActive: boolean;
  version: number;
};

export default function WaiverTemplatesPage() {
  const [list, setList] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/waiver-templates", { credentials: "include" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Failed to load");
        return data.templates ?? [];
      })
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const active = list.filter((t) => t.isActive).length;
    return { count: list.length, active, inactive: list.length - active };
  }, [list]);

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-brand-dark px-5 py-6 text-white shadow-premium sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-brand-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-brand-secondary/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-primary">Waivers</h1>
            <p className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">
              {loading ? "—" : stats.count.toLocaleString()}
            </p>
            <p className="mt-2 text-sm text-white/70">Templates guests sign before a trip</p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <div className="min-w-[140px] rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/55">Active</p>
              <p className="mt-1 text-lg font-bold">{loading ? "—" : stats.active.toLocaleString()}</p>
              <p className="text-[11px] text-white/60">Ready to send</p>
            </div>
            <div className="min-w-[140px] rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/55">Inactive</p>
              <p className="mt-1 text-lg font-bold">{loading ? "—" : stats.inactive.toLocaleString()}</p>
              <p className="text-[11px] text-white/60">Not used on new bookings</p>
            </div>
          </div>
        </div>
        <div className="relative mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
          <WaiversSectionTabs variant="hero" />
          <Link
            href="/admin/waivers/templates/new"
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-brand-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-primary/90"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            New template
          </Link>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      {loading && (
        <div className="overflow-hidden rounded-3xl border border-brand-dark/10 bg-white px-6 py-16 text-center text-sm text-brand-muted shadow-sm">
          Loading templates…
        </div>
      )}

      {!loading && !error && list.length === 0 && (
        <div className="overflow-hidden rounded-3xl border border-brand-dark/10 bg-white px-6 py-16 text-center shadow-sm">
          <FileText className="mx-auto h-10 w-10 text-brand-primary/40" aria-hidden />
          <p className="mt-3 text-sm font-medium text-brand-dark">No templates yet</p>
          <p className="mx-auto mt-2 max-w-md text-xs text-brand-muted">
            Create one to start sending waiver requests with bookings.
          </p>
          <Link
            href="/admin/waivers/templates/new"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-primary hover:underline"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New template
          </Link>
        </div>
      )}

      {!loading && !error && list.length > 0 && (
        <div className="overflow-hidden rounded-3xl border border-brand-dark/10 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-brand-dark/10 px-5 py-4 sm:px-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-brand-dark">
              <FileText className="h-5 w-5 text-brand-primary" aria-hidden />
              Templates
            </h2>
            <p className="text-xs text-brand-muted">Click a row to edit</p>
          </div>
          <ul className="divide-y divide-brand-dark/5">
            {list.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/admin/waivers/templates/${t.id}`}
                  className="flex flex-wrap items-center gap-3 px-5 py-4 transition-colors hover:bg-brand-bg/80 sm:px-6"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-brand-dark">{t.title}</p>
                    {t.description ? (
                      <p className="mt-0.5 truncate text-xs text-brand-muted">{t.description}</p>
                    ) : null}
                  </div>
                  <span className="text-xs text-brand-muted">v{t.version}</span>
                  <span
                    className={
                      t.isActive
                        ? "inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800"
                        : "inline-flex rounded-full bg-brand-dark/10 px-2.5 py-0.5 text-xs font-medium text-brand-muted"
                    }
                  >
                    {t.isActive ? "Active" : "Inactive"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
