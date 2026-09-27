/**
 * Compositions IMMERSIVES de démonstration (Sunu Marché, Almadies Immobilier), déposées
 * dans le BROUILLON de l'éditeur de chaque entreprise — la publication reste une action
 * de l'éditeur (bouton « Publier »), jamais faite ici. Script de DÉVELOPPEMENT : le site
 * de l'entreprise doit déjà exister (ouvrez /editeur une fois).
 *
 * Visuels : scène « lampe » = création originale (scripts/demo-visuals/scene-lampe.py) ;
 * photographies = recadrages provisoires marqués démo (demo-templates/MANIFEST.json).
 *
 *   pnpm --filter @yamacommerce/database run seed:immersive-demo
 */
import { validateSectionInstance, type SectionInstance } from "@yamacommerce/templates";
import { prisma } from "./client";
import { withTenant } from "./tenant-context";
import { assertDemoSeedAllowed, findDemoTenant } from "./demo-guard";
import { getOrCreateDraftVersion, updatePageBlocks } from "./site-versions-registry";

const L = "/demo-templates/scene-lampe";
const SM = "/demo-templates/sunu-marche";
const R = "/demo-templates/residences";
const C = "/demo-templates/ceramiques";

/** Collection « Terres émaillées » : produits de DÉMONSTRATION dont le visuel est le rendu
 *  original (scripts/demo-visuals/ceramiques.py) — le visuel montre donc bien le produit.
 *  `color` : couleur d'ambiance du carrousel « objets en arc ». */
const CERAMICS = [
  { slug: "jarre-indigo", name: "Jarre Indigo", cat: "decoration", price: 38_000, color: "#1d3f8f", desc: "Jarre en grès, émail indigo profond et pied en terre nue. Pièce tournée, 26 cm." },
  { slug: "bouteille-celadon", name: "Bouteille Céladon", cat: "decoration", price: 32_000, color: "#4f8a6e", desc: "Bouteille à col étroit, émail céladon translucide. Pour une tige ou seule, 32 cm." },
  { slug: "coupe-sable", name: "Coupe Sable", cat: "art-de-la-table", price: 24_000, color: "#b89a6a", desc: "Coupe large sur petit pied, émail sable satiné. Fruits, pain ou centre de table." },
  { slug: "vase-terracotta", name: "Vase Terracotta", cat: "decoration", price: 29_000, color: "#b4552d", desc: "Vase ovoïde, émail mat couleur terre cuite, toucher doux. 28 cm." },
  { slug: "soliflore-nuit", name: "Soliflore Nuit", cat: "decoration", price: 18_000, color: "#2c2f45", desc: "Soliflore élancé, émail noir miroir. Une fleur, une branche, 33 cm." },
  { slug: "amphore-ocre", name: "Amphore Ocre", cat: "decoration", price: 45_000, color: "#c28a2a", desc: "Amphore à épaule haute, émail ocre et coulure foncée au pied. 30 cm." },
] as const;

/** Crée (une seule fois) les produits de la collection ; renvoie leurs identifiants. */
async function ensureCeramics(tenantId: string): Promise<Record<string, string>> {
  return withTenant(tenantId, async (tx) => {
    const ids: Record<string, string> = {};
    const shop = await tx.shop.findFirst({ where: { tenantId, isMain: true } });
    if (!shop) return ids;
    for (const c of CERAMICS) {
      const found = await tx.product.findFirst({ where: { tenantId, slug: c.slug }, select: { id: true } });
      if (found) { ids[c.slug] = found.id; continue; }
      const category = await tx.category.findFirst({ where: { tenantId, slug: c.cat }, select: { id: true } });
      const product = await tx.product.create({
        data: { tenantId, slug: c.slug, name: c.name, description: `${c.desc} Visuel de démonstration (rendu).`, shortDescription: c.desc.split(".")[0], basePrice: c.price, status: "PUBLISHED", categoryId: category?.id ?? null, images: { create: [{ url: `${C}/${c.slug}.webp`, altText: `${c.name}, céramique émaillée`, position: 0 }] } },
      });
      const variant = await tx.productVariant.create({ data: { tenantId, productId: product.id, name: "Standard", price: c.price, attributes: {} } });
      await tx.inventoryItem.create({ data: { tenantId, productVariantId: variant.id, shopId: shop.id, availableQuantity: 8, lowStockThreshold: 2 } });
      ids[c.slug] = product.id;
    }
    return ids;
  });
}

const section = (id: string, sectionKey: string, variant: string, order: number, params: Record<string, unknown>) =>
  validateSectionInstance({ id, sectionKey, variant, order, isEnabled: true, params });

