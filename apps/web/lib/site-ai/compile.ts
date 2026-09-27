import { validateSectionInstance, type SectionInstance } from "@yamacommerce/templates";
import { contrastRatio, validateBrandColor } from "@/lib/storefront/home-content";
import { templateTokens } from "@/lib/storefront/store-templates";
import type { AiDirection } from "./schemas";
import type { CatalogProduct, SiteAiContext, SiteIdentity, SiteMotion } from "./types";
import { auditPhotos, pickIllustrated } from "./photo-audit";

/**
 * Direction artistique (données validées) → configuration RÉELLE : sections du registre,
 * identité du site, animations. Tout ce qui n'appartient pas à l'entreprise est écarté
 * (identifiants de produits inconnus, produits sans photo mis en scène), toute promesse
 * non vérifiable est retirée des textes, chaque section est revalidée par son schéma.
 */

export interface CompiledSite {
  blocks: SectionInstance[];
  identity: SiteIdentity;
  motion: SiteMotion;
  /** Ce qui a été ajusté ou écarté par la plateforme (affiché à l'entreprise). */
  notes: string[];
}

/** Promesses commerciales et preuves sociales que l'assistant n'a pas le droit d'inventer. */
const UNVERIFIABLE = [
  /certifi/i, /\blabel/i, /garanti/i, /\bn°\s?1\b/i, /numéro un/i, /\bmeilleur/i, /\b100\s?%/i, /\bbio(logique)?\b/i,
  /avis clients?/i, /témoign/i, /\bétoiles?\b/i, /livraison (offerte|gratuite)/i, /satisfait ou rembours/i, /\bpromo/i, /-\s?\d+\s?%/,
];

export function guardText(value: string | undefined, notes: string[], label: string): string | undefined {
  const text = value?.replace(/\s+/g, " ").trim();
  if (!text) return undefined;
  if (/https?:\/\/|<[a-z/]/i.test(text)) {
    notes.push(`Texte « ${label} » écarté : il contenait un lien ou du code.`);
    return undefined;
  }
  if (UNVERIFIABLE.some((re) => re.test(text))) {
    notes.push(`Texte « ${label} » écarté : il annonçait une promesse ou une preuve (certification, avis, gratuité…) que seule l'entreprise peut confirmer.`);
    return undefined;
  }
  return text;
}

