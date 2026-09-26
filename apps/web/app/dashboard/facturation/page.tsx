import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { PageHeader } from "@/components/yc/panel";
import { BillingPanel } from "@/components/dashboard/billing-panel";
import { getCurrentTenantMembership } from "@/lib/current-tenant";

export const metadata: Metadata = { title: "Abonnement et facturation — Dashboard", robots: { index: false, follow: false } };

/**
 * Page « Abonnement et facturation » — voir docs/14-facturation-saas-abonnements.md.
 * `"subscriptions"` est un module CORE (jamais de ligne `TenantModule`, jamais de
 * gate de module — même convention que `/dashboard/clients`) : seule la permission
 * `settings.subscription` compte, vérifiée par `/api/billing/summary` et
 * `/api/billing/checkout`, jamais ici (cette page ne fait que rendre le composant
 * client, qui affichera lui-même l'erreur d'autorisation si l'appel API la renvoie).
 */
export default async function FacturationPage() {
  const membership = await getCurrentTenantMembership();
  if (!membership) redirect("/dashboard");

  return (
    <div>
      <PageHeader title="Abonnement et facturation" description="Votre formule YamaCommerce, son échéance et son renouvellement." />
      <BillingPanel />
    </div>
  );
}
