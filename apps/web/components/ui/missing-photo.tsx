/**
 * Emplacement d'une photo absente : jamais une image cassée, jamais une photo inventée —
 * une tuile neutre qui dit simplement que la photo manque.
 */
export function MissingPhoto({ label = "Photo à venir", dark = false }: { label?: string; dark?: boolean }) {
  return (
    <span
      className={`absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_40%,color-mix(in_srgb,var(--color-primary)_10%,transparent),transparent_70%)] text-[12px] font-medium uppercase tracking-[0.14em] ${dark ? "text-white/80" : "text-[var(--color-text-muted,#6b7280)]"}`}
    >
      {label}
    </span>
  );
}
