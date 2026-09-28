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
/** Restaurant : la carte (rubriques et plats actifs) tient lieu de catalogue. */
async function loadRestaurantContext(tx: Prisma.TransactionClient, tenantId: string, tenantName: string, logoUrl: string | null, sectorKey: string): Promise<SiteAiContext> {
  const [sections, media] = await Promise.all([
    tx.menuSection.findMany({ where: { tenantId, isActive: true }, orderBy: { position: "asc" }, include: { dishes: { where: { isActive: true }, orderBy: { position: "asc" } } } }),
    tx.mediaAsset.findMany({ where: { tenantId, status: "READY", mimeType: { startsWith: "image/" } }, select: { id: true, width: true, altText: true }, orderBy: { createdAt: "desc" }, take: 80 }),
  ]);
  const widthById = new Map(media.map((m) => [m.id, m.width]));
  const mediaId = (url: string | null) => url?.match(/^\/api\/media\/([0-9a-f-]{36})\//)?.[1] ?? null;
  const dishMedia = new Set(sections.flatMap((s) => s.dishes.map((d) => mediaId(d.imageUrl)).filter(Boolean)));
  return {
    tenantName,
    sectorKey,
    mode: "restaurant",
    logoUrl,
    products: sections.flatMap((s) =>
      s.dishes.map((d) => ({
        id: d.id,
        slug: "",
        name: d.name,
        category: s.name,
        priceLabel: `${new Intl.NumberFormat("fr-FR").format(d.price)} FCFA`,
        description: d.description,
        createdAt: d.createdAt.toISOString(),
        imageUrl: d.imageUrl,
        imageAlt: d.imageUrl ? d.name : null,
        imageWidth: mediaId(d.imageUrl) ? (widthById.get(mediaId(d.imageUrl)!) ?? null) : null,
        imageCount: d.imageUrl ? 1 : 0,
      })),
    ),
    categories: sections.map((s) => ({ id: s.id, name: s.name, slug: s.id, productCount: s.dishes.length, hasVisual: s.dishes.some((d) => d.imageUrl) })),
    libraryImages: media.filter((m) => !dishMedia.has(m.id)).map((m) => ({ url: `/api/media/${m.id}/file`, alt: m.altText, width: m.width })),
  };
}

export async function loadSiteAiContext(tx: Prisma.TransactionClient, tenantId: string, tenantName: string, logoUrl: string | null): Promise<SiteAiContext> {
  const t = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { sectorKey: true } });
  const restaurant = (await tx.tenantModule.count({ where: { tenantId, moduleKey: { in: ["qr_ordering", "table_reservations"] }, isEnabled: true } })) === 2;
  if (restaurant) return loadRestaurantContext(tx, tenantId, tenantName, logoUrl, t.sectorKey ?? "restaurant");
  const [tenant, products, categories, media] = await Promise.all([
    Promise.resolve(t),
    tx.product.findMany({
      where: { tenantId, status: "PUBLISHED", deletedAt: null },
      include: { images: { orderBy: { position: "asc" } }, category: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    tx.category.findMany({ where: { tenantId }, select: { id: true, name: true, slug: true, imageUrl: true, _count: { select: { products: { where: { status: "PUBLISHED", deletedAt: null } } } } }, orderBy: { name: "asc" } }),
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
    categories: categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug, productCount: c._count.products, hasVisual: Boolean(c.imageUrl) || products.some((p) => p.categoryId === c.id && p.images[0]?.url) })),
    libraryImages: media.filter((m) => !productMediaIds.has(m.id)).map((m) => ({ url: `/api/media/${m.id}/file`, alt: m.altText, width: m.width })),
  };
}
