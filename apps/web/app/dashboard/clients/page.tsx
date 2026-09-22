import { redirect } from "next/navigation";
import type { Metadata } from "next";
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
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white p-4">
        <h1 className="text-lg font-semibold text-gray-900">Clients</h1>
      </header>
      <CustomersPanel />
    </div>
  );
}
