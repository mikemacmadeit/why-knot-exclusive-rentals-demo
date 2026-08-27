"use client";

import { usePathname } from "next/navigation";
import { WaiversSectionTabs } from "./WaiversSectionTabs";
import { PlanFeatureGate } from "@/components/admin/PlanFeatureGate";

export default function WaiversLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isList =
    pathname === "/admin/waivers/templates" || pathname === "/admin/waivers/requests";
  const isPrint = pathname?.includes("/qr-print");

  return (
    <PlanFeatureGate feature="waivers">
      {isPrint ? (
        <>{children}</>
      ) : (
        <div className="space-y-6 sm:space-y-8">
          {!isList && <WaiversSectionTabs />}
          {children}
        </div>
      )}
    </PlanFeatureGate>
  );
}
