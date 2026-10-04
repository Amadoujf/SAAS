import { WEEKDAYS_SHORT, clockLabel, type Slot } from "@/lib/education/labels";

/** Emploi du temps d'une classe, en grille (lundi → samedi) ; liste sur petit écran. */
export function Timetable({ schedule }: { schedule: Slot[] }) {
  if (!schedule.length) return <p className="text-[14px] text-[var(--color-text-muted)]">Horaires communiqués à l&apos;inscription.</p>;
  const days = [1, 2, 3, 4, 5, 6, 0].filter((d) => d !== 0 || schedule.some((s) => s.weekday === 0));
  return (
    <ol className="grid grid-cols-3 gap-1.5 sm:grid-cols-6" aria-label="Emploi du temps">
      {days.map((d) => {
        const slots = schedule.filter((s) => s.weekday === d);
        return (
          <li key={d} className={`min-w-0 rounded-[var(--radius-sm)] p-2 text-center ring-1 ring-inset ${slots.length ? "bg-[var(--color-secondary)] text-white ring-transparent" : "ring-[var(--color-border)] text-[var(--color-text-muted)]"}`}>
            <span className="block text-[12px] font-semibold uppercase tracking-[0.1em]">{WEEKDAYS_SHORT[d]}</span>
            {slots.length ? slots.map((s) => <span key={s.startMinute} className="yc-num block text-[12.5px] leading-snug">{clockLabel(s.startMinute)}–{clockLabel(s.endMinute)}</span>) : <span className="block text-[12.5px]">—</span>}
          </li>
        );
      })}
    </ol>
  );
}
