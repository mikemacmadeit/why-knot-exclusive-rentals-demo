"use client";

import { useParams } from "next/navigation";
import { CustomerProfile } from "@/components/admin/CustomerProfile";

export default function AdminCustomerProfilePage() {
  const params = useParams();
  const raw = typeof params.email === "string" ? params.email : Array.isArray(params.email) ? params.email[0] : "";
  let email = "";
  try {
    email = decodeURIComponent(raw).trim();
  } catch {
    email = raw.trim();
  }

  if (!email) {
    return <p className="text-sm text-brand-muted">Missing email.</p>;
  }

  return <CustomerProfile email={email} />;
}
