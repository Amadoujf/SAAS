export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`yc-skeleton rounded-lg ${className}`} />;
}

/** Squelette d'une liste de commandes : même rythme que la vraie liste (ligne,
 *  pastille de statut, montant aligné à droite). */
export function OrderListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Chargement des commandes" className="divide-y divide-yc-ink/5">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="hidden h-6 w-24 rounded-full sm:block" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

export function StatSkeleton() {
  return (
    <div className="rounded-yc-lg bg-white p-5 ring-1 ring-yc-ink/[0.06]">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-8 w-32" />
      <Skeleton className="mt-4 h-10 w-full" />
    </div>
  );
}
