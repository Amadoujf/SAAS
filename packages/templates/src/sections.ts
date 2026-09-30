import { z } from "zod";
import { animationLevelSchema } from "@yamacommerce/design-tokens";

/**
 * Catalogue des sections réutilisables — voir docs/09-plan-developpement.md, Phase 1,
 * et la demande de validation du 13 septembre 2026 (« moteur de sections »).
 *
 * Ce module définit CE QU'EST une section (clé, variantes visuelles, schéma de
 * paramètres) — le rendu React réel (comment une section s'affiche) est le sujet de
 * l'étape suivante (« moteur de rendu des templates »), volontairement pas construit
 * ici pour respecter l'ordre demandé.
 */

export const SECTION_KEYS = [
  "hero",
  "categories",
  "featured_products",
  "new_arrivals",
  "promotions",
  "benefits",
  "testimonials",
  "brands",
  "gallery",
  "video",
  "newsletter",
  "faq",
  "cta",
  "contact",
  "whatsapp",
  "custom_content",
  "brand_manifesto",
  "signature_product",
  "heritage",
  "lookbook",
  "designers",
  "provenance",
  "catalog_search",
  "immersive_hero",
  "immersive_showcase",
  "scroll_story",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export function isSectionKey(value: string): value is SectionKey {
  return (SECTION_KEYS as readonly string[]).includes(value);
}


/**
 * Référence d'image des sections immersives : URL absolue https (médiathèque servie par
 * un autre hôte, CDN) OU chemin interne de l'application (« /api/media/… »,
 * « /demo-templates/… »). Jamais `javascript:`, jamais `//hôte` (URL protocole-relative
 * qui sortirait du site), jamais un autre schéma.
 */
const imageRefSchema = z
  .string()
  .trim()
  .max(500)
  .refine((v) => (v.startsWith("/") && !v.startsWith("//")) || /^https?:\/\/[^\s]+$/.test(v), "Image invalide : choisissez-la dans la médiathèque.");

/** Média d'une section : adresse https OU chemin interne (médiathèque de l'entreprise,
 *  « /api/media/… ») — mêmes règles que les sections immersives. */
const mediaSchema = z.object({ url: imageRefSchema, alt: z.string().optional() });

/** Lien d'un bouton : chemin interne (« /catalogue ») ou adresse https. */
/** Lien libre d'une section : chemin interne, ancre, https, téléphone ou e-mail —
 *  jamais `javascript:`, `data:`, `http:`, `//hôte` ni caractères de contrôle. Le
 *  serveur vérifie EN PLUS les zones privées et les sites d'autres entreprises. */
const linkHrefSchema = z
  .string()
  .trim()
  .max(300)
  .refine(
    (v) =>
      v === "" ||
      (!/[\u0000-\u001f\u007f\\]/.test(v) &&
        (/^tel:\+?[\d ().-]{3,30}$/i.test(v) ||
          (!/\s/.test(v) && (/^#[\w-]*$/.test(v) || (v.startsWith("/") && !v.startsWith("//")) || /^https:\/\/[a-z0-9.-]+(:\d+)?(\/\S*)?$/i.test(v) || /^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/i.test(v))))),
    "Lien invalide : chemin de votre site, adresse https, téléphone ou e-mail.",
  );

const actionHrefSchema = z
  .string()
  .trim()
  .max(300)
  .refine((v) => (v.startsWith("/") && !v.startsWith("//")) || /^https:\/\/[^\s]+$/.test(v), "Lien invalide : chemin commençant par « / » ou adresse https.");

/** Point focal d'une image (en %) : ce qui reste visible quand l'image est recadrée. */
const focalSchema = z.number().min(0).max(100);

/** Schéma de paramètres propre à chaque section — validé à la création/modification
 *  d'une instance de section dans un template, jamais laissé libre. */
export const sectionParamSchemas = {
  hero: z.object({
    eyebrow: z.string().optional(),
    title: z.string().min(1),
    subtitle: z.string().optional(),
    media: mediaSchema,
    ctaLabel: z.string().optional(),
    ctaHref: linkHrefSchema.optional(),
    /** Bouton secondaire (variante plein cadre) — absent = aucun bouton secondaire. */
    secondaryCtaLabel: z.string().max(40).optional(),
    secondaryCtaHref: z
      .string()
      .trim()
      .max(300)
      .refine((v) => /^#[\w-]+$/.test(v) || (v.startsWith("/") && !v.startsWith("//")) || /^https:\/\/[^\s]+$/.test(v), "Lien invalide.")
      .optional(),
  }),
  categories: z.object({
    title: z.string().optional(),
    categoryIds: z.array(z.string()).min(1),
    displayCount: z.number().int().min(1).max(12).default(6),
  }),
  featured_products: z.object({
    title: z.string().optional(),
    productIds: z.array(z.string()).optional(), // vide = sélection automatique (top ventes)
    displayCount: z.number().int().min(1).max(24).default(8),
  }),
  new_arrivals: z.object({
    title: z.string().optional(),
    displayCount: z.number().int().min(1).max(24).default(8),
  }),
  promotions: z.object({
    title: z.string().optional(),
    promoCodeIds: z.array(z.string()).optional(),
    media: mediaSchema.optional(),
  }),
  benefits: z.object({
    items: z
      .array(z.object({ icon: z.string(), title: z.string(), description: z.string().optional() }))
      .min(1)
      .max(6),
  }),
  testimonials: z.object({
    items: z
      .array(
        z.object({
          author: z.string(),
          quote: z.string(),
          avatarUrl: z.string().optional(),
          rating: z.number().min(1).max(5).optional(),
          /** Nom du produit acheté — variante "editorial" (voir la refonte du 16
           *  septembre 2026, « produit acheté »). */
          productPurchased: z.string().optional(),
        }),
      )
      .min(1),
  }),
  brands: z.object({
    logos: z.array(mediaSchema).min(1),
  }),
  gallery: z.object({
    title: z.string().optional(),
    images: z.array(mediaSchema).min(1),
  }),
  video: z.object({
    title: z.string().optional(),
    videoUrl: z.string().url(),
    posterUrl: z.string().optional(),
  }),
  newsletter: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
  }),
  faq: z.object({
    items: z.array(z.object({ question: z.string(), answer: z.string() })).min(1),
  }),
  cta: z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    buttonLabel: z.string(),
    buttonHref: linkHrefSchema,
  }),
  contact: z.object({
    address: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    showMap: z.boolean().default(false),
  }),
  whatsapp: z.object({
    phoneNumber: z.string(),
    defaultMessage: z.string().optional(),
  }),
  // Contenu libre : le HTML est assaini côté moteur de rendu (étape suivante), jamais
  // injecté tel quel — ce schéma ne fait que garantir la présence d'une chaîne.
  custom_content: z.object({
    html: z.string(),
  }),
  // Quatre sections ajoutées pour la refonte artistique du 16 septembre 2026 (« luxe
  // africain contemporain ») — voir docs/12 : manifeste de marque, produit signature
  // (mise en scène immersive d'une pièce phare), savoir-faire/héritage, lookbook.
  brand_manifesto: z.object({
    eyebrow: z.string().optional(),
    statement: z.string().min(1),
    body: z.string().optional(),
    media: mediaSchema,
  }),
  signature_product: z.object({
    eyebrow: z.string().optional(),
    collectionNumber: z.string().optional(),
    title: z.string().min(1),
    description: z.string().optional(),
    media: mediaSchema,
    detailMedia: mediaSchema.optional(),
    ctaLabel: z.string().optional(),
    ctaHref: linkHrefSchema.optional(),
    /** Mécaniques « édition limitée » — voir Teranga Atelier (template 4, 20
     *  septembre 2026) : nombre de pièces encore disponibles et/ou précommande. Ces
     *  deux champs restent optionnels pour ne rien changer au comportement existant
     *  (Luxe minimaliste, Marketplace, Commerce moderne) qui ne les utilisent pas. */
    piecesRemaining: z.number().int().min(0).optional(),
    isPreorder: z.boolean().optional(),
    preorderReleaseDate: z.string().optional(),
  }),
  heritage: z.object({
    eyebrow: z.string().optional(),
    title: z.string().min(1),
    body: z.string().min(1),
    media: mediaSchema,
    stats: z
      .array(z.object({ value: z.string(), label: z.string() }))
      .max(4)
      .optional(),
    ctaLabel: z.string().optional(),
    ctaHref: linkHrefSchema.optional(),
  }),
  lookbook: z.object({
    title: z.string().optional(),
    images: z
      .array(
        z.object({
          url: imageRefSchema,
          alt: z.string().optional(),
          hotspots: z
            .array(
              z.object({
                x: z.number().min(0).max(100),
                y: z.number().min(0).max(100),
                productId: z.string(),
              }),
            )
            .optional(),
        }),
      )
      .min(1),
  }),
  // Deux sections ajoutées pour le template « Boutique africaine contemporaine »
  // (Teranga Atelier, 20 septembre 2026) : créateurs en vedette (avec fiche dédiée par
  // créateur) et provenance/carte des régions de fabrication.
  designers: z.object({
    title: z.string().optional(),
    designerIds: z.array(z.string()).min(1),
  }),
  provenance: z.object({
    title: z.string().optional(),
    intro: z.string().optional(),
    regions: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          craft: z.string(),
          description: z.string(),
          media: mediaSchema,
          /** Position en pourcentage sur l'illustration de carte — même mécanique que
           *  les hotspots du lookbook. */
          x: z.number().min(0).max(100),
          y: z.number().min(0).max(100),
        }),
      )
      .min(1),
  }),
  // Section ajoutée pour « Grossiste et revendeur professionnel » (Dakar Distribution
  // Pro, template 5, 20 septembre 2026) : remplace le hero cinématographique par une
  // recherche de produits très visible + raccourcis de catégories professionnelles —
  // voir l'exigence explicite « recherche de produits très visible » en première
  // position de la page d'accueil B2B.
  catalog_search: z.object({
    eyebrow: z.string().optional(),
    title: z.string().min(1),
    subtitle: z.string().optional(),
    searchPlaceholder: z.string().optional(),
    quickCategories: z
      .array(z.object({ label: z.string(), href: linkHrefSchema }))
      .max(8)
      .optional(),
    stats: z
      .array(z.object({ value: z.string(), label: z.string() }))
      .max(4)
      .optional(),
    media: mediaSchema.optional(),
  }),
  // ---------------------------------------------------------------------------
  // Sections immersives (octobre 2026) — mise en scène interactive commune à tous les
  // secteurs : chaque entreprise les remplit avec SES contenus (aucun produit, prix,
  // nom ou visuel imposé). Voir docs/12 §12.8.
  // ---------------------------------------------------------------------------
  /** Hero immersif : sujet principal de grande taille, typographie expressive, scène
   *  éventuellement COMPOSÉE d'éléments détourés séparés (`layers`) qui s'assemblent ou
   *  se séparent au défilement. Une photo plate reste possible (sans effet d'assemblage). */
  immersive_hero: z.object({
    eyebrow: z.string().trim().max(80).optional(),
    title: z.string().trim().min(1).max(120),
    titleAccent: z.string().trim().max(60).optional(),
    subtitle: z.string().trim().max(280).optional(),
    primaryCtaLabel: z.string().trim().max(40).optional(),
    primaryCtaHref: actionHrefSchema.optional(),
    secondaryCtaLabel: z.string().trim().max(40).optional(),
    secondaryCtaHref: actionHrefSchema.optional(),
    subjectImage: imageRefSchema.optional(),
    subjectAlt: z.string().trim().max(160).optional(),
    /** « cutout » : image détourée (PNG/WebP transparent) posée dans la scène ;
     *  « framed » : photographie classique présentée dans un cadre — jamais une photo
     *  à fond plein déguisée en objet flottant. */
    subjectStyle: z.enum(["cutout", "framed"]).default("cutout"),
    focalX: focalSchema.default(50),
    focalY: focalSchema.default(50),
    layers: z
      .array(
        z.object({
          imageUrl: imageRefSchema,
          alt: z.string().trim().max(120).optional(),
          depth: z.number().min(0).max(1).default(0.5),
          offsetX: z.number().min(-50).max(50).default(0),
          offsetY: z.number().min(-50).max(50).default(0),
          scale: z.number().min(0.1).max(2).default(1),
          rotate: z.number().min(-45).max(45).default(0),
          arriveFrom: z.enum(["top", "bottom", "left", "right", "none"]).default("top"),
        }),
      )
      .max(6)
      .default([]),
    mobileImage: imageRefSchema.optional(),
    backgroundColor: z.string().trim().max(40).optional(),
    backgroundImage: imageRefSchema.optional(),
    lighting: z.enum(["halo", "spotlight", "ambient", "none"]).default("halo"),
    scrollEffect: z.enum(["assemble", "separate", "parallax", "zoom", "none"]).default("parallax"),
    floating: z.boolean().default(true),
    intensity: z.enum(["subtle", "balanced", "bold"]).default("balanced"),
  }),
  /** Carrousel immersif : élément central mis en avant, voisins en profondeur ; visuel,
   *  titre, prix éventuel et arrière-plan changent ensemble. Source au choix : produits
   *  du catalogue, fiches (biens, offres…) ou contenus saisis à la main. */
  immersive_showcase: z.object({
    eyebrow: z.string().trim().max(80).optional(),
    title: z.string().trim().max(120).optional(),
    subtitle: z.string().trim().max(220).optional(),
    source: z.enum(["products", "listings", "manual"]).default("products"),
    productIds: z.array(z.string()).max(12).optional(),
    listingIds: z.array(z.string()).max(12).optional(),
    items: z
      .array(
        z.object({
          title: z.string().trim().min(1).max(90),
          subtitle: z.string().trim().max(160).optional(),
          imageUrl: imageRefSchema,
          imageAlt: z.string().trim().max(140).optional(),
          href: actionHrefSchema.optional(),
          badge: z.string().trim().max(30).optional(),
          accentColor: z.string().trim().max(40).optional(),
        }),
      )
      .max(12)
      .default([]),
    displayCount: z.number().int().min(3).max(12).default(6),
    showPrice: z.boolean().default(true),
    ctaLabel: z.string().trim().max(30).default("Découvrir"),
    autoplay: z.boolean().default(true),
    intervalSeconds: z.number().int().min(3).max(15).default(6),
    backdrop: z.enum(["tinted", "neutral", "dark"]).default("tinted"),
    /** « photo » : visuel dans un cadre arrondi (photo avec fond) ; « cutout » : objet
     *  détouré posé sur la scène, sans cadre — à réserver aux visuels à fond transparent. */
    imageStyle: z.enum(["photo", "cutout"]).default("photo"),
    /** Habillage PAR ÉLÉMENT d'un produit ou d'une fiche réels (source products/listings) :
     *  visuel détouré propre au carrousel et couleur d'ambiance. Le titre, le prix et le
     *  lien restent ceux de l'enregistrement — jamais modifiables ici. */
    overrides: z
      .array(
        z.object({
          recordId: z.string().trim().min(1).max(64),
          imageUrl: imageRefSchema.optional(),
          imageAlt: z.string().trim().max(140).optional(),
          accentColor: z.string().trim().max(40).optional(),
        }),
      )
      .max(12)
      .default([]),
  }),
  /** Récit au défilement : grande image (ou une image par étape) accompagnée de messages
   *  successifs — caractéristiques, matières, pièces d'un logement, étapes d'une
   *  expérience. Défilement naturel : jamais de blocage ni d'animation interminable. */
  scroll_story: z.object({
    eyebrow: z.string().trim().max(80).optional(),
    title: z.string().trim().max(120).optional(),
    intro: z.string().trim().max(400).optional(),
    image: imageRefSchema.optional(),
    imageAlt: z.string().trim().max(160).optional(),
    steps: z
      .array(
        z.object({
          eyebrow: z.string().trim().max(60).optional(),
          title: z.string().trim().min(1).max(90),
          body: z.string().trim().max(400).optional(),
          imageUrl: imageRefSchema.optional(),
          imageAlt: z.string().trim().max(140).optional(),
          focusX: focalSchema.default(50),
          focusY: focalSchema.default(50),
          zoom: z.number().min(1).max(2.5).default(1),
          /** Variante « product » : couleur d'ambiance de l'étape et pose de l'objet. */
          accentColor: z.string().trim().max(40).optional(),
          rotate: z.number().min(-35).max(35).default(0),
          objectScale: z.number().min(0.6).max(1.4).default(1),
        }),
      )
      .min(1)
      .max(8),
    ctaLabel: z.string().trim().max(40).optional(),
    ctaHref: actionHrefSchema.optional(),
    backgroundColor: z.string().trim().max(40).optional(),
    /** Variante « product » : « photo » (défaut sûr) = photographie classique dans un
     *  cadre, inclinaison légère ; « cutout » = objet détouré posé librement. */
    objectStyle: z.enum(["photo", "cutout"]).default("photo"),
  }),
} as const satisfies Record<SectionKey, z.ZodTypeAny>;

