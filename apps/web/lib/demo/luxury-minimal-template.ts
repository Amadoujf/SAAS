import type { DesignTokens } from "@yamacommerce/design-tokens";
import { validateTemplateManifest, type TemplateManifest } from "@yamacommerce/templates";
import type {
  ResolvedCategoriesContent,
  ResolvedProductsContent,
  ResolvedPromotionsContent,
} from "@/components/sections/content-types";
import type { ResolvedContentBySectionId } from "@/components/sections/section-renderer";
import type { CartLine } from "@/lib/commerce/cart-context";
import type { NavItem } from "@/components/layout/mega-menu-nav";
import type { SearchSuggestion } from "@/components/layout/search-overlay";
import type { ProductDetailData } from "@/components/product/product-detail";

/**
 * Données de démonstration du template « Luxe minimaliste » — voir la demande de
 * validation du 13 septembre 2026 (« premier rendu visuel ») et la refonte visuelle du
 * 16 septembre 2026 (images incohérentes avec le commerce, manque d'impact desktop,
 * design pas assez sophistiqué). Statiques et autoporteuses (aucune base de données
 * requise) pour permettre de vérifier le moteur de rendu de bout en bout dans
 * n'importe quel environnement.
 *
 * Direction artistique : proche de « Mode premium » (docs/12 §12.5) — noir/blanc
 * strict, serif éditoriale, grandes photos, très peu de couleur hors l'accent doré.
 *
 * Photographie : Unsplash (CDN `images.unsplash.com`, déjà whitelisté dans
 * `next.config.mjs`), sélectionnée le 16 septembre 2026 pour sa cohérence avec le
 * commerce réel (maroquinerie/bijoux/prêt-à-porter) et sa direction éditoriale commune
 * (tons neutres, lumière douce, aucune marque tierce visible). Piste d'amélioration
 * (Phase 2+) : remplacer par de vraies photos de produits une fois le tenant onboardé.
 */

function unsplash(photoId: string, { w = 1600, h }: { w?: number; h?: number } = {}): string {
  const params = new URLSearchParams({ q: "80", fm: "jpg", fit: "crop", w: String(w) });
  if (h) params.set("h", String(h));
  return `https://images.unsplash.com/${photoId}?${params.toString()}`;
}

const PHOTO = {
  heroModelTrench: "photo-1779153249431-f740efb53c0b",
  editorialPlaidCoatBag: "photo-1602082430164-0c1927ddecb2",
  bagTote: "photo-1624687943971-e86af76d57de",
  bagBucket: "photo-1760624294469-550753ec203a",
  bagClutch: "photo-1657603764636-8d31e033d591",
  bagWovenChain: "photo-1598532163257-ae3c6b2524b6",
  shoeLoafer: "photo-1533867617858-e7b97e060509",
  shoeOxford: "photo-1668069226492-508742b03147",
  jewelryRings: "photo-1786835568011-5a38943abf73",
  jewelryPendant: "photo-1783541507490-edb026e2a961",
  belt: "photo-1624222247344-550fb60583dc",
  wallet: "photo-1606503825008-909a67e63c3d",
  coatCamel: "photo-1550872199-63f4382fe925",
  craftHands: "photo-1787005241178-c9006ea9610b",
  textureGrain: "photo-1716295177956-420a647c83ac",
  // Portraits (témoignages) et architecture (manifeste/héritage) — recherche
  // complémentaire du 16 septembre 2026. Aucune de ces photos d'architecture n'est
  // spécifiquement identifiée comme dakaroise (aucune n'a été trouvée sous licence
  // libre) : elles sont légendées honnêtement comme « inspirées de l'Afrique de
  // l'Ouest », jamais présentées comme un lieu réel précis.
  craftsmanPortrait: "photo-1775127730710-46450adcf73e",
  portraitWoman1: "photo-1569925444984-9e2e5fc3d1fb",
  portraitMan1: "photo-1605602517387-ec78b947335e",
  portraitWoman2: "photo-1494790108377-be9c29b29330",
  archMinimal: "photo-1517574394752-94986fc2c084",
} as const;

