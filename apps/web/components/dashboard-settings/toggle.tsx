"use client";

/** Interrupteur accessible (rôle switch, annoncé par les lecteurs d'écran). */
export function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-sm font-semibold text-yc-ink">{label}</span>
        {description && <span className="block text-xs text-yc-ink-soft">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`yc-focus relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors duration-300 ${checked ? "bg-yc-electric" : "bg-yc-ink/15"}`}
      >
        <span className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 ease-yc ${checked ? "translate-x-5" : ""}`} />
      </button>
    </label>
  );
}
