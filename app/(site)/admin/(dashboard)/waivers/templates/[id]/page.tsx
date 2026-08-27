"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  WaiverTemplateForm,
  templateToFormValues,
  formValuesToPayload,
  type WaiverTemplateFormValues,
} from "@/components/waiver/WaiverTemplateForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WaiverQrPanel } from "@/components/waiver/WaiverQrPanel";

type Template = {
  id: string;
  title: string;
  description: string;
  isActive: boolean;
  termsHtml: string;
  requiredFields: { dob: boolean; phone: boolean; address: boolean; bookingDate: boolean };
  clauses: { id: string; label: string; requiresInitials: boolean }[];
  signature: { mode: string; requireTypedName: boolean };
  version: number;
};

export default function EditWaiverTemplatePage() {
  const params = useParams();
  const id = params.id as string;
  const [template, setTemplate] = useState<Template | null>(null);
  const [value, setValue] = useState<WaiverTemplateFormValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/waiver-templates/${id}`, { credentials: "include" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Failed to load");
        return data;
      })
      .then((t) => {
        setTemplate(t);
        setValue(templateToFormValues(t));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/waiver-templates/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formValuesToPayload(value)),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      setTemplate((prev) =>
        prev ? { ...prev, ...data, version: data.version ?? prev.version + 1 } : null
      );
      setValue(templateToFormValues(data));
      setSaving(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="overflow-hidden rounded-3xl border border-brand-dark/10 bg-white px-6 py-16 text-center text-sm text-brand-muted shadow-sm">
        Loading template…
      </div>
    );
  }
  if (error && !template) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>;
  }
  if (!template || !value) return null;

  return (
    <div className="space-y-6 sm:space-y-8 pb-24">
      <section className="relative overflow-hidden rounded-3xl bg-brand-dark px-5 py-6 text-white shadow-premium sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-brand-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-brand-secondary/20 blur-3xl" />
        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-primary">Waivers</p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">{template.title}</h1>
          <p className="mt-2 max-w-xl text-sm text-white/70">
            Changes create a new version. Existing signed waivers keep the version they used.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link href="/admin/waivers/templates" className="text-xs font-semibold text-brand-primary hover:underline">
              ← Templates
            </Link>
            <span className="inline-flex rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-white">
              v{template.version}
            </span>
            <span
              className={
                template.isActive
                  ? "inline-flex rounded-full bg-green-400/20 px-2.5 py-0.5 text-xs font-semibold text-green-100"
                  : "inline-flex rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-white/70"
              }
            >
              {template.isActive ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-8 xl:gap-10">
        <div className="xl:col-span-3 min-w-0">
          <WaiverTemplateForm
            value={value}
            onChange={setValue}
            onSubmit={handleSave}
            isNew={false}
            saving={saving}
            error={error}
            submitLabel="Save (new version)"
            cancelHref="/admin/waivers/templates"
          />
        </div>
        <div className="xl:col-span-2">
          <div className="sticky top-6 space-y-4">
            <Card className="rounded-2xl border border-brand-dark/10 shadow-sm overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-brand-dark">Live preview</CardTitle>
                <CardDescription className="text-xs">
                  How the terms and flow look to guests.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="mx-auto rounded-2xl border border-brand-dark/15 bg-white shadow-md overflow-hidden max-w-[300px] ring-1 ring-black/5">
                  <div className="bg-brand-dark/5 px-4 py-2.5 border-b border-brand-dark/10">
                    <span className="text-xs font-medium text-brand-muted">Guest view</span>
                  </div>
                  <div className="p-4 min-h-[320px] max-h-[440px] overflow-y-auto text-[13px]">
                    <p className="font-semibold text-brand-dark mb-3">{value.title}</p>
                    <div
                      className="prose prose-sm max-w-none text-brand-dark/90 prose-p:my-2 prose-ul:my-2 prose-li:my-0.5"
                      dangerouslySetInnerHTML={{
                        __html: value.termsHtml || "<p class='text-brand-muted italic'>No terms yet.</p>",
                      }}
                    />
                    {value.clauses.filter((c) => c.label.trim()).length > 0 && (
                      <div className="mt-4 pt-4 border-t border-brand-dark/10">
                        <p className="text-xs font-medium text-brand-muted mb-1.5">Acknowledgements</p>
                        <ul className="text-brand-dark space-y-1">
                          {value.clauses
                            .filter((c) => c.label.trim())
                            .map((c) => (
                              <li key={c.id} className="text-xs">
                                {c.label}
                                {c.requiresInitials && (
                                  <span className="text-brand-muted ml-1">(initials)</span>
                                )}
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <WaiverQrPanel templateId={id} />
    </div>
  );
}
