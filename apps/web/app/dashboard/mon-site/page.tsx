import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { withTenant, getStorefrontCustomization, listCategories, listProducts } from "@yamacommerce/database";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { requireAnyTenantPermission } from "@/lib/tenant-permissions";
import { getTenantModuleKeys } from "@/lib/modules/tenant-modules";
import { getHomeStatus } from "@/lib/site-editor/home-status";
import { PageHeader } from "@/components/yc/panel";
import { SiteEditor } from "@/components/dashboard-site/site-editor";
import { HomeStatusCard } from "@/components/dashboard-site/home-status-card";
import { IdentityForm } from "@/components/dashboard-site/identity-form";
import { STORE_TEMPLATES } from "@/lib/storefront/store-templates";
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
  return (
    <>
      <PageHeader eyebrow="Gestion" title="Mon site" description="Votre page d'accueil, votre identité et ce qui est mis en avant sur votre site." />
      <div className="flex flex-col gap-4">
        <HomeStatusCard status={data.status} siteUrl={siteUrl} />
        {commerce ? (
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
        )}
      </div>
    </>
  );
}
