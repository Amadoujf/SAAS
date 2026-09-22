import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { withTenant } from "@yamacommerce/database";
import { getCurrentTenantMembership } from "@/lib/current-tenant";

export const metadata: Metadata = { title: "Retour de paiement — Facturation", robots: { index: false, follow: false } };

/**
 * Page de retour Chariow — voir docs/14-facturation-saas-abonnements.md, « jamais
 * d'accès accordé depuis la redirection navigateur ». Affiche UNIQUEMENT l'état de
 * `BillingCheckoutSession`, tel qu'écrit par le webhook Pulse traité côté serveur
 * (`processSaasBillingWebhook`) — le simple fait que le navigateur soit revenu ici
 * n'active JAMAIS rien. Deux courses gérées explicitement par la lecture directe de
 * l'état réel : le webhook peut être arrivé AVANT (affiche "confirmé" directement) ou
 * ne jamais arriver (reste "en attente", jamais un octroi par défaut).
 */
export default async function BillingReturnPage({
  searchParams,
}: {
  searchParams: { ref?: string };
}) {
  const membership = await getCurrentTenantMembership();
  if (!membership) redirect("/dashboard");

  const internalReference = searchParams.ref;
  if (!internalReference) {
    return <StatusPanel title="Référence manquante" message="Aucune session de paiement n'a été fournie." tone="error" />;
  }

  // Scoping RLS explicite au tenant COURANT — défense en profondeur même si
  // `internalReference` est déjà un jeton aléatoire non devinable (voir docs/14) :
  // un utilisateur d'un autre tenant ne doit jamais pouvoir consulter cette page pour
  // une session qui n'est pas la sienne, même par coïncidence d'URL partagée.
  const session = await withTenant(membership.tenantId, (tx) =>
    tx.billingCheckoutSession.findFirst({ where: { internalReference, tenantId: membership.tenantId } }),
  );

  if (!session) {
    return <StatusPanel title="Session introuvable" message="Cette session de paiement n'existe pas ou n'appartient pas à votre entreprise." tone="error" />;
  }

  if (session.status === "CONFIRMED") {
    return (
      <StatusPanel
        title="Paiement confirmé"
        message="Votre abonnement a été activé avec succès."
        tone="success"
        ctaHref="/dashboard/facturation"
        ctaLabel="Voir mon abonnement"
      />
    );
  }

  if (session.status === "EXPIRED" || session.status === "CANCELED") {
    return (
      <StatusPanel
        title="Session expirée"
        message="Cette session de paiement n'est plus valide. Vous pouvez relancer le paiement depuis la page Facturation."
        tone="warning"
        ctaHref="/dashboard/facturation"
        ctaLabel="Retourner à la facturation"
      />
    );
  }

  // PENDING : le webhook n'est pas encore arrivé (ou pas encore traité) — jamais un
  // octroi par défaut, jamais une erreur non plus (cas normal juste après le retour).
  return (
    <StatusPanel
      title="Paiement en cours de vérification"
      message="Nous confirmons votre paiement auprès de notre prestataire. Cette page se mettra à jour automatiquement — vous pouvez aussi revenir sur la page Facturation dans quelques instants."
      tone="pending"
      ctaHref="/dashboard/facturation"
      ctaLabel="Retourner à la facturation"
    />
  );
}

function StatusPanel({
  title,
  message,
  tone,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  message: string;
  tone: "success" | "pending" | "warning" | "error";
  ctaHref?: string;
  ctaLabel?: string;
}) {
  const toneClasses: Record<typeof tone, string> = {
    success: "border-green-200 bg-green-50 text-green-900",
    pending: "border-blue-200 bg-blue-50 text-blue-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    error: "border-red-200 bg-red-50 text-red-900",
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className={`w-full max-w-md rounded-lg border p-6 text-center ${toneClasses[tone]}`}>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="mt-2 text-sm">{message}</p>
        {ctaHref && ctaLabel && (
          <a href={ctaHref} className="mt-4 inline-block rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
            {ctaLabel}
          </a>
        )}
      </div>
    </div>
  );
}
