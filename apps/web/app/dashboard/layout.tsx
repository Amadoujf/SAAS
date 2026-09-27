import { ycFontVariables } from "@/lib/yc-fonts";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { withTenant, countOrdersByQueue } from "@yamacommerce/database";
import { auth, signOut } from "@/lib/auth";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { isCatalogModuleEnabled } from "@/lib/catalog/require-catalog-module";
import { getTenantModuleKeys, isRealEstate } from "@/lib/modules/tenant-modules";
import { DashboardSidebar, type NavGroup } from "@/components/dashboard-shell/nav";
import { DashboardTopbar } from "@/components/dashboard-shell/topbar";

/**
 * Habillage du dashboard commerçant — univers « précis, rapide, dense mais lisible » :
 * navigation bleu marine à gauche (bureau), barre supérieure (fil d'Ariane, recherche
 * de commandes, notifications réelles, compte) et barre d'onglets au pouce avec
 * tiroir « Plus » (mobile). Le contenu vit sur un fond clair neutre. Aucune
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
  const modules = membership ? await getTenantModuleKeys(membership.tenantId) : new Set<string>();
  const realEstate = isRealEstate(modules);

  let queues: Awaited<ReturnType<typeof countOrdersByQueue>> | null = null;
  let lowStock = 0;
  let storeUrl: string | null = null;
  let visitsToConfirm = 0;
  let lateRents = 0;
  if (membership && realEstate) {
    const startOfToday = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
    [visitsToConfirm, lateRents] = await withTenant(membership.tenantId, async (tx) => [
      await tx.reservation.count({ where: { tenantId: membership.tenantId, moduleKey: "visit_requests", status: "requested" } }),
      await tx.rentPayment.count({ where: { tenantId: membership.tenantId, status: "pending", dueDate: { lt: startOfToday } } }),
    ]);
  }
  if (membership) {
    const data = await withTenant(membership.tenantId, async (tx) => ({
      queues: catalogEnabled ? await countOrdersByQueue(tx, membership.tenantId) : null,
      lowStock: catalogEnabled
        ? await tx.inventoryItem.count({ where: { tenantId: membership.tenantId, availableQuantity: { lte: tx.inventoryItem.fields.lowStockThreshold } } })
        : 0,
      domain: await tx.domain.findFirst({
        where: { tenantId: membership.tenantId, lifecycleStatus: "ACTIVE" },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      }),
    }));
    queues = data.queues;
    lowStock = data.lowStock;
    storeUrl = data.domain ? `https://${data.domain.domain}` : null;
  }
  const toProcess = queues ? queues.toProcess + queues.awaitingProof : 0;

  // Chaque entrée n'apparaît que si le membre a la permission correspondante (le
  // serveur la revérifie de toute façon sur chaque page et chaque action).
  const perms = new Set(membership?.permissions ?? []);
  const allowed = (permission?: string) => !permission || session.user.isSuperAdmin || perms.has(permission);
  type Entry = NavGroup["items"][number] & { permission?: string };
  const pilot: Entry[] = [{ href: "/dashboard", label: "Vue d'ensemble", icon: "home" }];
  const manage: Entry[] = [];
  if (membership && catalogEnabled) {
    pilot.push(
      { href: "/dashboard/commandes", label: "Commandes", icon: "orders", badge: toProcess || undefined, permission: "orders.view" },
      { href: "/dashboard/produits", label: "Produits", icon: "products", permission: "products.view" },
      { href: "/dashboard/clients", label: "Clients", icon: "customers", permission: "customers.view" },
      { href: "/dashboard/livraison", label: "Livraisons", icon: "delivery", permission: "delivery.view" },
    );
    manage.push(
      // Une seule entrée pour le site public : « Mon site » mène à l'éditeur visuel.
      { href: "/dashboard/mon-site", label: "Mon site", icon: "site", permission: "settings.branding" },
      { href: "/dashboard/mediatheque", label: "Médiathèque", icon: "media", permission: "products.view" },
      { href: "/dashboard/paiements", label: "Paiements", icon: "payments", permission: "payments.view" },
      { href: "/dashboard/stocks", label: "Stocks", icon: "stock", permission: "products.view" },
      { href: "/dashboard/categories", label: "Catégories", icon: "categories", permission: "products.view" },
    );
  } else if (membership && realEstate) {
    pilot.push(
      { href: "/dashboard/biens", label: "Biens", icon: "property", permission: "listings.view" },
      { href: "/dashboard/visites", label: "Visites", icon: "calendar", badge: visitsToConfirm || undefined, permission: "reservations.view" },
      { href: "/dashboard/baux", label: "Baux et loyers", icon: "key", badge: lateRents || undefined, permission: "leases.view" },
      { href: "/dashboard/clients", label: "Clients", icon: "customers", permission: "customers.view" },
    );
    manage.push(
      { href: "/dashboard/mon-site", label: "Mon site", icon: "site", permission: "settings.branding" },
      { href: "/dashboard/mediatheque", label: "Médiathèque", icon: "media", permission: "listings.view" },
    );
  } else if (membership) {
    pilot.push({ href: "/dashboard/clients", label: "Clients", icon: "customers", permission: "customers.view" });
  }
  if (membership) {
    manage.push(
      { href: "/dashboard/equipe", label: "Équipe", icon: "customers", permission: "employees.view" },
      { href: "/dashboard/facturation", label: "Facturation", icon: "billing", permission: "settings.subscription" },
    );
  }
  const groups: NavGroup[] = [
    { label: "Pilotage", items: pilot.filter((i) => allowed(i.permission)) },
    { label: "Gestion", items: manage.filter((i) => allowed(i.permission)) },
  ].filter((g) => g.items.length > 0);

  const alerts = realEstate
    ? [
        { href: "/dashboard/visites", label: "Visites à confirmer", count: visitsToConfirm },
        { href: "/dashboard/baux?filtre=retard", label: "Loyers en retard", count: lateRents },
      ]
    : queues
    ? [
        { href: "/dashboard/commandes?file=preuves", label: "Preuves de paiement à vérifier", count: queues.awaitingProof },
        { href: "/dashboard/commandes?file=a-traiter", label: "Commandes à préparer", count: queues.toProcess },
        { href: "/dashboard/stocks", label: "Articles en stock faible", count: lowStock },
      ]
    : [];

  async function doSignOut() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <div className={`${ycFontVariables} min-h-screen bg-[#F6F7FB] font-ui text-yc-ink lg:flex`}>
      <DashboardSidebar
        groups={groups}
        tenantName={membership?.tenantName ?? "Y-COM"}
        roleName={membership?.roleName ?? null}
        storeUrl={storeUrl}
        supportUrl={process.env.SUPPORT_URL?.startsWith("https://") ? process.env.SUPPORT_URL : null}
        signOut={doSignOut}
      />
      <div className="min-w-0 flex-1">
        <DashboardTopbar
          alerts={alerts}
          userName={session.user.name ?? session.user.email ?? "Mon compte"}
          userEmail={session.user.email ?? null}
          signOut={doSignOut}
          searchEnabled={!!membership && catalogEnabled}
        />
        <main id="contenu" className="px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-7">
          <div className="mx-auto w-full max-w-[1240px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
