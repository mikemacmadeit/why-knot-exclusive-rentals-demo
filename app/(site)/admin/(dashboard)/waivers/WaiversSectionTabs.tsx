"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { FileText, ClipboardList } from "lucide-react";

const tabs = [
  { href: "/admin/waivers/templates", label: "Templates", icon: FileText },
  { href: "/admin/waivers/requests", label: "Tracking", icon: ClipboardList },
];

export function WaiversSectionTabs({
  variant = "light",
}: {
  variant?: "light" | "hero";
}) {
  const pathname = usePathname();
  return (
    <div
      className={cn(
        "inline-flex flex-wrap rounded-full p-1",
        variant === "hero" ? "bg-white/10" : "border border-brand-dark/10 bg-white shadow-sm"
      )}
    >
      {tabs.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wide transition-all",
              variant === "hero"
                ? isActive
                  ? "bg-white text-brand-dark shadow-sm"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
                : isActive
                  ? "bg-brand-dark text-white shadow-sm"
                  : "text-brand-muted hover:bg-brand-bg hover:text-brand-dark"
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
