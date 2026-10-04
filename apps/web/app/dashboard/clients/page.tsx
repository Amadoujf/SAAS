import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { PageHeader } from "@/components/yc/panel";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { CustomersPanel } from "@/components/dashboard/customers-panel";

export const metadata: Metadata = { title: "Clients — Dashboard", robots: { index: false, follow: false } };

/**
 * Liste des clients — voir docs/08, étape 2 (clients/panier/commandes/livraison).
 * `customers` est un module CORE (voir `seed.ts`, `MODULES`) : aucun gate de module
 * ici, contrairement à `/dashboard/produits` — seule l'adhésion tenant compte, la
 * permission `customers.view` est vérifiée plus bas par `customer-pipeline.ts`.
 */
export default async function ClientsPage() {
  const membership = await getCurrentTenantMembership();
  if (!membership) redirect("/dashboard");

  return (
    <div>
      <PageHeader eyebrow="Ventes" title="Clients" description="Vos clients, leurs commandes et leur historique d'achat." />
      <CustomersPanel />
    </div>
  );
}