export const LUXURY_MINIMAL_DESIGN_TOKENS: DesignTokens = {
  // Palette « luxe africain contemporain » (refonte du 16 septembre 2026) : noir
  // profond, ivoire chaleureux, beige sable, doré très subtil — plus aucun blanc pur
  // ni noir pur, qui donnaient l'impression d'un gabarit e-commerce générique. Suite à
  // la revue du même jour (point 1), le brun cuir et le champagne sont désormais de
  // VRAIS tokens (`leather`, `champagne`, voir packages/design-tokens/src/schema.ts)
  // et non plus des couleurs codées dans les composants.
  colors: {
    primary: "#15100C",
    secondary: "#A8823F",
    background: "#F8F2E8",
    surface: "#F0E6D4",
    surfaceMuted: "#E7D9BE",
    textPrimary: "#1B140F",
    textSecondary: "#5B4A38",
    textMuted: "#8C7B63",
    border: "#DECBA9",
    success: "#3C6E44",
    danger: "#9B3B2E",
    warning: "#8F6A2C",
    accentPrimary: "#A8823F",
    accentSecondary: "#7C5A2E",
    leather: "#3E2A1E",
    champagne: "#C9AE7B",
    overlay: "rgba(21, 16, 12, 0.55)",
    mutedSurface: "#1C140F",
  },
  typography: {
    // Piles de polices SYSTÈME (aucun téléchargement réseau) : une élégante serif
    // éditoriale pour les titres, une sans-serif claire pour le texte — cohérent avec
    // la direction « Mode premium » (docs/12 §12.5) sans dépendre de Google Fonts.
    // Piste d'amélioration (Phase 1, étape 6) : polices variables auto-hébergées via
    // `next/font/local` une fois les fichiers de police du projet fournis.
    headingFont: "Georgia, 'Iowan Old Style', 'Palatino Linotype', Palatino, serif",
    bodyFont:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    // Échelle FLUIDE (clamp()) plutôt que des valeurs fixes : la refonte du 16
    // septembre 2026 demandait plus d'impact desktop SANS perdre le rendu mobile déjà
    // validé — le schéma de tokens n'exige qu'une chaîne CSS valide (voir
    // packages/design-tokens/src/schema.ts), `clamp()` y est donc une valeur légitime.
    headingSizes: {
      xs: "1.25rem",
      sm: "1.75rem",
      md: "clamp(1.875rem, 1.6rem + 1vw, 2.5rem)",
      lg: "clamp(2.25rem, 1.8rem + 1.8vw, 3.5rem)",
      xl: "clamp(2.75rem, 2rem + 3vw, 4.5rem)",
      "2xl": "clamp(3rem, 2rem + 4vw, 5.5rem)",
      "3xl": "clamp(3.5rem, 2rem + 6vw, 7rem)",
      "4xl": "clamp(3.75rem, 1.5rem + 9vw, 8.5rem)",
    },
    bodySizes: {
      xs: "0.8125rem",
      sm: "1rem",
      md: "1.125rem",
      lg: "clamp(1.25rem, 1.1rem + 0.6vw, 1.5rem)",
      xl: "clamp(1.375rem, 1.1rem + 1.2vw, 1.875rem)",
    },
  },
  spacing: { scale: ["0px", "4px", "8px", "12px", "16px", "24px", "32px", "48px", "64px", "96px"] },
  borders: { width: "1px", color: "#E7E5E1" },
  radii: { sm: "1px", md: "3px", lg: "6px", full: "9999px" },
  shadows: {
    sm: "0 1px 2px rgba(17,17,17,0.05)",
    md: "0 8px 24px rgba(17,17,17,0.08)",
    lg: "0 32px 80px rgba(17,17,17,0.16)",
  },
  // Largeur élargie (1320px → 1680px) : la version précédente laissait trop de vide de
  // part et d'autre sur grand écran (retour du 16 septembre 2026, « la page utilise mal
  // la largeur disponible »).
  layout: { contentMaxWidth: "1680px" },
  buttonStyle: { shape: "square", size: "lg", variant: "solid" },
  cardStyle: { radius: "sm", shadow: "sm", border: true },
  headerStyle: { variant: "transparent-on-hero", height: "104px" },
  footerStyle: { variant: "expanded" },
  formStyle: { inputRadius: "sm", inputBorderStyle: "underline" },
  animation: {
    // "dynamic" plutôt que "immersive" : retour du 16 septembre 2026 — animations
    // « visibles mais discrètes/fluides », l'élégance prime sur l'effet spectaculaire.
    level: "dynamic",
    durations: { fast: 180, base: 420, slow: 720 },
    easing: {
      standard: "cubic-bezier(0.4, 0, 0.2, 1)",
      decelerate: "cubic-bezier(0, 0, 0.2, 1)",
      accelerate: "cubic-bezier(0.4, 0, 1, 1)",
    },
  },
};

