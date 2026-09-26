import { ycFontVariables } from "@/lib/yc-fonts";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { withTenant, countOrdersByQueue } from "@yamacommerce/database";
import { auth, signOut } from "@/lib/auth";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { isCatalogModuleEnabled } from "@/lib/catalog/require-catalog-module";
import { DashboardSidebar, type NavGroup } from "@/components/dashboard-shell/nav";

/**
 * Habillage du dashboard commerçant — univers « précis, rapide, dense mais lisible » :
 * navigation nuit profonde à gauche (bureau), barre supérieure + tiroir animé + barre
 * d'onglets au pouce (mobile). Le contenu vit sur un fond ivoire chaud. Aucune
 * personnalisation de la boutique (design tokens) ne s'applique ici.
 *
 * Les entrées Produits/Catégories/Stocks/Commandes/Livraison n'apparaissent QUE si
 * le module "catalog" est activé pour ce tenant (immobilier/voyage ont leurs propres
 * modules, jamais forcés vers ce menu).
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/connexion");

  const membership = await getCurrentTenantMembership();
  const catalogEnabled = membership ? await isCatalogModuleEnabled(membership.tenantId) : false;

  let toProcess = 0;
  let storeUrl: string | null = null;
  if (membership) {
    const data = await withTenant(membership.tenantId, async (tx) => {
      const queues = catalogEnabled ? await countOrdersByQueue(tx, membership.tenantId) : null;
      const domain = await tx.domain.findFirst({
        where: { tenantId: membership.tenantId, lifecycleStatus: "ACTIVE" },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      });
      return { queues, domain };
    });
    toProcess = data.queues ? data.queues.toProcess + data.queues.awaitingProof : 0;
    storeUrl = data.domain ? `https://${data.domain.domain}` : null;
  }

  const groups: NavGroup[] = [{ label: "Pilotage", items: [{ href: "/dashboard", label: "Accueil", icon: "home" }] }];
  if (membership && catalogEnabled) {
    groups.push({
      label: "Ventes",
      items: [
        { href: "/dashboard/commandes", label: "Commandes", icon: "orders", badge: toProcess || undefined },
        { href: "/dashboard/clients", label: "Clients", icon: "customers" },
        { href: "/dashboard/livraison", label: "Livraison", icon: "delivery" },
        { href: "/dashboard/paiements", label: "Paiements", icon: "payments" },
      ],
    });
    groups.push({
      label: "Catalogue",
      items: [
        { href: "/dashboard/produits", label: "Produits", icon: "products" },
        { href: "/dashboard/categories", label: "Catégories", icon: "categories" },
        { href: "/dashboard/stocks", label: "Stocks", icon: "stock" },
      ],
    });
  } else if (membership) {
    groups[0]!.items.push({ href: "/dashboard/clients", label: "Clients", icon: "customers" });
  }
  if (membership) {
    groups.push({ label: "Compte", items: [{ href: "/dashboard/facturation", label: "Abonnement", icon: "billing" }] });
  }

  async function doSignOut() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <div className={`${ycFontVariables} min-h-screen bg-yc-ivory-50 font-ui text-yc-ink lg:flex`}>
      <DashboardSidebar
        groups={groups}
        tenantName={membership?.tenantName ?? "YamaCommerce"}
        roleName={membership?.roleName ?? null}
        storeUrl={storeUrl}
        signOut={doSignOut}
      />
      <main id="contenu" className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
        <div className="mx-auto w-full max-w-[1240px]">{children}</div>
      </main>
    </div>
  );
}
