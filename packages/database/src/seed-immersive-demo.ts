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
import { withSuperAdminAccess, withTenant } from "./tenant-context";
import { getOrCreateDraftVersion, updatePageBlocks } from "./site-versions-registry";

const L = "/demo-templates/scene-lampe";
const SM = "/demo-templates/sunu-marche";
const R = "/demo-templates/residences";

const section = (id: string, sectionKey: string, variant: string, order: number, params: Record<string, unknown>) =>
  validateSectionInstance({ id, sectionKey, variant, order, isEnabled: true, params });

function sunuMarche(): SectionInstance[] {
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
    section("carrousel-vedette", "immersive_showcase", "depth", 1, {
      eyebrow: "Sélection",
      title: "Les pièces du moment",
      subtitle: "Choisies une à une, livrées partout au Sénégal.",
      source: "products",
      showPrice: true,
      ctaLabel: "Voir la fiche",
      autoplay: true,
      intervalSeconds: 5,
      backdrop: "tinted",
    }),
    section("recit-matieres", "scroll_story", "focus", 2, {
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
  const tenant = await withSuperAdminAccess((tx) => tx.tenant.findUnique({ where: { slug }, select: { id: true } }));
  if (!tenant) return console.info(`« ${slug} » introuvable — rien à faire.`);
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
  await applyDraft("sunu-marche", sunuMarche());
  const villa = await withSuperAdminAccess((tx) => tx.listing.findFirst({ where: { tenant: { slug: "almadies-immobilier" }, title: "Villa contemporaine face à l'océan" }, select: { slug: true } }));
  await applyDraft("almadies-immobilier", almadies(villa?.slug ?? null));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