export const SHOP_NAME = "Maison Almadies";
export const SHOP_TAGLINE = {
  fr: "Maroquinerie et bijoux pensés et façonnés à Dakar, pour celles et ceux qui aiment ce qui dure.",
  en: "Leather goods and jewelry designed and crafted in Dakar, for those who value things made to last.",
};

const RAW_DEMO_MANIFEST = {
  pages: [
    {
      slug: "accueil",
      title: "Accueil",
      isHome: true,
      sections: [
        {
          id: "hero-1",
          sectionKey: "hero",
          variant: "fullbleed",
          order: 0,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            eyebrow: "Collection Harmattan",
            title: "L'élégance sénégalaise, sans compromis",
            subtitle:
              "Maroquinerie, bijoux et prêt-à-porter façonnés à Dakar, pensés pour durer une vie.",
            media: {
              url: unsplash(PHOTO.heroModelTrench, { w: 2400 }),
              alt: "Modèle portant un trench en cuir noir Maison Almadies",
            },
            ctaLabel: "Découvrir la collection",
            ctaHref: "/catalogue",
          },
        },
        {
          id: "manifesto-1",
          sectionKey: "brand_manifesto",
          variant: "image-right",
          order: 1,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            eyebrow: "Notre manifeste",
            statement: "Le luxe ne se proclame pas, il se façonne, un geste à la fois.",
            body: "À Dakar, nos artisans perpétuent un savoir-faire transmis de génération en génération. Chaque pièce Maison Almadies porte cette exigence : des matières choisies avec soin, un geste précis, une durabilité pensée pour traverser les années.",
            media: {
              url: unsplash(PHOTO.archMinimal, { w: 1600 }),
              alt: "Architecture minimaliste inspirée de l'Afrique de l'Ouest",
            },
          },
        },
        {
          id: "categories-1",
          sectionKey: "categories",
          variant: "editorial",
          order: 2,
          isEnabled: true,
          animationOverride: "inherit",
          params: { categoryIds: ["maroquinerie", "pret-a-porter", "bijoux", "accessoires"] },
        },
        {
          id: "featured-1",
          sectionKey: "featured_products",
          variant: "editorial",
          order: 3,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            productIds: [
              "sac-cabas-cuir",
              "mocassins-cuir",
              "collier-or-filigrane",
              "ceinture-boucle-or",
              "sac-bandouliere",
              "portefeuille-cuir",
            ],
          },
        },
        {
          id: "signature-1",
          sectionKey: "signature_product",
          variant: "leather",
          order: 4,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            eyebrow: "Pièce signature",
            collectionNumber: "Collection Harmattan — N°01",
            title: "Le Sac Tissé Almadies",
            description:
              "Cuir pleine fleur tressé à la main, chaîne dorée massive. Une pièce qui prend le temps qu'il faut pour être faite comme il faut.",
            media: {
              url: unsplash(PHOTO.bagWovenChain, { w: 1800 }),
              alt: "Sac tissé anses dorées, mise en scène signature",
            },
            detailMedia: {
              url: unsplash(PHOTO.textureGrain, { w: 900, h: 900 }),
              alt: "Détail du grain du cuir",
            },
            ctaLabel: "Découvrir la pièce",
            ctaHref: "/demo/luxury-minimal/produit",
          },
        },
        {
          id: "promo-1",
          sectionKey: "promotions",
          variant: "split",
          order: 5,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            title: "Offre Harmattan",
            promoCodeIds: ["HARMATTAN15"],
            media: { url: unsplash(PHOTO.editorialPlaidCoatBag, { w: 1600 }) },
          },
        },
        {
          id: "new-arrivals-1",
          sectionKey: "new_arrivals",
          variant: "carousel",
          order: 6,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            productIds: [
              "sac-bandouliere",
              "pochette-soiree",
              "manteau-camel",
              "portefeuille-cuir",
            ],
          },
        },
        {
          id: "heritage-1",
          sectionKey: "heritage",
          variant: "image-left",
          order: 7,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            eyebrow: "Savoir-faire",
            title: "Un héritage artisanal dakarois",
            body: "Dans nos ateliers partenaires de Dakar et Thiès, chaque sac, chaque paire de mocassins passe entre les mains d'artisans qui maîtrisent la coupe, la couture sellier et la finition à la main. Une exigence que nous refusons de sacrifier à la rapidité.",
            media: {
              url: unsplash(PHOTO.craftsmanPortrait, { w: 1400 }),
              alt: "Artisan façonnant une pièce de maroquinerie",
            },
            stats: [
              { value: "12", label: "Artisans partenaires" },
              { value: "8", label: "Étapes de fabrication" },
              { value: "48h", label: "Temps moyen par pièce" },
              { value: "2019", label: "Fondation de la maison" },
            ],
            ctaLabel: "Notre histoire",
            ctaHref: "/notre-histoire",
          },
        },
        {
          id: "benefits-1",
          sectionKey: "benefits",
          variant: "icons-row",
          order: 8,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            items: [
              {
                icon: "truck",
                title: "Livraison à Dakar en 24h",
                description: "Et sous 3 à 5 jours partout au Sénégal.",
              },
              {
                icon: "craft",
                title: "Façonné à la main",
                description: "Ateliers partenaires à Dakar et Thiès.",
              },
              {
                icon: "shield",
                title: "Paiement sécurisé",
                description: "Wave, Orange Money, Free Money, carte.",
              },
              {
                icon: "return",
                title: "Retours sous 14 jours",
                description: "Satisfait ou remboursé.",
              },
            ],
          },
        },
        {
          id: "testimonials-1",
          sectionKey: "testimonials",
          variant: "editorial",
          order: 9,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            items: [
              {
                author: "Aïssatou Ba",
                quote: "La qualité du cuir est exceptionnelle, on sent le savoir-faire artisanal.",
                avatarUrl: unsplash(PHOTO.portraitWoman1, { w: 800, h: 800 }),
                productPurchased: "Sac Cabas Cuir Pleine Fleur",
                rating: 5,
              },
              {
                author: "Moussa Fall",
                quote:
                  "Mon sac bandoulière de chez Maison Almadies — que des compliments à chaque sortie !",
                avatarUrl: unsplash(PHOTO.portraitMan1, { w: 800, h: 800 }),
                productPurchased: "Sac Bandoulière Structuré",
                rating: 5,
              },
              {
                author: "Khady Diop",
                quote:
                  "Mes mocassins sont arrivés en 24h à Dakar, service client très réactif sur WhatsApp.",
                avatarUrl: unsplash(PHOTO.portraitWoman2, { w: 800, h: 800 }),
                productPurchased: "Mocassins Cuir Cousus Main",
                rating: 4,
              },
            ],
          },
        },
        {
          id: "gallery-1",
          sectionKey: "gallery",
          variant: "masonry",
          order: 10,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            images: [
              {
                url: unsplash(PHOTO.heroModelTrench, { w: 900, h: 900 }),
                alt: "Trench en cuir noir",
              },
              {
                url: unsplash(PHOTO.editorialPlaidCoatBag, { w: 900, h: 900 }),
                alt: "Sac porté dans la rue",
              },
              { url: unsplash(PHOTO.bagTote, { w: 900, h: 900 }), alt: "Sac cabas en cuir" },
              { url: unsplash(PHOTO.jewelryRings, { w: 900, h: 900 }), alt: "Bagues en or" },
              { url: unsplash(PHOTO.shoeLoafer, { w: 900, h: 900 }), alt: "Mocassins en cuir" },
              {
                url: unsplash(PHOTO.craftHands, { w: 900, h: 900 }),
                alt: "Artisan façonnant le cuir",
              },
              {
                url: unsplash(PHOTO.textureGrain, { w: 900, h: 900 }),
                alt: "Détail du grain du cuir",
              },
              { url: unsplash(PHOTO.belt, { w: 900, h: 900 }), alt: "Ceinture en cuir" },
            ],
          },
        },
        {
          id: "lookbook-1",
          sectionKey: "lookbook",
          variant: "mosaic",
          order: 11,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            title: "Lookbook",
            images: [
              {
                url: unsplash(PHOTO.heroModelTrench, { w: 1200, h: 1500 }),
                alt: "Trench en cuir porté en extérieur",
                hotspots: [{ x: 45, y: 55, productId: "manteau-camel" }],
              },
              {
                url: unsplash(PHOTO.editorialPlaidCoatBag, { w: 1200, h: 1500 }),
                alt: "Sac porté au bras dans la rue",
                hotspots: [{ x: 60, y: 65, productId: "sac-bandouliere" }],
              },
              {
                url: unsplash(PHOTO.bagClutch, { w: 1200, h: 1500 }),
                alt: "Pochette de soirée en cuir",
                hotspots: [{ x: 50, y: 60, productId: "pochette-soiree" }],
              },
            ],
          },
        },
        {
          id: "newsletter-1",
          sectionKey: "newsletter",
          variant: "banner",
          order: 12,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            description:
              "Recevez nos nouvelles collections et offres exclusives en avant-première.",
          },
        },
        {
          id: "faq-1",
          sectionKey: "faq",
          variant: "accordion",
          order: 13,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            items: [
              {
                question: "Quels sont les délais de livraison ?",
                answer: "24h à Dakar, 3 à 5 jours ouvrés dans le reste du Sénégal.",
              },
              {
                question: "Quels moyens de paiement acceptez-vous ?",
                answer:
                  "Wave, Orange Money, Free Money, carte bancaire, et paiement à la livraison à Dakar.",
              },
              {
                question: "Puis-je retourner un article ?",
                answer: "Oui, sous 14 jours, article non porté et dans son emballage d'origine.",
              },
            ],
          },
        },
        {
          id: "cta-1",
          sectionKey: "cta",
          variant: "banner",
          order: 14,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            title: "Prête à vivre l'expérience Almadies ?",
            description: "Découvrez toute la collection Harmattan dès aujourd'hui.",
            buttonLabel: "Voir la collection",
            buttonHref: "/catalogue",
          },
        },
        {
          id: "whatsapp-1",
          sectionKey: "whatsapp",
          variant: "floating-button",
          order: 15,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            phoneNumber: "+221771234567",
            defaultMessage: "Bonjour, je souhaite un renseignement sur un article Maison Almadies.",
          },
        },
      ],
    },
  ],
};

