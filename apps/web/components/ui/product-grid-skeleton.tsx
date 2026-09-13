/**
 * Squelette de chargement pour une grille de produits — générique, réutilisable par
 * n'importe quel template/section. Purement visuel (pas d'état de chargement réel côté
 * données de démonstration statiques), utilisé pour documenter l'état "chargement"
 * demandé dans la checklist de captures (voir la demande du 20 septembre 2026).
 */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-label="Chargement des produits"
      className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4 lg:gap-8"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="animate-pulse">
          <div className="aspect-[3/4] rounded-[var(--card-radius)] bg-[var(--color-surface-muted)]" />
          <div className="mt-4 h-4 w-3/4 rounded bg-[var(--color-surface-muted)]" />
          <div className="mt-2 h-4 w-1/3 rounded bg-[var(--color-surface-muted)]" />
        </div>
      ))}
    </div>
  );
}