/** Variantes visuelles disponibles par section — voir docs/12 (« plusieurs variantes
 *  visuelles »). Le moteur de rendu (étape suivante) fournira un composant par variante. */
export const sectionVariants: Record<SectionKey, readonly string[]> = {
  hero: ["fullbleed", "split", "centered"],
  // "editorial" : grands blocs plein cadre asymétriques (voir la refonte artistique du
  // 16 septembre 2026) — remplace l'affichage en petites cartes pour les univers de
  // catégories (« aucun affichage sous forme de petites cartes ordinaires »).
  categories: ["grid", "carousel", "editorial"],
  featured_products: ["grid", "carousel", "masonry", "editorial"],
  new_arrivals: ["grid", "carousel"],
  promotions: ["banner", "split"],
  benefits: ["icons-row", "cards"],
  // "editorial" : portrait client + grande citation + produit acheté, mise en page
  // horizontale plus émotionnelle qu'une simple grille de cartes.
  testimonials: ["carousel", "grid", "editorial"],
  brands: ["marquee", "grid"],
  gallery: ["grid", "masonry", "carousel"],
  video: ["fullwidth", "framed"],
  newsletter: ["inline", "banner"],
  faq: ["accordion", "two-column"],
  cta: ["banner", "split"],
  contact: ["split", "centered"],
  whatsapp: ["floating-button", "inline-banner"],
  custom_content: ["default"],
  brand_manifesto: ["image-left", "image-right"],
  signature_product: ["dark", "leather"],
  heritage: ["image-left", "image-right"],
  lookbook: ["mosaic", "fullscreen"],
  designers: ["grid", "carousel"],
  provenance: ["map", "list"],
  catalog_search: ["hero", "compact"],
  // « stage » : sujet sculptural à droite (commerce, mode, restauration, automobile) ;
  // « centered » : sujet central sous le titre (produit signature, plat) ;
  // « architectural » : grande photographie plein cadre révélée (immobilier,
  // hôtellerie, voyage).
  immersive_hero: ["stage", "centered", "architectural"],
  // « depth » : élément central et voisins en perspective ; « stack » : cartes empilées.
  // « arc » : objets posés en arc de cercle, l'élément central sur un socle lumineux,
  // l'ambiance prenant la couleur de l'élément central.
  immersive_showcase: ["depth", "stack", "arc"],
  // « focus » : une image, cadrage qui glisse de détail en détail (matières, pièces) ;
  // « sequence » : une image par étape en fondu ; « timeline » : étapes jalonnées
  // (itinéraire, parcours de formation, suivi de livraison) ; « product » : un objet
  // détouré mis en scène, qui pivote d'étape en étape sur une ambiance colorée.
  scroll_story: ["focus", "sequence", "timeline", "product"],
};

