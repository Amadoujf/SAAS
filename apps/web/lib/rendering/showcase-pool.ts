import "server-only";
import type { Prisma } from "@yamacommerce/database";
import { formatListingPrice, formatProductPrice, type ShowcaseItem, type ShowcasePool } from "@/lib/showcase/showcase";
import { PROPERTY_TYPE_LABELS, DEAL_TYPE_LABELS } from "@/lib/real-estate/labels";

/** Page publique d'une fiche selon son type — seuls les secteurs réellement livrés ont
 *  une page ; les autres fiches sont présentées sans lien (jamais un lien mort). */
const LISTING_ROUTES: Partial<Record<string, (slug: string) => string>> = {
  property: (slug) => `/biens/${slug}`,
};

/**
 * Réservoir des contenus présentables par le carrousel immersif : produits PUBLIÉS et
 * fiches PUBLIÉES de CETTE entreprise (appelé dans son contexte `withTenant` : la RLS
 * garantit qu'aucun contenu d'une autre entreprise n'y figure). 60 éléments au plus de
 * chaque sorte : la sélection affichée est faite ensuite (lib/showcase).
 */
export async function buildShowcasePool(tx: Prisma.TransactionClient, tenantId: string): Promise<ShowcasePool> {
  const [products, listings] = await Promise.all([
    tx.product.findMany({
      where: { tenantId, status: "PUBLISHED", deletedAt: null },
      include: { images: { orderBy: { position: "asc" }, take: 1 }, category: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    tx.listing.findMany({
      where: { tenantId, status: "published", deletedAt: null },
      include: { property: { select: { propertyType: true, dealType: true } } },
      orderBy: [{ featured: "desc" }, { updatedAt: "desc" }],
      take: 60,
    }),
  ]);
  return {
    products: products.map(
      (p): ShowcaseItem => ({
        id: p.id,
        title: p.name,
        subtitle: p.category?.name ?? undefined,
        imageUrl: p.images[0]?.url,
        imageAlt: p.images[0]?.altText ?? p.name,
        href: `/p/${p.slug}`,
        priceLabel: formatProductPrice(p.basePrice),
      }),
    ),
    listings: listings.map((l): ShowcaseItem => {
      const media = (Array.isArray(l.media) ? l.media : []) as { url?: string; alt?: string }[];
      const loc = (l.location ?? {}) as { commune?: string };
      const kind = l.property ? `${PROPERTY_TYPE_LABELS[l.property.propertyType] ?? "Bien"} · ${DEAL_TYPE_LABELS[l.property.dealType] ?? ""}` : undefined;
      return {
        id: l.id,
        title: l.title,
        subtitle: [kind, loc.commune].filter(Boolean).join(" · ") || undefined,
        imageUrl: media[0]?.url,
        imageAlt: media[0]?.alt || l.title,
        href: LISTING_ROUTES[l.type]?.(l.slug),
        priceLabel: formatListingPrice(l.price, l.priceUnit),
      };
    }),
  };
}
