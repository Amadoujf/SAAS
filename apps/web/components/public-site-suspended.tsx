/**
 * Écran affiché quand le tenant résolu par hôte est SUSPENDU — voir docs/12 §12.3,
 * « RENDU PUBLIC » : « retourner une page correcte si le site est suspendu » (jamais un
 * simple 404 générique, qui laisserait croire que le site n'a jamais existé).
 */
export function PublicSiteSuspended({ tenantName }: { tenantName: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-2xl font-semibold text-gray-900">{tenantName}</h1>
      <p className="text-gray-600">
        Ce site est temporairement indisponible. Veuillez réessayer plus tard.
      </p>
    </main>
  );
}
