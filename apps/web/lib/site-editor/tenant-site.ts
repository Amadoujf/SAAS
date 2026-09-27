import "server-only";
import type { Prisma } from "@yamacommerce/database";
import { withSuperAdminAccess, withTenant, upsertTemplate, publishTemplate, getEnabledModules } from "@yamacommerce/database";
import { DEFAULT_DESIGN_TOKENS, type DesignTokens, type DesignTokensOverrides } from "@yamacommerce/design-tokens";
import { validateSectionInstance, type SectionInstance } from "@yamacommerce/templates";
import { STORE_TEMPLATES } from "@/lib/storefront/store-templates";
import { RESIDENCES_TOKENS } from "@/lib/real-estate/estate-templates";
import { parseHomeContent } from "@/lib/storefront/home-content";

/**
 * Mise en service du site d'une entreprise dans l'éditeur visuel (moteur de sections,
 * brouillons, publication atomique — voir docs/12). Appelée à la première ouverture de
 * l'éditeur, idempotente ensuite :
 *
 * 1. le MODÈLE (SiteTemplate, table de la plateforme) du template choisi par
 *    l'entreprise est enregistré et publié — ses tokens sont ceux du template en code ;
 * 2. le SITE de l'entreprise (TenantSite) est créé sur ce modèle, avec SES couleurs ;
 * 3. son PREMIER BROUILLON est composé uniquement de SES contenus (textes de « Mon
 *    site », produits ou fiches publiés) — aucun nom, produit, prix ou visuel imposé.
 *    Le site public ne change pas tant que l'entreprise n'a pas publié.
 */

interface TemplateEntry { key: string; name: string; sectorKey: string; tokens: DesignTokens }

function templateFor(slug: string | undefined, sectorKey: string): TemplateEntry {
  const store = STORE_TEMPLATES.find((t) => t.slug === slug);
  if (store) return { key: `y-${store.slug}`, name: store.name, sectorKey: slug === "atelier-naya" ? "fashion" : "ecommerce", tokens: store.tokens };
  if (slug === "residences" || sectorKey === "real_estate") return { key: "y-residences", name: "Résidences", sectorKey: "real_estate", tokens: RESIDENCES_TOKENS };
  return { key: "y-essentiel", name: "Essentiel", sectorKey: "ecommerce", tokens: DEFAULT_DESIGN_TOKENS };
}

/** Manifeste GÉNÉRIQUE du modèle (partagé par toutes les entreprises qui l'utilisent) :
 *  aucune donnée d'entreprise — le brouillon réel est composé à part (étape 3). */
const GENERIC_MANIFEST = {
  pages: [{ slug: "accueil", title: "Accueil", isHome: true, sections: [{ id: "hero-immersif", sectionKey: "immersive_hero", variant: "stage", params: { title: "Bienvenue" }, order: 0, isEnabled: true }] }],
};

function brandingOverrides(branding: Record<string, unknown>): DesignTokensOverrides {
  const hex = (v: unknown) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : undefined);
  const primary = hex(branding.primaryColor);
  const accent = hex(branding.accentColor);
  const colors: Record<string, string> = {};
  if (primary) Object.assign(colors, { primary, mutedSurface: primary });
  if (accent) Object.assign(colors, { accentPrimary: accent, secondary: accent });
  return (Object.keys(colors).length ? { colors } : {}) as DesignTokensOverrides;
}

type Pool = { products: { id: string; slug: string; name: string; shortDescription: string | null; image?: string; alt?: string; category?: string }[]; listings: { id: string; slug: string; title: string; summary: string | null; image?: string; alt?: string }[] };

