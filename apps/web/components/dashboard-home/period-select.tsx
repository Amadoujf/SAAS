"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { IconClock } from "@/components/yc/icons";

export const PERIOD_OPTIONS = [
  { value: "month", label: "Ce mois-ci" },
  { value: "7d", label: "7 derniers jours" },
  { value: "30d", label: "30 derniers jours" },
  { value: "90d", label: "90 derniers jours" },
] as const;

/** Période des indicateurs, portée par l'URL (?periode=) : partageable et
 *  recalculée côté serveur. */
export function PeriodSelect({ value, className = "" }: { value: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  return (
    <label className={`relative flex h-11 items-center gap-2 rounded-lg border border-yc-ink/15 bg-white pl-3.5 pr-3 text-[15px] font-medium text-yc-ink focus-within:ring-2 focus-within:ring-yc-electric/30 ${pending ? "opacity-70" : ""} ${className}`}>
      <IconClock size={18} className="shrink-0 text-yc-ink-soft" />
      <span className="sr-only">Période</span>
      <select
        value={value}
        aria-busy={pending || undefined}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          if (e.target.value === "month") next.delete("periode");
          else next.set("periode", e.target.value);
          start(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
        }}
        className="h-full min-w-0 flex-1 cursor-pointer appearance-none bg-transparent pr-6 outline-none"
      >
        {PERIOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <svg width="14" height="14" viewBox="0 0 12 12" aria-hidden="true" className="pointer-events-none absolute right-3.5"><path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg>
    </label>
  );
}
