import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { withTenant, getStorefrontCustomization, listCategories, listProducts } from "@yamacommerce/database";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { requireTenantPermission } from "@/lib/tenant-permissions";
import { PageHeader } from "@/components/yc/panel";
import { SiteEditor } from "@/components/dashboard-site/site-editor";
import { STORE_TEMPLATES } from "@/lib/storefront/store-templates";
import { parseHomeContent } from "@/lib/storefront/home-content";

export const metadata: Metadata = { title: "Mon site — YamaCommerce", robots: { index: false, follow: false } };

/** Personnalisation de la boutique : template, identité et contenus mis en avant. */
export default async function MySitePage() {
  const membership = await getCurrentTenantMembership();
  if (!membership) redirect("/dashboard");
  if (!(await requireTenantPermission(membership.tenantId, "settings.branding"))) redirect("/dashboard");
  const tenantId = membership.tenantId;
  const { custom, categories, products, domain } = await withTenant(tenantId, async (tx) => ({
    custom: await getStorefrontCustomization(tx, tenantId),
    categories: await listCategories(tx, tenantId),
    products: await listProducts(tx, tenantId, { status: "PUBLISHED", limit: 300 }),
    domain: await tx.domain.findFirst({ where: { tenantId, lifecycleStatus: "ACTIVE" }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] }),
  }));
  const b = custom.branding;
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  return (
    <>
      <PageHeader eyebrow="Gestion" title="Mon site" description="Choisissez votre template, vos couleurs et ce qui est mis en avant sur l'accueil de votre boutique." />
      <SiteEditor
        storeUrl={domain ? `https://${domain.domain}` : null}
        templates={STORE_TEMPLATES.map((t) => ({ slug: t.slug, name: t.name, tagline: t.tagline, layout: t.layout, bg: t.tokens.colors.background, ink: t.tokens.colors.textPrimary, primary: t.tokens.colors.primary, accent: t.tokens.colors.accentPrimary }))}
        products={products.map((p) => ({ id: p.id, name: p.name, imageUrl: p.images[0]?.url ?? null, price: p.basePrice }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        initial={{
          templatePreference: str(b.templatePreference) ?? STORE_TEMPLATES[0]!.slug,
          logoUrl: str(b.logoUrl),
          primaryColor: str(b.primaryColor),
          accentColor: str(b.accentColor),
          content: parseHomeContent(custom.content, custom.tenantName),
        }}
      />
    </>
  );
}