/**
 * Validé au chargement du module — une erreur dans les données de démonstration
 * elles-mêmes doit être détectée par nos propres tests/`next build`, jamais découverte
 * par un visiteur (contrairement au contenu réel d'un tenant, toujours protégé
 * individuellement section par section par `SectionRenderer`, voir plus bas).
 */
export const DEMO_MANIFEST: TemplateManifest = validateTemplateManifest(RAW_DEMO_MANIFEST);

const CATEGORY_CATALOG: Record<string, ResolvedCategoriesContent["categories"][number]> = {
  maroquinerie: {
    id: "maroquinerie",
    name: "Maroquinerie",
    imageUrl: unsplash(PHOTO.bagBucket, { w: 1000, h: 1000 }),
    href: "/catalogue/maroquinerie",
  },
  "pret-a-porter": {
    id: "pret-a-porter",
    name: "Prêt-à-porter",
    imageUrl: unsplash(PHOTO.coatCamel, { w: 1000, h: 1000 }),
    href: "/catalogue/pret-a-porter",
  },
  bijoux: {
    id: "bijoux",
    name: "Bijoux",
    imageUrl: unsplash(PHOTO.jewelryRings, { w: 1000, h: 1000 }),
    href: "/catalogue/bijoux",
  },
  accessoires: {
    id: "accessoires",
    name: "Accessoires",
    imageUrl: unsplash(PHOTO.belt, { w: 1000, h: 1000 }),
    href: "/catalogue/accessoires",
  },
};