export function isValidVariant(sectionKey: SectionKey, variant: string): boolean {
  return sectionVariants[sectionKey].includes(variant);
}

export function validateSectionParams(sectionKey: SectionKey, params: unknown): unknown {
  return sectionParamSchemas[sectionKey].parse(params);
}

/**
 * Une instance de section au sein d'une page de template : référence le type de
 * section, sa variante, ses paramètres (validés séparément via
 * `validateSectionParams`, le schéma ici reste `unknown` car il dépend de
 * `sectionKey`), son ordre, son état d'activation et un éventuel override d'animation
 * — voir « chaque section doit avoir ... un état désactivé, un ordre d'affichage ».
 */
/**
 * Surcharge de style PAR SECTION — voir docs/12 §12.2 (panneau « Style ») et la demande
 * du 20 septembre 2026. Chaque champ correspond EXACTEMENT à une variable CSS déjà
 * posée par `designTokensToCssVariables()` (voir apps/web/lib/design-tokens-to-css.ts) :
 * appliquer cette surcharge revient à re-déclarer ces variables sur un conteneur
 * enveloppant CETTE section — aucun composant de section n'a besoin d'être modifié
 * pour en tenir compte, puisqu'ils consomment déjà tous `var(--color-*)`,
 * `var(--text-*)`, `var(--card-radius)`, etc. plutôt que des valeurs codées en dur.
 * `headingSize`/`bodySize`/`radius`/`shadow` référencent une clé de l'échelle de
 * tokens (résolue au rendu, jamais une valeur figée) — si les tokens du site changent
 * plus tard, la surcharge reste cohérente avec la nouvelle échelle.
 */
