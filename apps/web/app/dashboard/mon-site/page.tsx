import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { withTenant, getStorefrontCustomization, listCategories, listProducts } from "@yamacommerce/database";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { requireAnyTenantPermission, requireTenantPermission } from "@/lib/tenant-permissions";
import { getTenantModuleKeys, isRestaurant } from "@/lib/modules/tenant-modules";
import { RestaurantSetup } from "@/components/dashboard-restaurant/restaurant-setup";
import { getMenu } from "@yamacommerce/database";
import { getHomeStatus } from "@/lib/site-editor/home-status";
import { PageHeader } from "@/components/yc/panel";
import { SiteEditor } from "@/components/dashboard-site/site-editor";
import { HomeStatusCard } from "@/components/dashboard-site/home-status-card";
import { IdentityForm } from "@/components/dashboard-site/identity-form";
import { STORE_TEMPLATES } from "@/lib/storefront/store-templates";
import { SiteStudio } from "@/components/site-ai/site-studio";
import { loadStudio } from "@/lib/site-ai/pipeline";
import { parseHomeContent } from "@/lib/storefront/home-content";

export const metadata: Metadata = { title: "Mon site — Y-COM", robots: { index: false, follow: false } };

/**
 * « Mon site » : l'UNIQUE entrée pour le site public. En tête, ce qui est en ligne comme
 * page d'accueil et le bouton vers l'éditeur visuel ; dessous, l'identité (appliquée à
 * tout le site) et, tant qu'il est en ligne, les réglages de l'accueil standard.
 */
export default async function MySitePage() {
  const membership = await getCurrentTenantMembership();
  if (!membership) redirect("/dashboard");
  const tenantId = membership.tenantId;
  const actor = await requireAnyTenantPermission(tenantId, ["settings.branding", "site.edit"]);
  if (!actor) redirect("/dashboard");
  const modules = await getTenantModuleKeys(tenantId);
  const commerce = modules.has("catalog");
  const data = await withTenant(tenantId, async (tx) => ({
    custom: await getStorefrontCustomization(tx, tenantId),
    categories: commerce ? await listCategories(tx, tenantId) : [],
    products: commerce ? await listProducts(tx, tenantId, { status: "PUBLISHED", limit: 300 }) : [],
    domain: await tx.domain.findFirst({ where: { tenantId, lifecycleStatus: "ACTIVE" }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] }),
    status: await getHomeStatus(tx, tenantId),
  }));
  const b = data.custom.branding;
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  const siteUrl = data.domain ? `https://${data.domain.domain}` : null;
  const advanced = commerce ? (
    <SiteEditor
      storeUrl={siteUrl}
      homeComposedInEditor={data.status.mode === "editor"}
      templates={STORE_TEMPLATES.map((t) => ({ slug: t.slug, name: t.name, tagline: t.tagline, layout: t.layout, bg: t.tokens.colors.background, ink: t.tokens.colors.textPrimary, primary: t.tokens.colors.primary, accent: t.tokens.colors.accentPrimary }))}
      products={data.products.map((p) => ({ id: p.id, name: p.name, imageUrl: p.images[0]?.url ?? null, price: p.basePrice }))}
      categories={data.categories.map((c) => ({ id: c.id, name: c.name }))}
      initial={{
        templatePreference: str(b.templatePreference) ?? STORE_TEMPLATES[0]!.slug,
        logoUrl: str(b.logoUrl),
        primaryColor: str(b.primaryColor),
        accentColor: str(b.accentColor),
        content: parseHomeContent(data.custom.content, data.custom.tenantName),
      }}
    />
  ) : (
    <IdentityForm initial={{ logoUrl: str(b.logoUrl), primaryColor: str(b.primaryColor), accentColor: str(b.accentColor) }} />
  );

  // Commerce : création et personnalisation assistées (aperçu réel + assistant). Les
  // autres secteurs gardent la page actuelle en attendant leur adaptation.
  const studio = commerce && (await requireTenantPermission(tenantId, "site.edit")) ? await loadStudio() : null;
  if (studio) {
    const canPublish = Boolean(await requireTenantPermission(tenantId, "site.publish"));
    return (
      <>
        <PageHeader eyebrow="Gestion" title="Mon site" description="Décrivez ce que vous voulez : l'assistant compose et ajuste votre boutique. Vous publiez quand vous êtes prêt." />
        <SiteStudio initial={studio} canPublish={canPublish} siteUrl={siteUrl} advanced={advanced} />
      </>
    );
  }

  if (isRestaurant(modules)) {
    const menu = await withTenant(tenantId, (tx) => getMenu(tx, tenantId));
    const restoStudio = (await requireTenantPermission(tenantId, "site.edit")) ? await loadStudio() : null;
    const content = parseHomeContent(data.custom.content, data.custom.tenantName);
    const slide = content.hero.slides[0];
    const custom = slide && !(slide.id === "accueil" && slide.ctaHref === "/catalogue");
    const simple = (
        <div className="flex flex-col gap-5">
          <RestaurantSetup
            siteUrl={siteUrl}
            editorHome={data.status.mode === "editor"}
            home={{
              coverUrl: custom ? (slide?.imageUrl ?? null) : null,
              coverDemo: custom ? Boolean(slide?.demo) : false,
              eyebrow: custom ? (slide?.eyebrow ?? "") : "",
              title: custom ? (slide?.title ?? data.custom.tenantName) : data.custom.tenantName,
              subtitle: custom ? (slide?.subtitle ?? "") : "",
              contactPhone: str(b.contactPhone) ?? "",
              contactWhatsapp: str(b.contactWhatsapp) ?? "",
              contactAddress: str(b.contactAddress) ?? "",
            }}
            dishes={menu.flatMap((sec) => sec.dishes.filter((d) => d.isActive).map((d) => ({ id: d.id, name: d.name, section: sec.name, price: d.price, imageUrl: d.imageUrl, imageDemo: d.imageDemo })))}
          />
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><span className="grid h-7 w-7 place-items-center rounded-full bg-yc-night-900 text-[13px] font-bold text-white">3</span> Logo et couleurs</p>
            {advanced}
          </div>
          <HomeStatusCard status={data.status} siteUrl={siteUrl} />
        </div>
    );
    if (restoStudio) {
      const canPublish = Boolean(await requireTenantPermission(tenantId, "site.publish"));
      return (
        <>
          <PageHeader eyebrow="Gestion" title="Mon site" description="Décrivez votre restaurant : l'assistant compose trois propositions avec VOTRE carte, puis vous ajustez en conversation. Vous publiez quand vous êtes prêt." />
          <SiteStudio initial={restoStudio} canPublish={canPublish} siteUrl={siteUrl} advanced={simple} />
        </>
      );
    }
    return (
      <>
        <PageHeader eyebrow="Gestion" title="Mon site" description="Votre vitrine, les photos de vos plats, votre logo : c'est tout ce qu'il faut. La carte, les commandes et les réservations sont déjà en place." />
        {simple}
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="Gestion" title="Mon site" description="Votre page d'accueil, votre identité et ce qui est mis en avant sur votre site." />
      <div className="flex flex-col gap-4">
        <HomeStatusCard status={data.status} siteUrl={siteUrl} />
        {!commerce && <p className="rounded-xl bg-yc-ink/[0.04] px-4 py-3 text-sm text-yc-ink-soft">La création assistée par IA arrive bientôt pour votre secteur. En attendant, composez votre page dans l&apos;éditeur.</p>}
        {advanced}
      </div>
    </>
  );
}