// Une seule fiche produit complète existe pour l'instant (voir
// PRODUCT_DETAILS_BY_HANDLE plus bas) — tous les produits du catalogue y renvoient
// pour la démonstration, MAIS il s'agit d'une vraie route dynamique Next.js
// (`app/demo/luxury-minimal/produit/[handle]/page.tsx`, avec `generateStaticParams`),
// pas d'une page statique isolée : ajouter une entrée à `PRODUCT_DETAILS_BY_HANDLE`
// suffirait à donner sa propre fiche à n'importe quel autre produit (voir la revue du
// 16 septembre 2026, point 3). `hoverImageUrl` réutilise un gros plan de matière comme
// "second visuel" au survol (voir product-card.tsx) : une démonstration honnête plutôt
// que d'inventer un second angle de prise de vue qui n'existe pas pour ces photos de
// stock.
const PRODUCT_HREF = "/demo/luxury-minimal/produit/sac-cabas-cuir";

const PRODUCT_CATALOG: Record<string, ResolvedProductsContent["products"][number]> = {
  "sac-cabas-cuir": {
    id: "sac-cabas-cuir",
    name: "Sac Cabas Cuir Pleine Fleur",
    price: 185_000,
    imageUrl: unsplash(PHOTO.bagTote, { w: 900, h: 1125 }),
    hoverImageUrl: unsplash(PHOTO.textureGrain, { w: 900, h: 1125 }),
    href: PRODUCT_HREF,
  },
  "sac-bandouliere": {
    id: "sac-bandouliere",
    name: "Sac Bandoulière Structuré",
    price: 165_000,
    compareAtPrice: 195_000,
    imageUrl: unsplash(PHOTO.bagBucket, { w: 900, h: 1125 }),
    hoverImageUrl: unsplash(PHOTO.textureGrain, { w: 900, h: 1125 }),
    badge: "Promo",
    href: PRODUCT_HREF,
  },
  "pochette-soiree": {
    id: "pochette-soiree",
    name: "Pochette de Soirée Cuir",
    price: 89_000,
    imageUrl: unsplash(PHOTO.bagClutch, { w: 900, h: 1125 }),
    hoverImageUrl: unsplash(PHOTO.textureGrain, { w: 900, h: 1125 }),
    href: PRODUCT_HREF,
  },
  "sac-tisse-doré": {
    id: "sac-tisse-doré",
    name: "Sac Tissé Anses Dorées",
    price: 210_000,
    imageUrl: unsplash(PHOTO.bagWovenChain, { w: 900, h: 1125 }),
    href: PRODUCT_HREF,
  },
  "mocassins-cuir": {
    id: "mocassins-cuir",
    name: "Mocassins Cuir Cousus Main",
    price: 95_000,
    imageUrl: unsplash(PHOTO.shoeLoafer, { w: 900, h: 1125 }),
    hoverImageUrl: unsplash(PHOTO.textureGrain, { w: 900, h: 1125 }),
    href: PRODUCT_HREF,
  },
  "derbies-cuir": {
    id: "derbies-cuir",
    name: "Derbies Cuir Noir",
    price: 98_000,
    imageUrl: unsplash(PHOTO.shoeOxford, { w: 900, h: 1125 }),
    href: PRODUCT_HREF,
  },
  "collier-or-filigrane": {
    id: "collier-or-filigrane",
    name: "Collier Or Filigrane",
    price: 135_000,
    imageUrl: unsplash(PHOTO.jewelryPendant, { w: 900, h: 1125 }),
    hoverImageUrl: unsplash(PHOTO.jewelryRings, { w: 900, h: 1125 }),
    href: PRODUCT_HREF,
  },
  "ceinture-boucle-or": {
    id: "ceinture-boucle-or",
    name: "Ceinture Cuir Boucle Dorée",
    price: 42_000,
    imageUrl: unsplash(PHOTO.belt, { w: 900, h: 1125 }),
    hoverImageUrl: unsplash(PHOTO.textureGrain, { w: 900, h: 1125 }),
    href: PRODUCT_HREF,
  },
  "portefeuille-cuir": {
    id: "portefeuille-cuir",
    name: "Portefeuille Cuir Grainé",
    price: 38_000,
    imageUrl: unsplash(PHOTO.wallet, { w: 900, h: 1125 }),
    hoverImageUrl: unsplash(PHOTO.textureGrain, { w: 900, h: 1125 }),
    href: PRODUCT_HREF,
    // Volontairement en rupture — démontre le badge/l'état "rupture de stock" (revue
    // du 16 septembre 2026, point 3) sur une carte réellement affichée dans les
    // sections "Produits en vedette" et "Nouveautés".
    inStock: false,
  },
  "manteau-camel": {
    id: "manteau-camel",
    name: "Manteau Cape Camel",
    price: 245_000,
    imageUrl: unsplash(PHOTO.coatCamel, { w: 900, h: 1125 }),
    href: PRODUCT_HREF,
  },
};