export const sectionStyleOverrideSchema = z.object({
  colorPrimary: z.string().min(1).optional(),
  colorSecondary: z.string().min(1).optional(),
  colorBackground: z.string().min(1).optional(),
  colorTextPrimary: z.string().min(1).optional(),
  colorTextSecondary: z.string().min(1).optional(),
  headingFont: z.string().min(1).optional(),
  bodyFont: z.string().min(1).optional(),
  headingSize: z.enum(["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl"]).optional(),
  bodySize: z.enum(["xs", "sm", "md", "lg", "xl"]).optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  borderColor: z.string().min(1).optional(),
  borderWidth: z.string().min(1).optional(),
  radius: z.enum(["none", "sm", "md", "lg", "full"]).optional(),
  shadow: z.enum(["none", "sm", "md", "lg"]).optional(),
  /** Largeur de la colonne de contenu de cette section — ex. "960px". */
  maxWidth: z.string().min(1).optional(),
});
export type SectionStyleOverride = z.infer<typeof sectionStyleOverrideSchema>;

export const spacingValuesSchema = z.object({
  marginTop: z.string().min(1).optional(),
  marginBottom: z.string().min(1).optional(),
  paddingX: z.string().min(1).optional(),
  paddingY: z.string().min(1).optional(),
});
export type SectionSpacingValues = z.infer<typeof spacingValuesSchema>;

