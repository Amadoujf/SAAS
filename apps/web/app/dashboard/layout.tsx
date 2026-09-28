import { ycFontVariables } from "@/lib/yc-fonts";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { withTenant, countOrdersByQueue, hotelOverview, restaurantOverview } from "@yamacommerce/database";
import { auth, signOut } from "@/lib/auth";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { isCatalogModuleEnabled } from "@/lib/catalog/require-catalog-module";
import { getTenantModuleKeys, isHotel, isRealEstate, isRestaurant, isSalon, isTravel } from "@/lib/modules/tenant-modules";
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
  // Entreprise de démonstration : signalée sur TOUTES les pages de son espace.
  const isDemo = membership ? (await withTenant(membership.tenantId, (tx) => tx.tenant.findUnique({ where: { id: membership.tenantId }, select: { isDemo: true } })))?.isDemo === true : false;
  const realEstate = isRealEstate(modules);
  const travel = isTravel(modules);
  const salon = isSalon(modules);
  const hotel = isHotel(modules);
  const restaurant = isRestaurant(modules);

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
  let bookingsToConfirm = 0;
  let missingDocuments = 0;
  if (membership && travel) {
    const now = new Date();
    [bookingsToConfirm, missingDocuments] = await withTenant(membership.tenantId, async (tx) => [
      await tx.reservation.count({ where: { tenantId: membership.tenantId, moduleKey: "departures", status: "requested" } }),
      await tx.travelerDocument.count({ where: { tenantId: membership.tenantId, status: { in: ["missing", "refused"] }, traveler: { reservation: { status: { in: ["requested", "confirmed"] }, startAt: { gte: now } } } } }),
    ]);
  }
  let appointmentsToConfirm = 0;
  let appointmentsToday = 0;
  if (membership && salon) {
    const now = new Date();
    // Fin de journée en UTC : exacte pour Dakar (UTC+0) ; indicatif ailleurs (badge seulement).
    const dayEnd = new Date(new Date(now.toISOString().slice(0, 10) + "T00:00:00.000Z").getTime() + 86_400_000);
    [appointmentsToConfirm, appointmentsToday] = await withTenant(membership.tenantId, async (tx) => [
      await tx.reservation.count({ where: { tenantId: membership.tenantId, moduleKey: "appointments", status: "requested", startAt: { gte: now } } }),
      await tx.reservation.count({ where: { tenantId: membership.tenantId, moduleKey: "appointments", status: { in: ["requested", "confirmed"] }, startAt: { gte: now, lt: dayEnd } } }),
    ]);
  }
  let hotelArrivals = 0;
  let hotelDirty = 0;
  let hotelPending = 0;
  if (membership && hotel) {
    const o = await withTenant(membership.tenantId, (tx) => hotelOverview(tx, membership.tenantId));
    hotelArrivals = o.arrivals;
    hotelDirty = o.dirty;
    hotelPending = o.pending;
  }
  let restoKitchen = 0;
  let restoReady = 0;
  let restoBookings = 0;
  let restoSoldOut = 0;
  if (membership && restaurant) {
    const o = await withTenant(membership.tenantId, (tx) => restaurantOverview(tx, membership.tenantId));
    restoKitchen = o.inKitchen;
    restoReady = o.ready;
    restoBookings = o.bookingsToday;
    restoSoldOut = o.soldOut;
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
  } else if (membership && travel) {
    pilot.push(
      { href: "/dashboard/reservations", label: "Réservations", icon: "ticket", badge: bookingsToConfirm || undefined, permission: "reservations.view" },
      { href: "/dashboard/departs", label: "Départs", icon: "calendar", permission: "reservations.view" },
      { href: "/dashboard/voyages", label: "Voyages", icon: "plane", permission: "listings.view" },
      { href: "/dashboard/clients", label: "Clients", icon: "customers", permission: "customers.view" },
    );
    manage.push(
      { href: "/dashboard/mon-site", label: "Mon site", icon: "site", permission: "settings.branding" },
      { href: "/dashboard/mediatheque", label: "Médiathèque", icon: "media", permission: "listings.view" },
      { href: "/dashboard/paiements", label: "Moyens de paiement", icon: "payments", permission: "payments.view" },
    );
  } else if (membership && restaurant) {
    pilot.push(
      { href: "/dashboard/cuisine", label: "Cuisine", icon: "flame", badge: restoKitchen + restoReady || undefined, permission: "orders.view" },
      { href: "/dashboard/ventes", label: "Commandes", icon: "orders", permission: "orders.view" },
      { href: "/dashboard/salle", label: "Réservations", icon: "calendar", badge: restoBookings || undefined, permission: "reservations.view" },
      { href: "/dashboard/clients", label: "Clients", icon: "customers", permission: "customers.view" },
    );
    manage.push(
      { href: "/dashboard/carte", label: "La carte", icon: "menu", badge: restoSoldOut || undefined, permission: "products.view" },
      { href: "/dashboard/tables", label: "Tables et QR codes", icon: "table", permission: "listings.view" },
      { href: "/dashboard/ouverture", label: "Horaires et règles", icon: "key", permission: "listings.manage_availability" },
      { href: "/dashboard/mon-site", label: "Mon site", icon: "site", permission: "settings.branding" },
      { href: "/dashboard/mediatheque", label: "Médiathèque", icon: "media", permission: "products.view" },
      { href: "/dashboard/paiements", label: "Moyens de paiement", icon: "payments", permission: "payments.view" },
    );
  } else if (membership && hotel) {
    pilot.push(
      { href: "/dashboard/planning", label: "Planning", icon: "calendar", permission: "reservations.view" },
      { href: "/dashboard/sejours", label: "Séjours", icon: "ticket", badge: hotelArrivals + hotelPending || undefined, permission: "reservations.view" },
      { href: "/dashboard/chambres", label: "Chambres et ménage", icon: "bed", badge: hotelDirty || undefined, permission: "listings.view" },
      { href: "/dashboard/clients", label: "Clients", icon: "customers", permission: "customers.view" },
    );
    manage.push(
      { href: "/dashboard/mon-site", label: "Mon site", icon: "site", permission: "settings.branding" },
      { href: "/dashboard/mediatheque", label: "Médiathèque", icon: "media", permission: "listings.view" },
      { href: "/dashboard/paiements", label: "Moyens de paiement", icon: "payments", permission: "payments.view" },
    );
  } else if (membership && salon) {
    pilot.push(
      { href: "/dashboard/agenda", label: "Agenda", icon: "calendar", badge: appointmentsToday || undefined, permission: "reservations.view" },
      { href: "/dashboard/rendez-vous", label: "Rendez-vous", icon: "ticket", badge: appointmentsToConfirm || undefined, permission: "reservations.view" },
      { href: "/dashboard/prestations", label: "Prestations", icon: "scissors", permission: "listings.view" },
      { href: "/dashboard/clients", label: "Clients", icon: "customers", permission: "customers.view" },
    );
    manage.push(
      { href: "/dashboard/horaires", label: "Équipe et horaires", icon: "key", permission: "listings.manage_availability" },
      { href: "/dashboard/mon-site", label: "Mon site", icon: "site", permission: "settings.branding" },
      { href: "/dashboard/mediatheque", label: "Médiathèque", icon: "media", permission: "listings.view" },
      { href: "/dashboard/paiements", label: "Moyens de paiement", icon: "payments", permission: "payments.view" },
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
    : travel
    ? [
        { href: "/dashboard/reservations?file=a-confirmer", label: "Réservations à confirmer", count: bookingsToConfirm },
        { href: "/dashboard/reservations?file=pieces", label: "Pièces de voyageurs à obtenir", count: missingDocuments },
      ]
    : restaurant
    ? [
        { href: "/dashboard/cuisine", label: "Commandes en cuisine", count: restoKitchen },
        { href: "/dashboard/ventes?file=en-cours", label: "Commandes prêtes à remettre", count: restoReady },
        { href: "/dashboard/carte", label: "Plats épuisés", count: restoSoldOut },
      ]
    : hotel
    ? [
        { href: "/dashboard/sejours?file=arrivees", label: "Arrivées du jour", count: hotelArrivals },
        { href: "/dashboard/sejours?file=a-confirmer", label: "Séjours à confirmer", count: hotelPending },
        { href: "/dashboard/chambres", label: "Chambres à nettoyer", count: hotelDirty },
      ]
    : salon
    ? [
        { href: "/dashboard/rendez-vous?file=a-confirmer", label: "Rendez-vous à confirmer", count: appointmentsToConfirm },
        { href: "/dashboard/agenda", label: "Rendez-vous restants aujourd'hui", count: appointmentsToday },
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
        {isDemo && (
          <p className="border-b border-yc-electric/15 bg-[#E8EFFF] px-4 py-2 text-center text-[12px] font-medium text-yc-ink sm:px-6">
            <span className="mr-1.5 font-bold uppercase tracking-[0.12em] text-yc-electric">Démonstration</span>
            Entreprise fictive : {restaurant ? "carte, commandes et réservations" : travel ? "voyages, voyageurs et réservations" : salon ? "prestations, clients et rendez-vous" : hotel ? "chambres, clients et séjours" : realEstate ? "biens, clients et visites" : "produits, clients et commandes"} servent à découvrir Y-COM, aucune donnée n&apos;est réelle.
          </p>
        )}
        <main id="contenu" className="px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-7">
          <div className="mx-auto w-full max-w-[1240px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