const PROMOTION_CATALOG: Record<string, ResolvedPromotionsContent> = {
  HARMATTAN15: {
    headline: "-15% sur la maroquinerie",
    description:
      "Offre valable jusqu'au 30 septembre, sur tous les sacs et la petite maroquinerie.",
    discountLabel: "-15%",
    ctaLabel: "En profiter",
    ctaHref: "/catalogue",
  },
};

/**
 * Navigation avec mega menu — voir la refonte visuelle du 16 septembre 2026
 * (« navigation avec mega menu »). Chaque colonne pointe vers des filtres de catalogue
 * qui n'existent pas encore réellement (Phase 2) ; l'important pour cette démonstration
 * est la structure et le rendu, pas la navigation effective.
 */
export const DEMO_NAV_ITEMS: NavItem[] = [
  {
    label: "Maroquinerie",
    href: "/catalogue/maroquinerie",
    megaMenu: {
      columns: [
        {
          title: "Sacs",
          links: [
            { label: "Cabas", href: "/catalogue/maroquinerie/cabas" },
            { label: "Bandoulière", href: "/catalogue/maroquinerie/bandouliere" },
            { label: "Pochettes de soirée", href: "/catalogue/maroquinerie/pochettes" },
          ],
        },
        {
          title: "Petite maroquinerie",
          links: [
            { label: "Portefeuilles", href: "/catalogue/maroquinerie/portefeuilles" },
            { label: "Ceintures", href: "/catalogue/accessoires/ceintures" },
          ],
        },
      ],
      featured: {
        imageUrl: unsplash(PHOTO.bagBucket, { w: 900, h: 1125 }),
        title: "La nouvelle ligne de sacs",
        href: "/catalogue/maroquinerie",
        ctaLabel: "Découvrir",
      },
    },
  },
  {
    label: "Prêt-à-porter",
    href: "/catalogue/pret-a-porter",
    megaMenu: {
      columns: [
        {
          title: "Manteaux",
          links: [{ label: "Manteau Camel", href: "/catalogue/pret-a-porter/manteaux" }],
        },
        {
          title: "Chaussures",
          links: [
            { label: "Mocassins", href: "/catalogue/pret-a-porter/mocassins" },
            { label: "Derbies", href: "/catalogue/pret-a-porter/derbies" },
          ],
        },
      ],
      featured: {
        imageUrl: unsplash(PHOTO.coatCamel, { w: 900, h: 1125 }),
        title: "L'hiver à Dakar",
        href: "/catalogue/pret-a-porter",
        ctaLabel: "Voir la collection",
      },
    },
  },
  {
    label: "Bijoux",
    href: "/catalogue/bijoux",
    megaMenu: {
      columns: [
        {
          title: "Colliers",
          links: [{ label: "Or filigrane", href: "/catalogue/bijoux/colliers" }],
        },
        {
          title: "Bagues",
          links: [{ label: "Empilables", href: "/catalogue/bijoux/bagues" }],
        },
      ],
      featured: {
        imageUrl: unsplash(PHOTO.jewelryPendant, { w: 900, h: 1125 }),
        title: "L'atelier joaillerie",
        href: "/catalogue/bijoux",
        ctaLabel: "Découvrir",
      },
    },
  },
  { label: "Contact", href: "#contact" },
];

