import "server-only";
import type { Prisma } from "@yamacommerce/database";
import type { TemplateManifest } from "@yamacommerce/templates";
import type { ProductCardData } from "@/components/ui/product-card";
import type {
  ResolvedCategoriesContent,
  ResolvedProductsContent,
} from "@/components/sections/content-types";
import type { ResolvedContentBySectionId } from "@/components/sections/section-renderer";

/**
 * Résout le contenu catalogue RÉEL (produits/catégories) pour les sections qui en
 * dépendent (`categories`/`featured_products`/`new_arrivals`) — voir
 * `components/sections/content-types.ts` pour le contrat, et
 * `components/public-site-page.tsx` (avant cette étape : « la résolution du contenu
 * catalogue par tenant est hors périmètre ») pour le point d'arrêt que cette
 * fonction referme (revue du 18 septembre 2026, « produits réels par entreprise »).
 *
 * Exécutée dans le MÊME contexte `withTenant` que le reste de la résolution du site
 * (voir resolve-tenant-site.ts) — jamais une seconde transaction séparée. Ne met
 * JAMAIS en cache (contrairement au manifeste/tokens, voir cache.ts) : le stock, les
 * prix et le statut d'un produit changent bien plus souvent qu'une republication du
 * site, une entreprise doit voir ses modifications reflétées immédiatement.
 */
export async function resolveCatalogContentForManifest(
  tx: Prisma.TransactionClient,
  tenantId: string,
  manifest: TemplateManifest,
): Promise<ResolvedContentBySectionId> {
  const result: ResolvedContentBySectionId = {};

  const categorySections = manifest.pages.flatMap((page) =>
    page.sections.filter((section) => section.sectionKey === "categories"),
  );
  const featuredSections = manifest.pages.flatMap((page) =>
    page.sections.filter((section) => section.sectionKey === "featured_products"),
  );
  const newArrivalsSections = manifest.pages.flatMap((page) =>
    page.sections.filter((section) => section.sectionKey === "new_arrivals"),
  );

  if (categorySections.length > 0) {
    const categories = await tx.category.findMany({ where: { tenantId } });
    const bySlug = new Map(categories.map((c) => [c.id, c]));
    for (const section of categorySections) {
      const params = section.params as { title?: string; categoryIds: string[] };
      const items = params.categoryIds
        .map((id) => bySlug.get(id))
        .filter((c): c is NonNullable<typeof c> => Boolean(c))
        .map((c) => ({
          id: c.id,
          name: c.name,
          imageUrl: c.imageUrl ?? "",
          href: `/catalogue?categorie=${encodeURIComponent(c.slug)}`,
        }));
      const content: ResolvedCategoriesContent = { title: params.title, categories: items };
      result[section.id] = content;
    }
  }

  if (featuredSections.length > 0 || newArrivalsSections.length > 0) {
    const publishedProducts = await tx.product.findMany({
      where: { tenantId, status: "PUBLISHED", deletedAt: null },
      include: {
        images: { orderBy: { position: "asc" }, take: 1 },
        variants: { include: { inventoryItems: { select: { availableQuantity: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    const toCard = (product: (typeof publishedProducts)[number]): ProductCardData => {
      const sizes = Array.from(
        new Set(
          product.variants
            .map((v) => (v.attributes as Record<string, string> | null)?.size)
            .filter((s): s is string => Boolean(s)),
        ),
      );
      // En stock si AU MOINS une variante a du stock disponible dans AU MOINS une
      // boutique — voir la revue du 18 septembre 2026 : un ajustement de stock doit
      // se refléter sur le site public (via l'invalidation du cache déclenchée par
      // `adjustStockAction`, voir stock-pipeline.ts), pas seulement en base.
      const inStock = product.variants.some((v) => v.inventoryItems.some((item) => item.availableQuantity > 0));
      return {
        id: product.id,
        name: product.name,
        price: product.basePrice,
        compareAtPrice: product.compareAtPrice ?? undefined,
        imageUrl: product.images[0]?.url ?? "",
        href: `/p/${product.slug}`,
        sizes: sizes.length > 0 ? sizes : undefined,
        inStock,
      };
    };
    const byId = new Map(publishedProducts.map((p) => [p.id, p]));

    for (const section of featuredSections) {
      const params = section.params as { title?: string; productIds?: string[]; displayCount: number };
      // Sélection EXPLICITE si fournie (ordre du commerçant respecté) ; sinon repli
      // sur les plus récents — voir « vide = sélection automatique (top ventes) »
      // dans sections.ts : un vrai classement par ventes exige les données de
      // commandes, hors périmètre de cette étape (voir docs/13, étape 2 de l'ordre
      // validé) — les plus récents restent un repli honnête en attendant.
      const chosen = params.productIds?.length
        ? params.productIds.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p))
        : publishedProducts.slice(0, params.displayCount);
      const content: ResolvedProductsContent = {
        title: params.title,
        products: chosen.slice(0, params.displayCount).map(toCard),
      };
      result[section.id] = content;
    }

    for (const section of newArrivalsSections) {
      const params = section.params as { title?: string; displayCount: number };
      const content: ResolvedProductsContent = {
        title: params.title,
        products: publishedProducts.slice(0, params.displayCount).map(toCard),
      };
      result[section.id] = content;
    }
  }

  return result;
}
