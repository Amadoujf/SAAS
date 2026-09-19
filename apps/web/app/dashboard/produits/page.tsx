import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { isCatalogModuleEnabled } from "@/lib/catalog/require-catalog-module";
import { ProductsPanel } from "@/components/dashboard/products-panel";

export const metadata: Metadata = { title: "Produits — Dashboard", robots: { index: false, follow: false } };

/**
 * Liste des produits — voir docs/08 §8.2, `/dashboard/produits`. Le module
 * "catalog" doit être activé pour ce tenant (voir require-catalog-module.ts) ;
 * sinon, cette page n'a pas de sens pour ce secteur (immobilier/voyage utilisent
 * "listings", pas ce module) — redirection propre plutôt qu'une page vide.
 */
export default async function ProductsPage() {
  const membership = await getCurrentTenantMembership();
  if (!membership) redirect("/dashboard");
  const catalogEnabled = await isCatalogModuleEnabled(membership.tenantId);
  if (!catalogEnabled) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white p-4">
        <h1 className="text-lg font-semibold text-gray-900">Produits</h1>
      </header>
      <ProductsPanel />
    </div>
  );
}
