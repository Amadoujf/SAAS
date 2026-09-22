import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { isCatalogModuleEnabled } from "@/lib/catalog/require-catalog-module";

/**
 * Habillage commun du dashboard commerçant — voir docs/08 §8.2. Premier layout réel
 * pour `/dashboard/**` (jusqu'ici seule `app/dashboard/page.tsx` existait, sans
 * navigation). La navigation Produits/Catégories/Stocks n'apparaît QUE si le module
 * "catalog" est activé pour ce tenant (voir la revue du 18 septembre 2026, « le
 * catalogue est un module métier activable, pas une obligation pour tous les
 * secteurs ») — l'immobilier/le voyage gardent leurs propres modèles "listings",
 * jamais forcés vers ce menu.
 *
 * Un utilisateur sans adhésion ACTIVE (pas encore rattaché à une entreprise) voit
 * quand même ses pages (`/dashboard` affiche déjà ce cas), juste sans navigation
 * métier — jamais une redirection en boucle vers `/dashboard` lui-même.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/connexion");

  const membership = await getCurrentTenantMembership();
  const catalogEnabled = membership ? await isCatalogModuleEnabled(membership.tenantId) : false;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex min-h-screen">
        <aside className="w-56 shrink-0 border-r border-gray-200 bg-white px-4 py-6">
          <p className="mb-6 truncate text-sm font-semibold text-gray-900">
            {membership?.tenantName ?? "YamaCommerce AI"}
          </p>
          <nav className="flex flex-col gap-1 text-sm">
            <Link href="/dashboard" className="rounded px-3 py-2 text-gray-700 hover:bg-gray-100">
              Accueil
            </Link>
            {membership && (
              <Link href="/dashboard/clients" className="rounded px-3 py-2 text-gray-700 hover:bg-gray-100">
                Clients
              </Link>
            )}
            {membership && (
              <Link href="/dashboard/facturation" className="rounded px-3 py-2 text-gray-700 hover:bg-gray-100">
                Facturation
              </Link>
            )}
            {catalogEnabled && (
              <>
                <Link href="/dashboard/produits" className="rounded px-3 py-2 text-gray-700 hover:bg-gray-100">
                  Produits
                </Link>
                <Link href="/dashboard/categories" className="rounded px-3 py-2 text-gray-700 hover:bg-gray-100">
                  Catégories
                </Link>
                <Link href="/dashboard/stocks" className="rounded px-3 py-2 text-gray-700 hover:bg-gray-100">
                  Stocks
                </Link>
              </>
            )}
          </nav>
        </aside>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