export function safeColor(value: string | null | undefined, kind: "brand" | "background", style: string, notes: string[]): string | null {
  if (!value || !/^#[0-9a-fA-F]{6}$/.test(value)) return null;
  if (kind === "brand") {
    const problem = validateBrandColor(value);
    if (problem) {
      notes.push(`Couleur ${value} non retenue : ${problem.toLowerCase()}`);
      return null;
    }
    return value.toUpperCase();
  }
  const text = templateTokens(style)?.colors.textPrimary ?? "#111111";
  if (contrastRatio(value, text) < 7) {
    notes.push(`Fond ${value} non retenu : le texte ne serait pas assez lisible.`);
    return null;
  }
  return value.toUpperCase();
}

const INTENSITY = { discreet: "subtle", dynamic: "balanced", immersive: "bold" } as const;

export function compileDirection(direction: AiDirection, context: SiteAiContext): CompiledSite {
  const notes: string[] = [];
  const audit = auditPhotos(context);
  const style = direction.style;
  const identity: SiteIdentity = {
    style,
    primaryColor: safeColor(direction.palette.primary, "brand", style, notes),
    accentColor: safeColor(direction.palette.accent, "brand", style, notes),
    backgroundColor: safeColor(direction.palette.background, "background", style, notes),
  };
  const motion: SiteMotion = { level: direction.animation, mobile: direction.animation === "immersive" ? "reduced" : "same" };
  const intensity = INTENSITY[direction.animation];
  const byId = new Map(context.products.map((p) => [p.id, p]));
  const sections: Record<string, unknown> = {};

  // --- Ouverture ---------------------------------------------------------------
  const subject = direction.hero.subjectProductId ? byId.get(direction.hero.subjectProductId) : undefined;
  const subjectOk = subject?.imageUrl ? subject : undefined;
  if (direction.hero.subjectProductId && !subjectOk) notes.push("Le produit proposé pour l'ouverture n'a pas de photo : l'accueil s'ouvre sur votre message.");
  const libraryHero = context.libraryImages.find((i) => (i.width ?? 1200) >= 1200);
  let heroLayout = direction.hero.layout;
  if (heroLayout === "architectural" && !libraryHero && !(subjectOk && (subjectOk.imageWidth ?? 1200) >= 1200)) heroLayout = subjectOk ? "stage" : "centered";
  if (heroLayout === "stage" && !subjectOk) heroLayout = "centered";
  const heroImage = heroLayout === "architectural" ? (libraryHero?.url ?? subjectOk?.imageUrl) : subjectOk?.imageUrl;
  sections.hero = {
    id: "hero",
    sectionKey: "immersive_hero",
    variant: heroLayout,
    params: {
      eyebrow: guardText(direction.hero.eyebrow, notes, "surtitre"),
      title: guardText(direction.hero.title, notes, "titre") ?? context.tenantName,
      titleAccent: guardText(direction.hero.titleAccent, notes, "titre (suite)"),
      subtitle: guardText(direction.hero.subtitle, notes, "sous-titre"),
      primaryCtaLabel: guardText(direction.hero.ctaLabel, notes, "bouton") ?? "Découvrir la boutique",
      primaryCtaHref: "/catalogue",
      ...(subjectOk ? { secondaryCtaLabel: subjectOk.name.slice(0, 40), secondaryCtaHref: `/p/${subjectOk.slug}` } : {}),
      ...(heroImage
        ? { subjectImage: heroImage, subjectAlt: heroLayout === "architectural" && libraryHero ? libraryHero.alt ?? context.tenantName : subjectOk?.imageAlt ?? subjectOk?.name, subjectStyle: "framed" }
        : {}),
      lighting: heroLayout === "architectural" ? "none" : "halo",
      scrollEffect: "zoom",
      intensity,
    },
  };

  // --- Vitrine -----------------------------------------------------------------
  const chosen = pickIllustrated(context.products, direction.showcase.productIds, 10);
  const showcaseProducts = chosen.length >= 3 ? chosen : pickIllustrated(context.products, newestFirst(context.products).map((p) => p.id), 8);
  if (showcaseProducts.length >= 3) {
    const layout = direction.showcase.layout === "arc" && !audit.canShowcase ? "depth" : direction.showcase.layout;
    sections.showcase = {
      id: "vitrine",
      sectionKey: "immersive_showcase",
      variant: layout,
      params: {
        eyebrow: guardText(direction.showcase.eyebrow, notes, "surtitre de la vitrine"),
        title: guardText(direction.showcase.title, notes, "titre de la vitrine") ?? "La sélection",
        source: "products",
        productIds: showcaseProducts.map((p) => p.id),
        displayCount: Math.max(3, Math.min(12, showcaseProducts.length)),
        showPrice: true,
        ctaLabel: "Voir le produit",
        autoplay: direction.animation !== "discreet",
        imageStyle: "photo",
        backdrop: layout === "arc" ? "dark" : "tinted",
      },
    };
  } else {
    notes.push("Moins de 3 produits photographiés : la vitrine animée n'est pas proposée pour l'instant.");
  }

  // --- Récit ---------------------------------------------------------------------
  if (direction.story.enabled) {
    const steps = direction.story.steps
      .map((s) => ({ step: s, product: byId.get(s.productId) }))
      .filter((s): s is { step: typeof s.step; product: CatalogProduct } => Boolean(s.product?.imageUrl))
      .slice(0, 4);
    if (steps.length >= 2) {
      sections.story = {
        id: "recit",
        sectionKey: "scroll_story",
        variant: direction.story.layout,
        params: {
          eyebrow: guardText(direction.story.eyebrow, notes, "surtitre du récit"),
          title: guardText(direction.story.title, notes, "titre du récit"),
          image: steps[0]!.product.imageUrl,
          imageAlt: steps[0]!.product.imageAlt ?? steps[0]!.product.name,
          objectStyle: "photo",
          steps: steps.map(({ step, product }, i) => ({
            eyebrow: product.category ?? undefined,
            title: guardText(step.title, notes, `étape ${i + 1}`) ?? product.name.slice(0, 60),
            body: guardText(step.body, notes, `texte de l'étape ${i + 1}`),
            imageUrl: product.imageUrl,
            imageAlt: product.imageAlt ?? product.name,
            rotate: [-6, 5, -3, 0][i],
            objectScale: 1,
          })),
          ctaLabel: "Tout le catalogue",
          ctaHref: "/catalogue",
        },
      };
    } else {
      notes.push("Récit non créé : il faut au moins 2 produits photographiés.");
    }
  }

  // --- Catalogue -----------------------------------------------------------------
  const categories = context.categories.filter((c) => c.productCount > 0).slice(0, 6);
  if (direction.showCategories && categories.length) {
    sections.categories = { id: "categories", sectionKey: "categories", variant: "editorial", params: { title: "Nos univers", categoryIds: categories.map((c) => c.id), displayCount: categories.length } };
  }
  if (direction.showProductGrid && context.products.length) {
    sections.grid = { id: "grille", sectionKey: "featured_products", variant: "grid", params: { title: "Toute la collection", displayCount: Math.min(8, context.products.length) } };
  }

  const order = ["hero", ...direction.order.filter((k) => k !== "hero"), "showcase", "story", "categories", "grid"];
  const blocks: SectionInstance[] = [];
  for (const key of [...new Set(order)]) {
    const raw = sections[key] as { id: string; sectionKey: string; variant: string; params: Record<string, unknown> } | undefined;
    if (!raw) continue;
    try {
      blocks.push(validateSectionInstance({ ...raw, params: dropUndefined(raw.params), order: blocks.length, isEnabled: true }));
    } catch {
      notes.push(`Une section (${raw.sectionKey}) n'a pas pu être composée et a été écartée.`);
    }
  }
  return { blocks, identity, motion, notes };
}

export function newestFirst(products: CatalogProduct[]): CatalogProduct[] {
  return [...products].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function dropUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}