function sunuMarche(ceramics: Record<string, string>, otherProductIds: string[]): SectionInstance[] {
  return [
    section("hero-immersif", "immersive_hero", "stage", 0, {
      eyebrow: "Objets sculpturaux",
      title: "La lumière",
      titleAccent: "prend forme.",
      subtitle: "Céramique émaillée, laiton brossé, pierre : des objets pensés pour durer, qui composent la pièce autour d'eux.",
      primaryCtaLabel: "Voir la décoration",
      primaryCtaHref: "/catalogue?categorie=decoration",
      secondaryCtaLabel: "Tout le catalogue",
      secondaryCtaHref: "/catalogue",
      backgroundColor: "#F3EEE7",
      lighting: "halo",
      scrollEffect: "assemble",
      floating: true,
      intensity: "balanced",
      layers: [
        { imageUrl: `${L}/lumiere.webp`, alt: "", depth: 0.05, offsetY: -12, scale: 1.55, arriveFrom: "none" },
        { imageUrl: `${L}/socle.webp`, alt: "Socle en pierre", depth: 0.3, offsetY: 31, scale: 1.02, arriveFrom: "bottom" },
        { imageUrl: `${L}/pied.webp`, alt: "Pied en laiton brossé", depth: 0.45, offsetY: 9, scale: 0.18, arriveFrom: "bottom" },
        { imageUrl: `${L}/abat-jour.webp`, alt: "Abat-jour en céramique émaillée", depth: 0.75, offsetY: -17, scale: 1.12, arriveFrom: "top" },
        { imageUrl: `${L}/vase.webp`, alt: "Vase en céramique bleue", depth: 0.9, offsetX: 33, offsetY: 21, scale: 0.4, arriveFrom: "right" },
        { imageUrl: `${L}/galet.webp`, alt: "Galet de pierre polie", depth: 0.85, offsetX: -32, offsetY: 34, scale: 0.34, arriveFrom: "left" },
      ],
    }),
    section("gamme-ceramiques", "immersive_showcase", "arc", 1, {
      eyebrow: "Terres émaillées",
      title: "Choisissez votre émail.",
      subtitle: "Six pièces tournées, six couleurs.",
      source: "products",
      productIds: CERAMICS.map((c) => ceramics[c.slug]).filter((id): id is string => !!id),
      showPrice: true,
      ctaLabel: "Voir la pièce",
      autoplay: true,
      intervalSeconds: 4,
      backdrop: "dark",
      imageStyle: "cutout",
      overrides: CERAMICS.filter((c) => ceramics[c.slug]).map((c) => ({ recordId: ceramics[c.slug]!, accentColor: c.color })),
    }),
    section("recit-jarre", "scroll_story", "product", 2, {
      eyebrow: "Jarre Indigo",
      title: "Une pièce, quatre gestes.",
      image: `${C}/jarre-indigo.webp`,
      imageAlt: "Jarre Indigo, céramique émaillée bleu profond",
      objectStyle: "cutout",
      steps: [
        { eyebrow: "Le tournage", title: "Montée à la main", body: "Chaque jarre naît sur le tour : aucune n'a tout à fait le même galbe.", rotate: -14, objectScale: 0.9, accentColor: "#1d3f8f" },
        { eyebrow: "L'émail", title: "Indigo profond", body: "Trois couches d'émail, cuites à haute température : une surface qui reflète la lumière.", rotate: 9, objectScale: 1.08, accentColor: "#27306b" },
        { eyebrow: "Le pied", title: "Terre laissée nue", body: "Le pied n'est pas émaillé : on y lit la terre d'origine et la main du potier.", rotate: -4, objectScale: 1.18, accentColor: "#6b4a2f" },
        { eyebrow: "L'usage", title: "Seule ou fleurie", body: "Sur une console ou au sol, elle compose la pièce autour d'elle.", rotate: 0, objectScale: 1, accentColor: "#14505a" },
      ],
      ctaLabel: "Voir la Jarre Indigo",
      ctaHref: "/p/jarre-indigo",
    }),
    section("carrousel-vedette", "immersive_showcase", "depth", 3, {
      eyebrow: "Sélection",
      title: "Les pièces du moment",
      subtitle: "Choisies une à une, livrées partout au Sénégal.",
      source: "products",
      productIds: otherProductIds.slice(0, 12),
      showPrice: true,
      ctaLabel: "Voir la fiche",
      autoplay: true,
      intervalSeconds: 5,
      backdrop: "tinted",
    }),
    section("recit-matieres", "scroll_story", "focus", 4, {
      eyebrow: "Dans le détail",
      title: "Chaque objet a sa matière.",
      intro: "Faites défiler : la photo s'attarde sur ce qui fait la différence.",
      image: `${SM}/hero-objets.webp`,
      imageAlt: "Lampe, casque, bol en pierre, sac en cuir et vase bleu sur un socle",
      steps: [
        { eyebrow: "Décoration", title: "Une céramique qui diffuse", body: "L'abat-jour en céramique adoucit la lumière : une lueur chaude, jamais éblouissante.", focusX: 43, focusY: 40, zoom: 1.7 },
        { eyebrow: "High-Tech", title: "Le son, sans le bruit", body: "Un casque aux coussinets épais, pensé pour les longues journées.", focusX: 16, focusY: 64, zoom: 1.9 },
        { eyebrow: "Art de la table", title: "La pierre, brute", body: "Chaque bol est taillé dans un bloc : aucun n'est tout à fait identique.", focusX: 51, focusY: 82, zoom: 2.2 },
        { eyebrow: "Sacs & Accessoires", title: "Un cuir qui se patine", body: "Tannage végétal : le sac prend de la profondeur avec les années.", focusX: 70, focusY: 60, zoom: 1.8 },
      ],
      ctaLabel: "Explorer le catalogue",
      ctaHref: "/catalogue",
    }),
  ];
}

