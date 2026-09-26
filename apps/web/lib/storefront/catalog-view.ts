import "server-only";
import { withTenant, listProducts } from "@yamacommerce/database";
import type { StoreProductCard } from "@/components/store/product-card";

/** Cartes produits publiques (publiés uniquement) avec disponibilité réelle. */
export async function loadProductCards(tenantId: string, opts: { categoryId?: string; limit?: number; excludeSlug?: string } = {}): Promise<StoreProductCard[]> {
  return withTenant(tenantId, async (tx) => {
    const products = await listProducts(tx, tenantId, { status: "PUBLISHED", categoryId: opts.categoryId, limit: opts.limit ?? 60 });
    const variantIds = products.flatMap((p) => p.variants.map((v) => v.id));
    const stock = await tx.inventoryItem.groupBy({
      by: ["productVariantId"],
      where: { tenantId, productVariantId: { in: variantIds } },
      _sum: { availableQuantity: true },
    });
    const byVariant = new Map(stock.map((s) => [s.productVariantId, s._sum.availableQuantity ?? 0]));
    return products
      .filter((p) => p.slug !== opts.excludeSlug)
      .map((p) => ({
        slug: p.slug,
        name: p.name,
        price: p.variants.length ? Math.min(...p.variants.map((v) => v.price)) : p.basePrice,
        compareAtPrice: p.compareAtPrice,
        imageUrl: p.images[0]?.url ?? null,
        soldOut: p.variants.every((v) => (byVariant.get(v.id) ?? 0) <= 0),
        category: p.category?.name ?? null,
      }));
  });
}
