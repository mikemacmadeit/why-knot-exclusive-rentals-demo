"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  WaiverTemplateForm,
  defaultWaiverTemplateFormValues,
  formValuesToPayload,
} from "@/components/waiver/WaiverTemplateForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewWaiverTemplatePage() {
  const router = useRouter();
  const [value, setValue] = useState(defaultWaiverTemplateFormValues);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/waiver-templates", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formValuesToPayload(value)),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to create");
      router.push("/admin/waivers/templates");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-brand-dark px-5 py-6 text-white shadow-premium sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-brand-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-brand-secondary/20 blur-3xl" />
        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-primary">Waivers</p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">Create template</h1>
          <p className="mt-2 max-w-xl text-sm text-white/70">
            Set up the waiver guests will sign. You can edit it later and track signatures from Tracking.
          </p>
          <Link
            href="/admin/waivers/templates"
            className="mt-5 inline-flex text-xs font-semibold text-brand-primary hover:underline"
          >
            ← Back to templates
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <WaiverTemplateForm
            value={value}
            onChange={setValue}
            onSubmit={handleSubmit}
            isNew
            saving={loading}
            error={error}
            submitLabel="Create template"
            cancelHref="/admin/waivers/templates"
          />
        </div>
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="text-sm">What guests will see</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-brand-muted space-y-2">
              <p>Guests get a link by email. They’ll go through:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Booking summary</li>
                <li>Their info (name, email{value.requiredFields.phone && ", phone"}
                  {value.requiredFields.dob && ", date of birth"})</li>
                <li>Terms and “I agree”</li>
                {value.clauses.filter((c) => c.requiresInitials).length > 0 && (
                  <li>Initials for {value.clauses.filter((c) => c.requiresInitials).length} clause(s)</li>
                )}
                <li>Signature ({value.signature.mode === "draw" ? "draw" : value.signature.mode === "type" ? "type" : "draw + type"})</li>
              </ol>
              <p className="pt-2 text-xs">
                After you create this template, new bookings can automatically get a waiver request and signing link.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
