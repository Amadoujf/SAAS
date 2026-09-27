import { validateSectionInstance, type SectionInstance } from "@yamacommerce/templates";
import { contrastRatio, validateBrandColor } from "@/lib/storefront/home-content";
import { templateTokens } from "@/lib/storefront/store-templates";
import { ARCHETYPE_KEYS, type AiDirection, type ArchetypeKey } from "./schemas";
import { ARCHETYPES, type Slot } from "./archetypes";
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
  /certifi/i, /(?<!\p{L})labels?(?!\p{L})/iu, /garanti/i, /n°\s?1(?!\d)/i, /numéro un/i, /meilleur/i, /\d\s?%/,
  /(?<!\p{L})bio(logique)?s?(?!\p{L})/iu, /(?<!\p{L})avis(?!\p{L})/iu, /témoign/iu, /étoiles?/iu, /gratuit/iu, /offert/iu,
  /satisfait ou rembours/iu, /promo/iu, /(?<!\p{L})soldes?(?!\p{L})/iu, /\bclients? satisfaits?/iu, /(?<!\p{L})top\s?\d/iu,
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

type RawSection = { id: string; sectionKey: string; variant: string; params: Record<string, unknown> };

/** Mise en forme d'une phrase tirée d'une description réelle (jamais inventée). */
export function excerpt(text: string | null | undefined, max: number): string | undefined {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return undefined;
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const sentence = cut.lastIndexOf(". ");
  return sentence > max * 0.5 ? cut.slice(0, sentence + 1) : `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

/**
 * Direction (données validées) → site RÉEL. L'archétype fixe la structure ; chaque
 * emplacement est rempli avec les produits, photos, catégories et textes de l'entreprise.
 * Un emplacement impossible à remplir honnêtement (pas assez de photos, pas de texte)
 * est remplacé par une présentation plus simple ou retiré — et c'est signalé.
 */
export function compileDirection(direction: AiDirection, context: SiteAiContext): CompiledSite {
  return compileSlots(direction, context, ARCHETYPES[direction.archetype].slots);
}

/** Compose une suite d'emplacements (un archétype entier, ou une section ajoutée par
 *  l'assistant) avec les données de l'entreprise. */
export function compileSlots(direction: AiDirection, context: SiteAiContext, slots: Slot[], reserved: string[] = []): CompiledSite {
  const notes: string[] = [];
  const audit = auditPhotos(context);
  const style = direction.style;
  const identity: SiteIdentity = {
    style,
    primaryColor: safeColor(direction.palette.primary, "brand", style, notes),
    accentColor: safeColor(direction.palette.accent, "brand", style, notes),
    backgroundColor: safeColor(direction.palette.background, "background", style, notes),
    fontPair: direction.typography,
    shape: direction.shape,
  };
  const motion: SiteMotion = { level: direction.animation, mobile: direction.animation === "immersive" ? "reduced" : "same" };
  const intensity = INTENSITY[direction.animation];
  const byId = new Map(context.products.map((p) => [p.id, p]));
  const copy = direction.copy;
  const text = (value: string | undefined, label: string) => guardText(value, notes, label);

  // Photos disponibles : sélection demandée d'abord, puis les plus récentes.
  const illustrated = context.products.filter((p) => p.imageUrl);
  const featured = uniqueProducts([...pickIllustrated(context.products, direction.featuredProductIds, 12), ...newestFirst(illustrated)]);
  const heroProduct = pickIllustrated(context.products, [direction.heroProductId], 1)[0] ?? featured[0];
  const signatureProduct = pickIllustrated(context.products, [direction.signatureProductId], 1)[0] ?? featured.find((p) => p.id !== heroProduct?.id) ?? heroProduct;
  if (direction.heroProductId && !byId.get(direction.heroProductId)?.imageUrl) notes.push("Le produit proposé pour l'ouverture n'a pas de photo : une autre pièce photographiée a été retenue.");
  const libraryHero = context.libraryImages.find((i) => (i.width ?? 0) >= 1200);
  const bigPhoto = libraryHero ? { url: libraryHero.url, alt: libraryHero.alt ?? context.tenantName } : heroProduct && (heroProduct.imageWidth ?? 0) >= 1200 ? photo(heroProduct) : null;

  // Chaque photo sert une fois avant d'être réutilisée : pas la même image partout.
  const used = new Set<string>(reserved);
  const nextPhoto = (prefer?: CatalogProduct): CatalogProduct | undefined => {
    if (prefer && !used.has(prefer.id)) return used.add(prefer.id), prefer;
    const fresh = featured.find((p) => !used.has(p.id)) ?? featured[used.size % Math.max(1, featured.length)];
    if (fresh) used.add(fresh.id);
    return fresh;
  };

  const heroTitle = text(copy.heroTitle, "titre") ?? context.tenantName;
  const cta = text(copy.ctaLabel, "bouton") ?? "Découvrir la boutique";
  const manifesto = text(copy.manifesto, "manifeste");
  const manifestoBody = text(copy.manifestoBody, "texte du manifeste");
  // Univers avec un visuel d'abord ; un univers sans aucune photo n'apparaît que s'il n'y
  // a pas d'autre choix (jamais une tuile vide au milieu d'univers illustrés).
  const withProducts = context.categories.filter((c) => c.productCount > 0);
  const illustratedCategories = withProducts.filter((c) => c.hasVisual);
  const categories = (illustratedCategories.length >= 2 ? illustratedCategories : withProducts).slice(0, 6);

  const build = (slot: Slot): RawSection | null => {
    switch (slot.kind) {
      case "immersive_hero": {
        let variant = slot.variant;
        if (variant === "architectural" && !bigPhoto) variant = heroProduct ? "stage" : "centered";
        if (variant === "stage" && !heroProduct) variant = "centered";
        const subject = variant === "architectural" ? bigPhoto : heroProduct ? photo(nextPhoto(heroProduct)!) : null;
        return {
          id: slot.id,
          sectionKey: "immersive_hero",
          variant,
          params: {
            eyebrow: text(copy.heroEyebrow, "surtitre"),
            title: heroTitle,
            titleAccent: text(copy.heroTitleAccent, "titre (suite)"),
            subtitle: text(copy.heroSubtitle, "sous-titre"),
            primaryCtaLabel: cta,
            primaryCtaHref: "/catalogue",
            ...(heroProduct && variant !== "architectural" ? { secondaryCtaLabel: heroProduct.name.slice(0, 40), secondaryCtaHref: `/p/${heroProduct.slug}` } : {}),
            ...(subject ? { subjectImage: subject.url, subjectAlt: subject.alt, subjectStyle: "framed" } : {}),
            lighting: variant === "architectural" ? "none" : "halo",
            scrollEffect: "zoom",
            intensity,
          },
        };
      }
      case "classic_hero": {
        const wide = slot.variant === "fullbleed" ? bigPhoto : null;
        const product = wide ? undefined : nextPhoto(heroProduct);
        const media = wide ?? (product ? photo(product) : null);
        if (!media) return build({ ...slot, kind: "immersive_hero", variant: "centered" });
        if (slot.variant === "fullbleed" && !wide) notes.push("Pas de grande photo d'ambiance : l'ouverture plein cadre est remplacée par une ouverture texte + photo.");
        return {
          id: slot.id,
          sectionKey: "hero",
          variant: wide ? "fullbleed" : "split",
          params: {
            eyebrow: text(copy.heroEyebrow, "surtitre"),
            title: [heroTitle, text(copy.heroTitleAccent, "titre (suite)")].filter(Boolean).join(" "),
            subtitle: text(copy.heroSubtitle, "sous-titre"),
            media,
            ctaLabel: cta,
            ctaHref: "/catalogue",
          },
        };
      }
      case "catalog_search":
        return {
          id: slot.id,
          sectionKey: "catalog_search",
          variant: slot.variant,
          params: {
            eyebrow: text(copy.heroEyebrow, "surtitre"),
            title: heroTitle,
            subtitle: text(copy.heroSubtitle, "sous-titre"),
            searchPlaceholder: "Rechercher un produit",
            quickCategories: categories.map((c) => ({ label: c.name, href: `/catalogue?categorie=${encodeURIComponent(c.slug)}` })),
            ...(bigPhoto ? { media: bigPhoto } : {}),
          },
        };
      case "showcase": {
        if (featured.length < 3) {
          notes.push("Moins de 3 produits photographiés : la vitrine animée n'est pas proposée pour l'instant.");
          return null;
        }
        const variant = slot.variant === "arc" && !audit.canShowcase ? "depth" : slot.variant;
        return {
          id: slot.id,
          sectionKey: "immersive_showcase",
          variant,
          params: {
            eyebrow: text(copy.heroEyebrow, "surtitre de la vitrine"),
            title: text(copy.selectionTitle, "titre de la vitrine") ?? "La sélection",
            source: "products",
            productIds: featured.slice(0, 10).map((p) => p.id),
            displayCount: Math.max(3, Math.min(12, featured.length)),
            showPrice: true,
            ctaLabel: "Voir le produit",
            autoplay: direction.animation !== "discreet",
            imageStyle: "photo",
            backdrop: variant === "arc" ? "dark" : "tinted",
          },
        };
      }
      case "story": {
        const requested = direction.storySteps
          .map((s) => ({ step: s, product: byId.get(s.productId) }))
          .filter((s): s is { step: (typeof direction.storySteps)[number]; product: CatalogProduct } => Boolean(s.product?.imageUrl));
        const steps = (requested.length >= 2 ? requested : featured.slice(0, 3).map((product) => ({ step: { productId: product.id, title: "", body: "" }, product }))).slice(0, 4);
        if (steps.length < 2) {
          notes.push("Récit non créé : il faut au moins 2 produits photographiés.");
          return null;
        }
        steps.forEach((s) => used.add(s.product.id));
        return {
          id: slot.id,
          sectionKey: "scroll_story",
          variant: slot.variant,
          params: {
            eyebrow: "Dans le détail",
            title: text(copy.storyTitle, "titre du récit"),
            image: steps[0]!.product.imageUrl,
            imageAlt: steps[0]!.product.imageAlt ?? steps[0]!.product.name,
            objectStyle: "photo",
            steps: steps.map(({ step, product }, i) => ({
              eyebrow: product.category ?? undefined,
              title: text(step.title, `étape ${i + 1}`) ?? product.name.slice(0, 60),
              body: text(step.body, `texte de l'étape ${i + 1}`) ?? excerpt(product.description, 200),
              imageUrl: product.imageUrl,
              imageAlt: product.imageAlt ?? product.name,
              rotate: [-6, 5, -3, 0][i],
              objectScale: 1,
            })),
            ctaLabel: "Tout le catalogue",
            ctaHref: "/catalogue",
          },
        };
      }
      case "manifesto": {
        const product = nextPhoto();
        const media = libraryHero && !used.has(libraryHero.url) ? { url: libraryHero.url, alt: libraryHero.alt ?? context.tenantName } : product ? photo(product) : null;
        if (!manifesto || !media) return null;
        return { id: slot.id, sectionKey: "brand_manifesto", variant: slot.variant, params: { eyebrow: context.tenantName, statement: manifesto, body: manifestoBody, media } };
      }
      case "heritage": {
        const product = nextPhoto();
        if (!manifesto || !product) return null;
        // Sans texte long fourni, le titre reste le nom de l'entreprise et la phrase de
        // manifeste devient le texte : rien n'est inventé pour remplir la section.
        const [title, body] = manifestoBody ? [manifesto, manifestoBody] : [context.tenantName, manifesto];
        return { id: slot.id, sectionKey: "heritage", variant: slot.variant, params: { eyebrow: "La maison", title, body, media: photo(product), ctaLabel: "Voir les créations", ctaHref: "/catalogue" } };
      }
      case "signature": {
        if (!signatureProduct) return null;
        used.add(signatureProduct.id);
        return {
          id: slot.id,
          sectionKey: "signature_product",
          variant: slot.variant,
          params: {
            eyebrow: "Pièce signature",
            title: signatureProduct.name,
            description: excerpt(signatureProduct.description, 260),
            media: photo(signatureProduct),
            ctaLabel: "Découvrir la pièce",
            ctaHref: `/p/${signatureProduct.slug}`,
          },
        };
      }
      case "lookbook":
      case "gallery": {
        const images = uniqueProducts([...featured.filter((p) => !used.has(p.id)), ...featured]).slice(0, slot.kind === "gallery" ? 6 : 3);
        if (images.length < 3) {
          notes.push(`${slot.kind === "gallery" ? "Galerie" : "Lookbook"} non créé : il faut au moins 3 produits photographiés.`);
          return null;
        }
        images.forEach((p) => used.add(p.id));
        return {
          id: slot.id,
          sectionKey: slot.kind,
          variant: slot.variant,
          params: { title: text(copy.storyTitle, "titre") ?? (slot.kind === "gallery" ? "En images" : "Lookbook"), images: images.map((p) => photo(p)) },
        };
      }
      case "featured":
        if (!context.products.length) return null;
        return {
          id: slot.id,
          sectionKey: "featured_products",
          variant: slot.variant,
          params: { title: text(copy.selectionTitle, "titre de la sélection") ?? "La sélection", productIds: featured.slice(0, 10).map((p) => p.id), displayCount: featuredCount(slot.variant, featured.length) },
        };
      case "new_arrivals":
        if (context.products.length < 2) return null;
        return { id: slot.id, sectionKey: "new_arrivals", variant: slot.variant, params: { title: "Nouveautés", displayCount: slot.variant === "grid" ? gridCount(context.products.length) : Math.min(8, context.products.length) } };
      case "categories":
        if (!categories.length) return null;
        return { id: slot.id, sectionKey: "categories", variant: slot.variant, params: { title: "Nos univers", categoryIds: categories.map((c) => c.id), displayCount: categories.length } };
      case "closing": {
        const title = text(copy.closingTitle, "invitation finale");
        if (!title) return null;
        return { id: slot.id, sectionKey: "cta", variant: slot.variant, params: { title, description: text(copy.closingText, "texte de l'invitation"), buttonLabel: cta, buttonHref: "/catalogue" } };
      }
    }
  };

  const blocks: SectionInstance[] = [];
  for (const slot of slots) {
    const raw = build(slot);
    if (!raw) continue;
    try {
      blocks.push(validateSectionInstance({ ...raw, params: dropUndefined(raw.params), order: blocks.length, isEnabled: true }));
    } catch {
      notes.push(`Une section (${raw.sectionKey}) n'a pas pu être composée et a été écartée.`);
    }
  }
  return { blocks, identity, motion, notes };
}