/**
 * Surcharge d'espacement PAR SECTION, avec réglages distincts par point de rupture
 * (docs/12 §12.2, panneau « Espacement »). Ajoute de l'espace AUTOUR de la section
 * (marge/espacement interne) sans modifier le rythme interne déjà calibré par le
 * template — voir le rapport de livraison pour la limite assumée sur l'espacement
 * ENTRE les éléments internes d'une section (pas couvert par ce champ).
 */
export const sectionSpacingOverrideSchema = z.object({
  desktop: spacingValuesSchema.optional(),
  tablet: spacingValuesSchema.optional(),
  mobile: spacingValuesSchema.optional(),
});
export type SectionSpacingOverride = z.infer<typeof sectionSpacingOverrideSchema>;

/**
 * Détail d'animation PAR SECTION, au-delà du simple niveau (docs/12 §12.2, panneau
 * « Animation »). `hoverEffect` s'applique au conteneur de la section dans son
 * ensemble (pas aux survols déjà propres à certains éléments internes, ex. une carte
 * produit) — voir le rapport de livraison.
 */
export const sectionAnimationDetailSchema = z.object({
  type: z.enum(["fade", "slide", "scale"]).optional(),
  direction: z.enum(["up", "down", "left", "right"]).optional(),
  durationMs: z.number().int().min(0).max(3000).optional(),
  delayMs: z.number().int().min(0).max(3000).optional(),
  hoverEffect: z.enum(["none", "lift", "zoom", "glow"]).optional(),
});
export type SectionAnimationDetail = z.infer<typeof sectionAnimationDetailSchema>;