/** Premier brouillon : hero, carrousel et récit remplis avec les contenus RÉELS. */
export function buildStarterSections(input: { tenantName: string; sector: "commerce" | "real_estate" | "other"; content: ReturnType<typeof parseHomeContent>; pool: Pool }): SectionInstance[] {
  const { tenantName, sector, content, pool } = input;
  const slide = content.hero.slides[0];
  const sections: unknown[] = [];
  let order = 0;
  const push = (id: string, sectionKey: string, variant: string, params: Record<string, unknown>) => sections.push({ id, sectionKey, variant, params, order: order++, isEnabled: true });

  if (sector === "commerce") {
    const lead = pool.products.find((p) => p.id === slide?.productId) ?? pool.products.find((p) => p.image);
    push("hero-immersif", "immersive_hero", "stage", {
      eyebrow: slide?.eyebrow || undefined,
      title: slide?.title || tenantName,
      subtitle: slide?.subtitle || undefined,
      primaryCtaLabel: slide?.ctaLabel || "Voir le catalogue",
      primaryCtaHref: slide?.ctaHref || "/catalogue",
      // Photo produit classique (fond plein) : présentée encadrée, jamais comme un objet
      // détouré. L'entreprise peut remplacer par un visuel détouré dans l'éditeur.
      ...(lead ? { secondaryCtaLabel: lead.name.slice(0, 40), secondaryCtaHref: `/p/${lead.slug}`, subjectImage: lead.image, subjectAlt: lead.alt ?? lead.name, subjectStyle: "framed" } : {}),
      scrollEffect: "zoom",
      lighting: "halo",
    });
    if (pool.products.length) push("carrousel-vedette", "immersive_showcase", "depth", { eyebrow: "Sélection", title: "En vedette", source: "products", productIds: content.featuredProductIds.length ? content.featuredProductIds.slice(0, 12) : undefined });
    const storied = pool.products.filter((p) => p.image).slice(0, 3);
    if (storied.length >= 2) {
      push("recit", "scroll_story", "sequence", {
        title: "Dans le détail",
        steps: storied.map((p) => ({ eyebrow: p.category, title: p.name.slice(0, 90), body: p.shortDescription?.slice(0, 400) || undefined, imageUrl: p.image, imageAlt: p.alt ?? p.name })),
        ctaLabel: "Tout le catalogue",
        ctaHref: "/catalogue",
      });
    }
  } else if (sector === "real_estate") {
    const lead = pool.listings.find((l) => l.id === slide?.productId) ?? pool.listings.find((l) => l.image);
    push("hero-immersif", "immersive_hero", "architectural", {
      eyebrow: slide?.eyebrow || undefined,
      title: slide?.title || tenantName,
      subtitle: slide?.subtitle || undefined,
      primaryCtaLabel: slide?.ctaLabel || "Voir les biens",
      primaryCtaHref: slide?.ctaHref || "/biens",
      subjectImage: slide?.imageUrl ?? lead?.image,
      subjectAlt: slide?.imageAlt || lead?.alt,
      mobileImage: slide?.mobileImageUrl ?? undefined,
      scrollEffect: "zoom",
      lighting: "none",
    });
    if (pool.listings.length) push("carrousel-vedette", "immersive_showcase", "depth", { eyebrow: "Sélection de l'agence", title: "À la une", source: "listings", ctaLabel: "Voir le bien", listingIds: content.featuredProductIds.length ? content.featuredProductIds.slice(0, 12) : undefined });
    const storied = pool.listings.filter((l) => l.image).slice(0, 3);
    if (storied.length >= 2) {
      push("recit", "scroll_story", "sequence", {
        title: "Nos biens en images",
        steps: storied.map((l) => ({ title: l.title.slice(0, 90), body: l.summary?.slice(0, 400) || undefined, imageUrl: l.image, imageAlt: l.alt ?? l.title })),
        ctaLabel: "Tous nos biens",
        ctaHref: "/biens",
      });
    }
  } else {
    push("hero-immersif", "immersive_hero", "centered", { title: slide?.title || tenantName, subtitle: slide?.subtitle || undefined });
  }
  // Toute section est revalidée : un contenu d'entreprise hors bornes (texte trop long,
  // image au format inattendu) est écarté plutôt que de bloquer l'éditeur.
  return sections.flatMap((raw) => {
    try {
      return [validateSectionInstance(raw)];
    } catch {
      return [];
    }
  });
}

