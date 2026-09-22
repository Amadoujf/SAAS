/**
 * Écran affiché quand l'ABONNEMENT SaaS du tenant résolu par hôte est SUSPENDU/EXPIRÉ
 * — voir docs/14-facturation-saas-abonnements.md, « politique de disponibilité du
 * site ». Distinct de `PublicSiteSuspended` (`Tenant.status === "SUSPENDED"`, une
 * décision Super Admin sur le tenant entier) : ici, aucune donnée n'est jamais
 * supprimée, le propriétaire peut toujours se connecter au dashboard et renouveler —
 * ce message le dit explicitement, contrairement à l'écran de suspension Super Admin.
 */
export function PublicSiteBillingSuspended({ tenantName }: { tenantName: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-2xl font-semibold text-gray-900">{tenantName}</h1>
      <p className="text-gray-600">
        Ce site est momentanément indisponible : l&apos;abonnement de cette entreprise à la plateforme
        est arrivé à échéance. Aucune donnée n&apos;a été supprimée — le site sera de nouveau accessible
        dès le renouvellement de l&apos;abonnement.
      </p>
    </main>
  );
}