/** Deux articles de démonstration pour illustrer le panier latéral — voir cart-drawer.tsx. */
export const DEMO_CART_LINES: CartLine[] = [
  {
    id: "sac-cabas-cuir",
    name: "Sac Cabas Cuir Pleine Fleur",
    price: 185_000,
    quantity: 1,
    imageUrl: unsplash(PHOTO.bagTote, { w: 400, h: 500 }),
  },
  {
    id: "mocassins-cuir",
    name: "Mocassins Cuir Cousus Main",
    price: 95_000,
    quantity: 1,
    variant: "Pointure 42",
    imageUrl: unsplash(PHOTO.shoeLoafer, { w: 400, h: 500 }),
  },
];

export const DEMO_SEARCH_SUGGESTIONS: SearchSuggestion[] = [
  { label: "Sacs à main", href: "/catalogue/maroquinerie" },
  { label: "Mocassins", href: "/catalogue/pret-a-porter" },
  { label: "Bijoux en or", href: "/catalogue/bijoux" },
  { label: "Ceintures", href: "/catalogue/accessoires" },
  { label: "Nouveautés", href: "/catalogue?tri=nouveaute" },
];

/**
 * Résout les identifiants référencés par le manifeste (voir sections "categories",
 * "featured_products", "new_arrivals", "promotions" ci-dessus) vers un contenu
 * affichable — voir content-types.ts pour la distinction config/contenu résolu. Les
 * identifiants sont répétés ici plutôt que relus depuis `DEMO_MANIFEST` (dont les
 * `params` sont volontairement typés `Record<string, unknown>` — non structurés côté
 * TypeScript, seulement validés à l'exécution) : pour la démonstration, une simple
 * table statique ; côté réel (Phase 2+), la même interface sera servie par une
 * requête Prisma scoping-tenant.
 */