/** Trois directions = trois archétypes : un doublon est réaffecté à un archétype libre. */
export function distinctArchetypes<T extends { archetype: ArchetypeKey }>(directions: T[]): T[] {
  const taken = new Set<ArchetypeKey>();
  return directions.map((d) => {
    if (!taken.has(d.archetype)) return taken.add(d.archetype), d;
    const free = ARCHETYPE_KEYS.find((k) => !taken.has(k))!;
    taken.add(free);
    return { ...d, archetype: free };
  });
}

/** Grille de 3 colonnes : des rangées complètes (3 ou 6). */
function gridCount(available: number): number {
  return available >= 6 ? 6 : available >= 3 ? 3 : available;
}

/** Mosaïques : groupes complets de 5 (une grande pièce + quatre) ; grille : jusqu'à 8. */
function featuredCount(variant: string, available: number): number {
  if (variant === "grid" || variant === "carousel") return Math.max(1, Math.min(8, available));
  return available >= 10 ? 10 : available >= 5 ? 5 : Math.max(1, available);
}

function photo(product: CatalogProduct): { url: string; alt: string } {
  return { url: product.imageUrl!, alt: product.imageAlt ?? product.name };
}

function uniqueProducts(list: CatalogProduct[]): CatalogProduct[] {
  return [...new Map(list.map((p) => [p.id, p])).values()];
}

export function newestFirst(products: CatalogProduct[]): CatalogProduct[] {
  return [...products].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function dropUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}
