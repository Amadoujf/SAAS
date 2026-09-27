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
      if (await isCatalogModuleEnabled(tenant.id)) {
        const store = await resolveStore("/");
        if (store.status === "ok") return <PublishedSectorHome site={resolution.site} store={store.store} />;
      } else if (await isEstateTenant(tenant.id)) {
        const estate = await resolveEstate("/");
        if (estate.status === "ok") return <PublishedSectorHome site={resolution.site} estate={estate.estate} />;
      }
      return <PublicSitePage tenantName={resolution.tenantName} site={resolution.site} />;
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