async function loadPool(tx: Prisma.TransactionClient, tenantId: string): Promise<Pool> {
  const [products, listings] = await Promise.all([
    tx.product.findMany({ where: { tenantId, status: "PUBLISHED", deletedAt: null }, include: { images: { orderBy: { position: "asc" }, take: 1 }, category: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 20 }),
    tx.listing.findMany({ where: { tenantId, status: "published", deletedAt: null }, orderBy: [{ featured: "desc" }, { updatedAt: "desc" }], take: 20 }),
  ]);
  return {
    products: products.map((p) => ({ id: p.id, slug: p.slug, name: p.name, shortDescription: p.shortDescription, image: p.images[0]?.url, alt: p.images[0]?.altText ?? undefined, category: p.category?.name })),
    listings: listings.map((l) => {
      const m = (Array.isArray(l.media) ? l.media : []) as { url?: string; alt?: string }[];
      return { id: l.id, slug: l.slug, title: l.title, summary: l.summary, image: m[0]?.url, alt: m[0]?.alt };
    }),
  };
}

/** Garantit modèle + site + brouillon ; renvoie l'identifiant du site de l'entreprise. */
export async function ensureTenantEditorSite(tenantId: string, tenantName: string): Promise<string> {
  const existing = await withTenant(tenantId, (tx) => tx.tenantSite.findUnique({ where: { tenantId }, select: { id: true } }));
  if (existing) return existing.id;

  const info = await withTenant(tenantId, async (tx) => ({
    tenant: await tx.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { sectorKey: true, branding: true } }),
    modules: new Set((await getEnabledModules(tx, tenantId)).map((m) => m.moduleKey)),
    content: (await tx.storefrontContent.findUnique({ where: { tenantId } }))?.content ?? null,
    pool: await loadPool(tx, tenantId),
  }));
  const branding = (info.tenant.branding ?? {}) as Record<string, unknown>;
  const entry = templateFor(typeof branding.templatePreference === "string" ? branding.templatePreference : undefined, info.tenant.sectorKey ?? "ecommerce");

  const templateId = await withSuperAdminAccess(async (tx) => {
    const template = await upsertTemplate(tx, {
      key: entry.key,
      name: entry.name,
      sectorKey: entry.sectorKey,
      artDirectionKey: entry.key,
      pageManifest: GENERIC_MANIFEST as never,
      defaultDesignTokens: entry.tokens,
      defaultAnimationLevel: entry.tokens.animation.level,
      availableSectionKeys: [],
    });
    if (template.status !== "published") await publishTemplate(tx, template.id);
    return template.id;
  });

  const sector = info.modules.has("catalog") ? "commerce" : info.modules.has("listings") ? "real_estate" : "other";
  const blocks = buildStarterSections({ tenantName, sector, content: parseHomeContent(info.content, tenantName), pool: info.pool });

  return withTenant(tenantId, async (tx) => {
    // Course entre deux premières ouvertures simultanées : l'unicité (tenantId) tranche.
    const already = await tx.tenantSite.findUnique({ where: { tenantId }, select: { id: true } });
    if (already) return already.id;
    const site = await tx.tenantSite.create({ data: { tenantId, templateId, designTokenOverrides: brandingOverrides(branding) as Prisma.InputJsonValue } });
    await tx.tenantSiteVersion.create({
      data: {
        tenantId,
        tenantSiteId: site.id,
        status: "draft",
        pages: { create: [{ tenantId, slug: "accueil", title: "Accueil", isHome: true, blocks: blocks as unknown as Prisma.InputJsonValue }] },
      },
    });
    return site.id;
  });
}
