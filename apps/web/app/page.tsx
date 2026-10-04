import { ycFontVariables } from "@/lib/yc-fonts";
import Link from "next/link";
import { headers } from "next/headers";
import { permanentRedirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/tenant";
import { withSuperAdminAccess } from "@yamacommerce/database";
import { Landing } from "@/components/platform/landing";
import { StoreHome } from "@/components/store/store-home";
import { resolveStore } from "@/lib/storefront/store-context";
import { isCatalogModuleEnabled } from "@/lib/catalog/require-catalog-module";
import { isEstateTenant, resolveEstate } from "@/lib/real-estate/estate-context";
import { EstateHome } from "@/components/estate/estate-home";
import { isTravelTenant, resolveTravel } from "@/lib/travel/travel-context";
import { TravelHome } from "@/components/travel/travel-home";
import { isSalonTenant, resolveSalon } from "@/lib/salon/salon-context";
import { SalonHome } from "@/components/salon/salon-home";
import { isHotelTenant, resolveHotel } from "@/lib/hotel/hotel-context";
import { HotelHome } from "@/components/hotel/hotel-home";
import { isRestaurantTenant, resolveRestaurant } from "@/lib/restaurant/restaurant-context";
import { RestaurantHome } from "@/components/restaurant/restaurant-home";
import { isAutoTenant, resolveAuto } from "@/lib/auto/auto-context";
import { AutoHome } from "@/components/auto/auto-home";
import { isEducationTenant, resolveEducation } from "@/lib/education/education-context";
import { EducationHome } from "@/components/education/education-home";
import { isCourierTenant, resolveCourier } from "@/lib/courier/courier-context";
import { CourierHome } from "@/components/courier/courier-home";
import { PublishedSectorHome } from "@/components/published-sector-home";
import { resolvePublicSite } from "@/lib/rendering/resolve-public-site";
import { PublicSitePage } from "@/components/public-site-page";
import { PublicSiteSuspended } from "@/components/public-site-suspended";
import { PublicSiteBillingSuspended } from "@/components/public-site-billing-suspended";

/**
 * Page d'accueil publique — voir docs/12 §12.3, « RENDU PUBLIC ». Si le Host résout à
 * un tenant ACTIF avec une version PUBLIÉE, rend sa page d'accueil réelle (jamais un
 * brouillon, voir `resolvePublicSite`/`resolveTenantSiteForRendering`). Un tenant
 * suspendu reçoit un écran dédié ; un tenant sans site publié (ou inconnu) reçoit la
 * vitrine plateforme Y-COM — un visiteur qui atterrit ici avant que
 * l'entreprise ait publié quoi que ce soit ne doit jamais voir une erreur.
 */
export default async function HomePage() {
  const tenant = await getCurrentTenant();
  if (tenant) {
    const headerList = await headers();
    const host = headerList.get("host") ?? "";
    const resolution = await resolvePublicSite(host);
    if (resolution.status === "suspended") {
      return <PublicSiteSuspended tenantName={resolution.tenantName} />;
    }
    if (resolution.status === "billing_suspended") {
      return <PublicSiteBillingSuspended tenantName={resolution.tenantName} />;
    }
    if (resolution.status === "redirect") {
      // Redirection PERMANENTE uniquement après validation complète — voir docs/13,
      // « DOMAINES PRINCIPAUX ET REDIRECTIONS » : ce domaine est déjà ACTIVE, la
      // redirection est donc définitive, jamais un sondage temporaire.
      permanentRedirect(`https://${resolution.targetDomain}/`);
    }
    if (resolution.status === "ok") {
      // Site publié depuis l'éditeur : son contenu, dans l'habillage de son secteur.
      // Le restaurant passe AVANT le catalogue (sa carte n'est pas une boutique).
      if (await isRestaurantTenant(tenant.id)) {
        const restaurant = await resolveRestaurant("/");
        if (restaurant.status === "ok") return <PublishedSectorHome site={resolution.site} restaurant={restaurant.restaurant} />;
      } else if (await isAutoTenant(tenant.id)) {
        const auto = await resolveAuto("/");
        if (auto.status === "ok") return <PublishedSectorHome site={resolution.site} auto={auto.auto} />;
      } else if (await isEducationTenant(tenant.id)) {
        const school = await resolveEducation("/");
        if (school.status === "ok") return <PublishedSectorHome site={resolution.site} school={school.school} />;
      } else if (await isCourierTenant(tenant.id)) {
        const courier = await resolveCourier("/");
        if (courier.status === "ok") return <PublishedSectorHome site={resolution.site} courier={courier.company} />;
      } else if (await isCatalogModuleEnabled(tenant.id)) {
        const store = await resolveStore("/");
        if (store.status === "ok") return <PublishedSectorHome site={resolution.site} store={store.store} />;
      } else if (await isEstateTenant(tenant.id)) {
        const estate = await resolveEstate("/");
        if (estate.status === "ok") return <PublishedSectorHome site={resolution.site} estate={estate.estate} />;
      } else if (await isTravelTenant(tenant.id)) {
        const travel = await resolveTravel("/");
        if (travel.status === "ok") return <PublishedSectorHome site={resolution.site} travel={travel.travel} />;
      } else if (await isSalonTenant(tenant.id)) {
        const salon = await resolveSalon("/");
        if (salon.status === "ok") return <PublishedSectorHome site={resolution.site} salon={salon.salon} />;
      } else if (await isHotelTenant(tenant.id)) {
        const hotel = await resolveHotel("/");
        if (hotel.status === "ok") return <PublishedSectorHome site={resolution.site} hotel={hotel.hotel} />;
      }
      return <PublicSitePage tenantName={resolution.tenantName} site={resolution.site} />;
    }
    // Restaurant : accueil de son template (« Braise » par défaut), avant le catalogue.
    if (await isRestaurantTenant(tenant.id)) {
      const restaurant = await resolveRestaurant("/");
      if (restaurant.status === "ok") return <RestaurantHome restaurant={restaurant.restaurant} />;
    }
    // Concession automobile : accueil de son template (« Piste » par défaut), avant le catalogue.
    if (await isAutoTenant(tenant.id)) {
      const auto = await resolveAuto("/");
      if (auto.status === "ok") return <AutoHome auto={auto.auto} />;
    }
    // Établissement d'enseignement : accueil de son template (« Préau » par défaut).
    if (await isEducationTenant(tenant.id)) {
      const school = await resolveEducation("/");
      if (school.status === "ok") return <EducationHome school={school.school} />;
    }
    // Société de livraison : accueil de son template (« Trajet » par défaut).
    if (await isCourierTenant(tenant.id)) {
      const courier = await resolveCourier("/");
      if (courier.status === "ok") return <CourierHome company={courier.company} />;
    }
    // "not_published" : aucun site publié depuis l'éditeur. Une boutique (module
    // catalogue actif) affiche l'accueil de SON template avec ses contenus mis en
    // avant ; sinon, une page d'attente soignée — jamais une erreur.
    if (await isCatalogModuleEnabled(tenant.id)) {
      const store = await resolveStore("/");
      if (store.status === "ok") return <StoreHome store={store.store} />;
    }
    // Agence immobilière : accueil de son template (« Résidences » par défaut).
    if (await isEstateTenant(tenant.id)) {
      const estate = await resolveEstate("/");
      if (estate.status === "ok") return <EstateHome estate={estate.estate} />;
    }
    // Agence de voyage : accueil de son template (« Horizons » par défaut).
    if (await isTravelTenant(tenant.id)) {
      const travel = await resolveTravel("/");
      if (travel.status === "ok") return <TravelHome travel={travel.travel} />;
    }
    // Salon : accueil de son template (« Écrin » par défaut).
    if (await isSalonTenant(tenant.id)) {
      const salon = await resolveSalon("/");
      if (salon.status === "ok") return <SalonHome salon={salon.salon} />;
    }
    // Hôtel : accueil de son template (« Palmeraie » par défaut).
    if (await isHotelTenant(tenant.id)) {
      const hotel = await resolveHotel("/");
      if (hotel.status === "ok") return <HotelHome hotel={hotel.hotel} />;
    }
    return <TenantComingSoon tenantName={tenant.name} />;
  }

  const { plans, sectors } = await withSuperAdminAccess(async (tx) => ({
    plans: await tx.subscriptionPlan.findMany({ where: { status: "PUBLISHED" }, orderBy: [{ isQuoteOnly: "asc" }, { priceMonthly: "asc" }] }),
    sectors: await tx.sector.findMany({ where: { isSystem: true, isActive: true }, orderBy: { name: "asc" } }),
  }));
  return (
    <Landing
      plans={plans.map((p) => ({
        name: p.name,
        priceMonthly: p.priceMonthly,
        priceYearly: p.priceYearly,
        trialDays: p.trialDays,
        maxProducts: p.maxProducts,
        maxEmployees: p.maxEmployees,
        maxCustomDomains: p.maxCustomDomains,
        maxAIGenerationsPerMonth: p.maxAIGenerationsPerMonth,
        isQuoteOnly: p.isQuoteOnly,
      }))}
      sectorOptions={sectors.map((s) => ({ key: s.key, name: s.name }))}
      availableSectors={sectors.filter((s) => s.isAvailable).map((s) => s.key)}
    />
  );
}

function TenantComingSoon({ tenantName }: { tenantName: string }) {
  return (
    <main className={`${ycFontVariables} relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-yc-ivory-50 px-6 text-center font-ui text-yc-ink`}>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-yc-ink-soft">Bientôt en ligne</p>
      <h1 className="mt-4 font-display text-5xl font-semibold tracking-tight">{tenantName}</h1>
      <p className="mt-4 max-w-md text-yc-ink-soft">Notre site se prépare. Vous pouvez déjà parcourir le catalogue et commander.</p>
      <Link href="/catalogue" className="mt-8 rounded-full bg-yc-night-900 px-6 py-3 text-sm font-semibold text-white">Voir le catalogue</Link>
    </main>
  );
}