export const DEMO_RESOLVED_CONTENT: ResolvedContentBySectionId = {
  "categories-1": {
    categories: ["maroquinerie", "pret-a-porter", "bijoux", "accessoires"].map(
      (id) => CATEGORY_CATALOG[id]!,
    ),
  },
  "featured-1": {
    products: [
      "sac-cabas-cuir",
      "mocassins-cuir",
      "collier-or-filigrane",
      "ceinture-boucle-or",
      "sac-bandouliere",
      "portefeuille-cuir",
    ].map((id) => PRODUCT_CATALOG[id]!),
  },
  "promo-1": PROMOTION_CATALOG.HARMATTAN15!,
  "new-arrivals-1": {
    products: ["sac-bandouliere", "pochette-soiree", "manteau-camel", "portefeuille-cuir"].map(
      (id) => PRODUCT_CATALOG[id]!,
    ),
  },
  "lookbook-1": { productsById: PRODUCT_CATALOG },
};

/** Numéro WhatsApp de démonstration — repris par le pied de page et la section
 *  "whatsapp" du manifeste, pour ne le déclarer qu'à un seul endroit. */
export const WHATSAPP_NUMBER = "+221771234567";

/**
 * Fiches produit de démonstration — voir la refonte artistique du 16 septembre 2026
 * (deux des dix captures demandées portent sur la fiche produit) et sa revue du même
 * jour, point 3 : « la fiche ne doit pas être codée en dur ; elle doit recevoir ses
 * données sous forme de propriétés typées et être compatible avec une future route
 * dynamique ». `PRODUCT_DETAILS_BY_HANDLE` + `getProductByHandle()` ci-dessous jouent
 * exactement le rôle qu'une requête base de données jouerait plus tard (Phase 2+) :
 * `app/demo/luxury-minimal/produit/[handle]/page.tsx` est déjà une VRAIE route
 * dynamique Next.js (`generateStaticParams`), simplement adossée à cette table
 * statique plutôt qu'à Prisma pour l'instant. Une seule fiche complète existe
 * aujourd'hui ; en ajouter une seconde ne demande qu'une nouvelle entrée ici.
 *
 * Les couleurs référencent les tokens (`var(--color-leather)`, etc.) plutôt que des
 * teintes codées en dur — voir la revue du 16 septembre 2026, point 1.
 */
const PRODUCT_DETAILS_BY_HANDLE: Record<string, ProductDetailData> = {
  "sac-cabas-cuir": {
    id: "sac-cabas-cuir",
    name: "Sac Cabas Cuir Pleine Fleur",
    price: 185_000,
    description:
      "Un cabas structuré en cuir pleine fleur, tanné et façonné à la main dans nos ateliers partenaires de Dakar. Sa doublure en toile de coton et ses fermoirs en laiton massif en font une pièce pensée pour accompagner le quotidien pendant des années.",
    materialNote:
      "Cuir de vachette pleine fleur, tannage végétal. Chaque peau est sélectionnée individuellement pour la régularité de son grain. Doublure coton, quincaillerie laiton massif brossé.",
    images: [
      unsplash(PHOTO.bagTote, { w: 1200, h: 1500 }),
      unsplash(PHOTO.textureGrain, { w: 1200, h: 1500 }),
      unsplash(PHOTO.bagBucket, { w: 1200, h: 1500 }),
    ],
    colors: [
      { label: "Brun cuir", hex: "var(--color-leather)" },
      { label: "Noir profond", hex: "var(--color-primary)" },
      { label: "Champagne", hex: "var(--color-champagne)" },
    ],
    sizes: ["S", "M", "L"],
    inStock: true,
    href: PRODUCT_HREF,
  },
};

export function getProductByHandle(handle: string): ProductDetailData | undefined {
  return PRODUCT_DETAILS_BY_HANDLE[handle];
}

export function getAllProductHandles(): string[] {
  return Object.keys(PRODUCT_DETAILS_BY_HANDLE);
}

export const DEMO_RELATED_PRODUCT_IDS = [
  "sac-bandouliere",
  "pochette-soiree",
  "sac-tisse-doré",
  "ceinture-boucle-or",
];

export function getRelatedProducts(): ResolvedProductsContent {
  return {
    title: "Vous aimerez aussi",
    products: DEMO_RELATED_PRODUCT_IDS.map((id) => PRODUCT_CATALOG[id]!),
  };
}
