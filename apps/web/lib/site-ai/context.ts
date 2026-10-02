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

/** Concession : les véhicules publiés (hors vendus) tiennent lieu de catalogue. */
async function loadAutoContext(tx: Prisma.TransactionClient, tenantId: string, tenantName: string, logoUrl: string | null, sectorKey: string): Promise<SiteAiContext> {
  const [vehicles, media] = await Promise.all([
    tx.listing.findMany({ where: { tenantId, type: "vehicle", status: "published", deletedAt: null, vehicle: { stockStatus: { in: ["incoming", "available", "reserved"] } } }, include: { vehicle: true }, orderBy: [{ featured: "desc" }, { createdAt: "desc" }], take: 60 }),
    tx.mediaAsset.findMany({ where: { tenantId, status: "READY", mimeType: { startsWith: "image/" } }, select: { id: true, width: true, altText: true }, orderBy: { createdAt: "desc" }, take: 80 }),
  ]);
  const widthById = new Map(media.map((m) => [m.id, m.width]));
  const mediaId = (url: string | null | undefined) => url?.match(/^\/api\/media\/([0-9a-f-]{36})\//)?.[1] ?? null;
  const imagesOf = (m: unknown) => (Array.isArray(m) ? m : []).filter((x): x is { url: string; alt?: string } => !!x && typeof (x as { url?: unknown }).url === "string");
  const used = new Set(vehicles.flatMap((v) => imagesOf(v.media).map((i) => mediaId(i.url)).filter(Boolean)));
  const bodies = new Map<string, number>();
  for (const v of vehicles) bodies.set(v.vehicle!.bodyType, (bodies.get(v.vehicle!.bodyType) ?? 0) + 1);
  const BODY: Record<string, string> = { citadine: "Citadines", berline: "Berlines", break: "Breaks", suv: "SUV", "4x4": "4×4", pickup: "Pick-up", monospace: "Monospaces", coupe: "Coupés", utilitaire: "Utilitaires" };
  return {
    tenantName,
    sectorKey,
    mode: "automobile",
    logoUrl,
    products: vehicles.map((v) => {
      const imgs = imagesOf(v.media);
      const first = imgs[0];
      return {
        id: v.id,
        slug: v.slug,
        name: v.title,
        category: BODY[v.vehicle!.bodyType] ?? v.vehicle!.bodyType,
        priceLabel: v.price ? `${new Intl.NumberFormat("fr-FR").format(v.price)} FCFA` : "Prix sur demande",
        description: v.summary ?? v.description,
        createdAt: v.createdAt.toISOString(),
        imageUrl: first?.url ?? null,
        imageAlt: first ? first.alt || v.title : null,
        imageWidth: mediaId(first?.url) ? (widthById.get(mediaId(first?.url)!) ?? null) : first?.url.startsWith("/demo-templates/") ? 1440 : null,
        imageCount: imgs.length,
      };
    }),
    categories: [...bodies.entries()].map(([k, n]) => ({ id: k, name: BODY[k] ?? k, slug: k, productCount: n, hasVisual: true })),
    libraryImages: media.filter((m) => !used.has(m.id)).map((m) => ({ url: `/api/media/${m.id}/file`, alt: m.altText, width: m.width })),
  };
}

/** Établissement : les formations publiées tiennent lieu de catalogue (catégorie = domaine). */
async function loadEducationContext(tx: Prisma.TransactionClient, tenantId: string, tenantName: string, logoUrl: string | null, sectorKey: string): Promise<SiteAiContext> {
  const [programs, media] = await Promise.all([
    tx.listing.findMany({ where: { tenantId, type: "course", status: "published", deletedAt: null }, include: { program: true }, orderBy: [{ featured: "desc" }, { createdAt: "desc" }], take: 60 }),
    tx.mediaAsset.findMany({ where: { tenantId, status: "READY", mimeType: { startsWith: "image/" } }, select: { id: true, width: true, altText: true }, orderBy: { createdAt: "desc" }, take: 80 }),
  ]);
  const widthById = new Map(media.map((m) => [m.id, m.width]));
  const mediaId = (url: string | null | undefined) => url?.match(/^\/api\/media\/([0-9a-f-]{36})\//)?.[1] ?? null;
  const imagesOf = (m: unknown) => (Array.isArray(m) ? m : []).filter((x): x is { url: string; alt?: string } => !!x && typeof (x as { url?: unknown }).url === "string");
  const used = new Set(programs.flatMap((p) => imagesOf(p.media).map((i) => mediaId(i.url)).filter(Boolean)));
  const DOMAIN: Record<string, string> = { school: "Scolarité", training: "Formation professionnelle", language: "Langues", tutoring: "Soutien scolaire", other: "Autres" };
  const domains = new Map<string, number>();
  for (const p of programs) if (p.program) domains.set(p.program.category, (domains.get(p.program.category) ?? 0) + 1);
  return {
    tenantName,
    sectorKey,
    mode: "education",
    logoUrl,
    products: programs.filter((p) => p.program).map((p) => {
      const imgs = imagesOf(p.media);
      const first = imgs[0];
      return {
        id: p.id,
        slug: p.slug,
        name: p.title,
        category: DOMAIN[p.program!.category] ?? p.program!.category,
        priceLabel: p.price != null ? `${new Intl.NumberFormat("fr-FR").format(p.price)} FCFA` : "Sur devis",
        description: p.summary ?? p.description,
        createdAt: p.createdAt.toISOString(),
        imageUrl: first?.url ?? null,
        imageAlt: first ? first.alt || p.title : null,
        imageWidth: mediaId(first?.url) ? (widthById.get(mediaId(first?.url)!) ?? null) : first?.url.startsWith("/demo-templates/") ? 1440 : null,
        imageCount: imgs.length,
      };
    }),
    categories: [...domains.entries()].map(([k, n]) => ({ id: k, name: DOMAIN[k] ?? k, slug: k, productCount: n, hasVisual: true })),
    libraryImages: media.filter((m) => !used.has(m.id)).map((m) => ({ url: `/api/media/${m.id}/file`, alt: m.altText, width: m.width })),
  };
}

export async function loadSiteAiContext(tx: Prisma.TransactionClient, tenantId: string, tenantName: string, logoUrl: string | null): Promise<SiteAiContext> {
  const t = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { sectorKey: true, isDemo: true, branding: true } });
  const restaurant = (await tx.tenantModule.count({ where: { tenantId, moduleKey: { in: ["qr_ordering", "table_reservations"] }, isEnabled: true } })) === 2;
  if (restaurant) return loadRestaurantContext(tx, tenantId, tenantName, logoUrl, t.sectorKey ?? "restaurant");
  const automobile = (await tx.tenantModule.count({ where: { tenantId, moduleKey: { in: ["listings", "test_drive_appointments"] }, isEnabled: true } })) === 2;
  if (automobile) return loadAutoContext(tx, tenantId, tenantName, logoUrl, t.sectorKey ?? "automobile");
  const education = (await tx.tenantModule.count({ where: { tenantId, moduleKey: { in: ["courses", "enrollments"] }, isEnabled: true } })) === 2;
  if (education) return loadEducationContext(tx, tenantId, tenantName, logoUrl, t.sectorKey ?? "education");
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
    demoHeroProducts: demoHeroProducts(t),
  };
}

/** Produits principaux imposés par direction, lus UNIQUEMENT sur une entreprise de
 *  démonstration (réglage posé par son script de démo) ; une vraie entreprise : rien. */
function demoHeroProducts(t: { isDemo: boolean; branding: unknown }): Partial<Record<string, string>> | undefined {
  if (!t.isDemo) return undefined;
  const raw = (t.branding as { demoHeroProducts?: unknown } | null)?.demoHeroProducts;
  if (!raw || typeof raw !== "object") return undefined;
  return Object.fromEntries(Object.entries(raw as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === "string"));
}
