import { clockLabel } from "@/lib/restaurant/labels";

/** « Ouvert · jusqu'à 23 h » / « Fermé · ouvre à 11 h ». */
export function ServicePill({ service, dark = false }: { service: { open: boolean; closesAt: number | null; next: { date: string; minute: number } | null; today: string }; dark?: boolean }) {
  const text = service.open
    ? `Ouvert · jusqu'à ${clockLabel(service.closesAt ?? 0)}`
    : service.next
      ? `Fermé · ouvre ${service.next.date === service.today ? "" : "prochainement "}à ${clockLabel(service.next.minute)}`
      : "Fermé";
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-semibold ${dark ? "bg-white/10 text-white" : "bg-white text-[var(--color-text-primary)] ring-1 ring-[var(--color-border)]"}`}>
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${service.open ? "bg-[#2FBF6A]" : "bg-[var(--color-accent-secondary)]"}`} />
      {text}
    </span>
  );
}
