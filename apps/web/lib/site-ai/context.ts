import "server-only";
import type { Prisma } from "@yamacommerce/database";
import { formatProductPrice } from "@/lib/showcase/showcase";
import type { SiteAiContext } from "./types";

/**
 * Données de l'entreprise transmises à l'assistant — lues sous isolation (`tx` ouvert
 * par `withTenant` pour CETTE entreprise) et limitées à ce qui est publié : produits en
 * ligne, catégories, médiathèque d'images prêtes, logo. Rien d'une autre entreprise,
 * rien de privé (commandes, clients, stocks).
 */
export async function loadSiteAiContext(tx: Prisma.TransactionClient, tenantId: string, tenantName: string, logoUrl: string | null): Promise<SiteAiContext> {
  const [tenant, products, categories, media] = await Promise.all([
    tx.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { sectorKey: true } }),
    tx.product.findMany({
      where: { tenantId, status: "PUBLISHED", deletedAt: null },
      include: { images: { orderBy: { position: "asc" } }, category: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    tx.category.findMany({ where: { tenantId }, select: { id: true, name: true, slug: true, _count: { select: { products: { where: { status: "PUBLISHED", deletedAt: null } } } } }, orderBy: { name: "asc" } }),
    tx.mediaAsset.findMany({ where: { tenantId, status: "READY", mimeType: { startsWith: "image/" } }, select: { id: true, width: true, altText: true }, orderBy: { createdAt: "desc" }, take: 80 }),
  ]);
  const widthById = new Map(media.map((m) => [m.id, m.width]));
  const productMediaIds = new Set(products.flatMap((p) => p.images.map((i) => i.mediaAssetId).filter(Boolean)));
  return {
    tenantName,
    sectorKey: tenant.sectorKey ?? "ecommerce",
    logoUrl,
    products: products.map((p) => {
      const image = p.images[0];
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        category: p.category?.name ?? null,
        priceLabel: formatProductPrice(p.basePrice),
        description: p.shortDescription ?? p.description ?? null,
        createdAt: p.createdAt.toISOString(),
        imageUrl: image?.url ?? null,
        imageAlt: image?.altText ?? null,
        imageWidth: image?.mediaAssetId ? (widthById.get(image.mediaAssetId) ?? null) : null,
        imageCount: p.images.length,
      };
    }),
    categories: categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug, productCount: c._count.products })),
    libraryImages: media.filter((m) => !productMediaIds.has(m.id)).map((m) => ({ url: `/api/media/${m.id}/file`, alt: m.altText, width: m.width })),
  };
}