function almadies(villaSlug: string | null): SectionInstance[] {
  return [
    section("hero-immersif", "immersive_hero", "architectural", 0, {
      eyebrow: "Villas · Appartements · Terrains",
      title: "Des lieux",
      titleAccent: "d'exception.",
      subtitle: "Vente, location et gestion de biens, de Dakar à la Petite-Côte. Chaque bien est visité et vérifié par l'agence.",
      primaryCtaLabel: "Voir les biens",
      primaryCtaHref: "/biens",
      secondaryCtaLabel: "Biens à louer",
      secondaryCtaHref: "/biens?transaction=rent",
      subjectImage: `${R}/hero-villa.webp`,
      subjectAlt: "Villa blanche, piscine à débordement et palmiers face à l'océan",
      mobileImage: `${R}/hero-villa-mobile.webp`,
      focalX: 60,
      focalY: 50,
      lighting: "none",
      scrollEffect: "zoom",
      intensity: "balanced",
    }),
    section("carrousel-vedette", "immersive_showcase", "depth", 1, {
      eyebrow: "Sélection de l'agence",
      title: "À la une",
      source: "listings",
      showPrice: true,
      ctaLabel: "Voir le bien",
      autoplay: true,
      intervalSeconds: 6,
      backdrop: "neutral",
    }),
    section("recit-visite", "scroll_story", "focus", 2, {
      eyebrow: "Visite guidée",
      title: "Villa face à l'océan, pièce par pièce.",
      image: `${R}/hero-villa.webp`,
      imageAlt: "Villa contemporaine avec piscine et terrasse face à l'océan",
      steps: [
        { eyebrow: "Extérieur", title: "La terrasse plein ouest", body: "120 m² de pierre claire, ouverts sur le couchant.", focusX: 78, focusY: 72, zoom: 1.6 },
        { eyebrow: "Extérieur", title: "La piscine à débordement", body: "Son bassin se confond avec l'océan en contrebas.", focusX: 32, focusY: 88, zoom: 1.8 },
        { eyebrow: "Situation", title: "L'océan pour horizon", body: "Pointe des Almadies : aucun vis-à-vis, la mer à perte de vue.", focusX: 18, focusY: 62, zoom: 1.5 },
        { eyebrow: "Intérieur", title: "Le séjour traversant", body: "Baies vitrées toute hauteur : la lumière circule de part en part.", focusX: 82, focusY: 55, zoom: 2.1 },
      ],
      ...(villaSlug ? { ctaLabel: "Demander une visite", ctaHref: `/biens/${villaSlug}` } : {}),
    }),
  ];
}

async function applyDraft(slug: string, blocks: SectionInstance[]) {
  const tenant = await findDemoTenant(slug);
  if (!tenant) return console.info(`« ${slug} » : pas d'entreprise de démonstration — rien à faire.`);
  await withTenant(tenant.id, async (tx) => {
    const site = await tx.tenantSite.findUnique({ where: { tenantId: tenant.id } });
    if (!site) return console.info(`« ${slug} » : ouvrez d'abord l'éditeur (/editeur) pour créer le site.`);
    const draft = await getOrCreateDraftVersion(tx, tenant.id, site.id);
    const home = draft.pages.find((p) => p.isHome) ?? draft.pages[0];
    if (!home) return;
    await updatePageBlocks(tx, home.id, blocks);
    console.info(`« ${slug} » : composition immersive déposée dans le brouillon (à publier depuis l'éditeur).`);
  });
}

async function main() {
  assertDemoSeedAllowed();
  const sunu = await findDemoTenant("sunu-marche");
  const ceramics = sunu ? await ensureCeramics(sunu.id) : {};
  const others = sunu ? await withTenant(sunu.id, (tx) => tx.product.findMany({ where: { tenantId: sunu.id, status: "PUBLISHED", slug: { notIn: CERAMICS.map((c) => c.slug) } }, orderBy: { createdAt: "asc" }, select: { id: true } })) : [];
  await applyDraft("sunu-marche", sunuMarche(ceramics, others.map((p) => p.id)));
  const agency = await findDemoTenant("almadies-immobilier");
  const villa = agency ? await withTenant(agency.id, (tx) => tx.listing.findFirst({ where: { tenantId: agency.id, title: "Villa contemporaine face à l'océan" }, select: { slug: true } })) : null;
  await applyDraft("almadies-immobilier", almadies(villa?.slug ?? null));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