export const sectionInstanceSchema = z.object({
  id: z.string(),
  sectionKey: z.enum(SECTION_KEYS),
  variant: z.string(),
  params: z.record(z.unknown()),
  order: z.number().int(),
  isEnabled: z.boolean().default(true),
  /** "inherit" = suit le niveau d'animation du site ; sinon override ponctuel. */
  animationOverride: z
    .union([z.literal("inherit"), z.literal("none"), animationLevelSchema])
    .default("inherit"),
  /** Variante spécifique pour l'affichage mobile — absente = même variante que desktop. */
  mobileVariant: z.string().optional(),
  /** Panneaux avancés de personnalisation (20 septembre 2026) — tous optionnels,
   *  absents = comportement hérité du template, identique à avant leur ajout. */
  styleOverride: sectionStyleOverrideSchema.optional(),
  spacingOverride: sectionSpacingOverrideSchema.optional(),
  animationDetail: sectionAnimationDetailSchema.optional(),
});

export type SectionInstance = z.infer<typeof sectionInstanceSchema>;

/**
 * Valide une instance de section de bout en bout : clé connue, variante compatible
 * avec cette clé, et paramètres conformes au schéma de cette section.
 */
export function validateSectionInstance(raw: unknown): SectionInstance {
  const instance = sectionInstanceSchema.parse(raw);
  if (!isValidVariant(instance.sectionKey, instance.variant)) {
    throw new Error(
      `Variante "${instance.variant}" invalide pour la section "${instance.sectionKey}". ` +
        `Variantes disponibles : ${sectionVariants[instance.sectionKey].join(", ")}.`,
    );
  }
  validateSectionParams(instance.sectionKey, instance.params);
  return instance;
}
