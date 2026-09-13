/**
 * Skeleton loader générique — voir docs/12 §12.3 (« skeletons adaptés à la mise en page
 * réelle, pas un rectangle générique »). Chaque section fournit son propre agencement
 * de blocs plutôt que d'utiliser un unique rectangle passe-partout.
 */
export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-[var(--radius-md)] bg-[var(--color-surface-muted)] ${className ?? ""}`}
      aria-hidden="true"
    />
  );
}
