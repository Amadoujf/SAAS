import { ycFontVariables } from "@/lib/yc-fonts";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { withTenant, autoOverview, countOrdersByQueue, courierOverview, educationOverview, hotelOverview, restaurantOverview } from "@yamacommerce/database";
import { auth, signOut } from "@/lib/auth";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { isCatalogModuleEnabled } from "@/lib/catalog/require-catalog-module";
import { getTenantModuleKeys, isAutomobile, isCourier, isEducation, isHotel, isRealEstate, isRestaurant, isSalon, isTravel } from "@/lib/modules/tenant-modules";
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
  const automobile = isAutomobile(modules);
  const education = isEducation(modules);
  const courier = isCourier(modules);

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
  let autoDrives = 0;
  let autoNewLeads = 0;
  let autoSales = 0;
  let autoImports = 0;
  if (membership && automobile) {
    const o = await withTenant(membership.tenantId, (tx) => autoOverview(tx, membership.tenantId));
    autoDrives = o.drivesToday;
    autoNewLeads = o.newLeads;
    autoSales = o.salesOpen;
    autoImports = o.importsInProgress;
  }
  let courierPending = 0;
  let courierFailed = 0;
  let courierCash = 0;
  if (membership && courier) {
    const o = await withTenant(membership.tenantId, (tx) => courierOverview(tx, membership.tenantId));
    courierPending = o.pending;
    courierFailed = o.failed;
    courierCash = o.cashInHands;
  }
  let eduRequests = 0;
  let eduLate = 0;
  if (membership && education && (session.user.isSuperAdmin || membership.permissions.includes("reservations.view"))) {
    const o = await withTenant(membership.tenantId, (tx) => educationOverview(tx, membership.tenantId));
    eduRequests = o.pendingRequests;
    eduLate = o.overdueCount;
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
    // Mode et vêtements (module « Variantes avancées ») : tableaux de tailles par catégorie.
    if (modules.has("variants_advanced")) manage.push({ href: "/dashboard/guides-tailles", label: "Guides des tailles", icon: "categories", permission: "products.view" });
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
  } else if (membership && courier) {
    pilot.push(
      { href: "/dashboard/courses", label: "Courses", icon: "delivery", badge: courierPending + courierFailed || undefined, permission: "delivery.view" },
      { href: "/dashboard/livreurs", label: "Livreurs", icon: "customers", permission: "delivery.view" },
      { href: "/dashboard/caisse", label: "Caisse et reversements", icon: "payments", permission: "payments.view" },
      { href: "/dashboard/clients", label: "Expéditeurs", icon: "customers", permission: "customers.view" },
    );
    manage.push(
      { href: "/dashboard/tarifs", label: "Zones et règles", icon: "key", permission: "delivery.manage_zones" },
      { href: "/dashboard/mon-site", label: "Mon site", icon: "site", permission: "settings.branding" },
      { href: "/dashboard/mediatheque", label: "Médiathèque", icon: "media", permission: "settings.branding" },
    );
  } else if (membership && education) {
    pilot.push(
      { href: "/dashboard/inscriptions", label: "Inscriptions", icon: "folder", badge: eduRequests || undefined, permission: "reservations.view" },
      { href: "/dashboard/classes", label: "Classes", icon: "school", permission: "academics.view" },
      { href: "/dashboard/eleves", label: "Élèves", icon: "customers", permission: "customers.view" },
      { href: "/dashboard/formations", label: "Formations", icon: "book", permission: "listings.view" },
    );
    manage.push(
      { href: "/dashboard/ecole", label: "Année et règles", icon: "key", permission: "academics.manage" },
      { href: "/dashboard/clients", label: "Responsables", icon: "customers", permission: "customers.view" },
      { href: "/dashboard/mon-site", label: "Mon site", icon: "site", permission: "settings.branding" },
      { href: "/dashboard/mediatheque", label: "Médiathèque", icon: "media", permission: "listings.view" },
      { href: "/dashboard/paiements", label: "Moyens de paiement", icon: "payments", permission: "payments.view" },
    );
  } else if (membership && automobile) {
    pilot.push(
      { href: "/dashboard/vehicules", label: "Stock", icon: "car", permission: "listings.view" },
      { href: "/dashboard/essais", label: "Essais", icon: "calendar", badge: autoDrives || undefined, permission: "reservations.view" },
      { href: "/dashboard/prospects", label: "Prospects", icon: "customers", badge: autoNewLeads || undefined, permission: "customers.view" },
      { href: "/dashboard/dossiers", label: "Dossiers de vente", icon: "folder", badge: autoSales || undefined, permission: "reservations.view" },
    );
    manage.push(
      { href: "/dashboard/arrivages", label: "Arrivages", icon: "ship", badge: autoImports || undefined, permission: "listings.view" },
      { href: "/dashboard/showroom", label: "Horaires et règles", icon: "key", permission: "listings.manage_availability" },
      { href: "/dashboard/clients", label: "Clients", icon: "customers", permission: "customers.view" },
      { href: "/dashboard/mon-site", label: "Mon site", icon: "site", permission: "settings.branding" },
      { href: "/dashboard/mediatheque", label: "Médiathèque", icon: "media", permission: "listings.view" },
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
      { href: "/dashboard/services", label: "État des services", icon: "settings", permission: "payments.view" },
      { href: "/dashboard/equipe", label: "Équipe", icon: "customers", permission: "employees.view" },
      { href: "/dashboard/informations-legales", label: "Informations légales", icon: "folder", permission: "settings.branding" },
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
    : courier
    ? [
        { href: "/dashboard/courses?file=a-affecter", label: "Courses à affecter", count: courierPending },
        { href: "/dashboard/courses?file=echecs", label: "Courses en échec", count: courierFailed },
        { href: "/dashboard/caisse", label: "Livreurs avec espèces à verser", count: courierCash > 0 ? 1 : 0 },
      ]
    : education
    ? [
        { href: "/dashboard/inscriptions?file=a-confirmer", label: "Demandes d'inscription à confirmer", count: eduRequests },
        { href: "/dashboard/inscriptions?file=retards", label: "Dossiers avec échéance en retard", count: eduLate },
      ]
    : automobile
    ? [
        { href: "/dashboard/prospects", label: "Nouvelles demandes", count: autoNewLeads },
        { href: "/dashboard/essais", label: "Essais aujourd'hui", count: autoDrives },
        { href: "/dashboard/arrivages", label: "Importations en cours", count: autoImports },
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
    <div className={`${ycFontVariables} min-h-screen bg-[#F7F7F5] font-ui text-yc-ink lg:flex`}>
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
            Entreprise fictive : {automobile ? "véhicules, prospects, essais et ventes" : restaurant ? "carte, commandes et réservations" : travel ? "voyages, voyageurs et réservations" : salon ? "prestations, clients et rendez-vous" : hotel ? "chambres, clients et séjours" : realEstate ? "biens, clients et visites" : "produits, clients et commandes"} servent à découvrir Y-COM, aucune donnée n&apos;est réelle.
          </p>
        )}
        <main id="contenu" className="px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-7">
          <div className="mx-auto w-full max-w-[1240px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
