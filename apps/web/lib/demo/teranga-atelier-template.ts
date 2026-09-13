import type { DesignTokens } from "@yamacommerce/design-tokens";
import { validateTemplateManifest, type TemplateManifest } from "@yamacommerce/templates";
import type {
  ResolvedCategoriesContent,
  ResolvedProductsContent,
  ResolvedPromotionsContent,
  ResolvedDesignersContent,
} from "@/components/sections/content-types";
import type { ResolvedContentBySectionId } from "@/components/sections/section-renderer";
import type { CartLine } from "@/lib/commerce/cart-context";
import type { NavItem } from "@/components/layout/mega-menu-nav";
import type { SearchSuggestion } from "@/components/layout/search-overlay";
import type { ProductDetailData } from "@/components/product/product-detail";
import type { DesignerProfileData } from "@/components/product/designer-profile";

/**
 * Données de démonstration du template « Boutique africaine contemporaine » —
 * quatrième des cinq premiers templates e-commerce (voir docs/09, Phase 1), pour une
 * marque fictive premium « Teranga Atelier » : mode africaine contemporaine, créateurs
 * sénégalais, fabrication locale, vente au Sénégal ET à la diaspora.
 *
 * Structurellement DIFFÉRENT des 3 premiers templates (validé le 20 septembre 2026,
 * pas une simple variante de couleurs) :
 * - 2 sections entièrement nouvelles ajoutées au catalogue partagé (`designers`,
 *   `provenance`, voir packages/templates/src/sections.ts) qu'AUCUN autre template
 *   n'utilise — fiches créateurs individuelles (route dynamique `/createur/[handle]`,
 *   même principe que la fiche produit) et carte interactive des régions de
 *   fabrication.
 * - Mécaniques « édition limitée » sur `signature_product` (compteur de pièces
 *   restantes, précommande) — un champ optionnel du schéma existant qu'aucun des 3
 *   premiers templates n'utilise.
 * - Sélecteur de devise RÉELLEMENT fonctionnel (FCFA/EUR/CAD/USD, voir
 *   lib/commerce/currency-context.tsx) — vente à la diaspora — masqué sur les 3 autres
 *   templates.
 * - Guide des tailles et partage WhatsApp sur la fiche produit.
 * - Typographie éditoriale (Cambria — un serif contemporain nettement plus anguleux que
 *   le Georgia classique de Luxe minimaliste) sur fond ivoire/terracotta/indigo, à
 *   l'opposé du noir profond de Luxe minimaliste — voir la direction artistique
 *   demandée le 20 septembre 2026 : « évite absolument... une copie du template Luxe
 *   minimaliste ».
 *
 * Photographie : Unsplash (CDN `images.unsplash.com`, tier gratuit uniquement),
 * sélectionnée pour une direction éditoriale contemporaine et chaleureuse — en évitant
 * délibérément les clichés folkloriques et les motifs africains plaqués partout
 * (contrainte explicite du 20 septembre 2026).
 */

function unsplash(photoId: string, { w = 1600, h }: { w?: number; h?: number } = {}): string {
  const params = new URLSearchParams({ q: "80", fm: "jpg", fit: "crop", w: String(w) });
  if (h) params.set("h", String(h));
  return `https://images.unsplash.com/${photoId}?${params.toString()}`;
}

// NOTE : identifiants Unsplash provisoires (réutilisés depuis un pool déjà validé —
// maroquinerie/portraits/architecture, thématiquement proches) le temps qu'une
// recherche dédiée « mode africaine contemporaine » confirme des visuels éditoriaux
// propres à Teranga Atelier (recherche dédiée « mode africaine contemporaine », tier
// gratuit uniquement — voir le rapport de livraison de ce template pour le détail des
// écarts assumés : aucune photo de sac/ceinture/chaussure n'a pu être source proprement
// pour cette recherche ; les produits correspondants ont été adaptés vers des pièces
// textiles/bois/bronze pour lesquelles la photographie disponible est authentique,
// plutôt que de forcer une image non pertinente. Aucune architecture n'a pu être
// confirmée comme spécifiquement sénégalaise/sahélienne sur le tier gratuit — un
// intérieur de boutique a été utilisé à la place, sans fausse mention de lieu).
const PHOTO = {
  heroEditorial: "photo-1733324961705-97bd6cd7f4ba",
  womenCollection: "photo-1784160053632-6eddd51bda26",
  menCollection: "photo-1776435303341-40b43c86d18b",
  homeDecor: "photo-1777869779118-2389f6c951eb",
  woodenTableware: "photo-1645205441056-895632a8f5d9",
  jewelryClose: "photo-1713845784494-33f5d1f96d25",
  jewelryPendant: "photo-1757140448293-fa0de8f449e5",
  indigoTexture: "photo-1778084356053-40103587d24f",
  basketWeaveTexture: "photo-1777332546595-b28294e9084b",
  craftHands: "photo-1641320197434-6ae0ca235048",
  craftsmanPortrait: "photo-1777107499153-0b51fd83ce7e",
  boutiqueInterior: "photo-1777628530456-bb93d3a03faf",
  portraitWoman1: "photo-1527203561188-dae1bc1a417f",
  portraitMan1: "photo-1596529257881-85dfcdc8f880",
  portraitWoman2: "photo-1600144559281-53d1dee79a99",
} as const;

export const TERANGA_ATELIER_DESIGN_TOKENS: DesignTokens = {
  // Palette « boutique africaine contemporaine » (20 septembre 2026) : terracotta,
  // sable, indigo profond, ivoire, bronze, vert baobab en accent très sobre — à
  // l'opposé du noir profond/ivoire de Luxe minimaliste et du charbon/orange de
  // Commerce moderne.
  colors: {
    primary: "#2C3A63",
    secondary: "#C1622D",
    background: "#FBF6EC",
    surface: "#F1E3C8",
    surfaceMuted: "#E4D0A4",
    textPrimary: "#241A12",
    textSecondary: "#5C4A38",
    textMuted: "#8C7A61",
    border: "#DFC9A0",
    success: "#3F6B45",
    danger: "#9B3B2E",
    warning: "#8F6A2C",
    accentPrimary: "#9C6B30",
    accentSecondary: "#4B6B4A",
    leather: "#8B4A2B",
    champagne: "#D8B978",
    overlay: "rgba(32, 24, 16, 0.55)",
    mutedSurface: "#1E2740",
  },
  typography: {
    // Cambria (serif contemporain, plus géométrique/anguleux que Georgia) — direction
    // « typographie éditoriale contemporaine », délibérément distincte du Georgia
    // classique de Luxe minimaliste (voir la note de tête de fichier).
    headingFont: "Cambria, 'Book Antiqua', Palatino, Georgia, serif",
    bodyFont:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    headingSizes: {
      xs: "1.125rem",
      sm: "1.625rem",
      md: "clamp(1.75rem, 1.5rem + 1vw, 2.25rem)",
      lg: "clamp(2.1rem, 1.7rem + 1.6vw, 3rem)",
      xl: "clamp(2.5rem, 1.9rem + 2.4vw, 4rem)",
      "2xl": "clamp(2.75rem, 1.9rem + 3.4vw, 4.75rem)",
      "3xl": "clamp(3rem, 2rem + 4.5vw, 5.5rem)",
      "4xl": "clamp(3.25rem, 1.8rem + 6vw, 6.25rem)",
    },
    bodySizes: { xs: "0.8125rem", sm: "0.9375rem", md: "1.0625rem", lg: "1.25rem", xl: "1.5rem" },
  },
  spacing: { scale: ["0px", "4px", "8px", "12px", "16px", "24px", "32px", "48px", "64px", "96px"] },
  borders: { width: "1px", color: "#DFC9A0" },
  radii: { sm: "2px", md: "6px", lg: "14px", full: "9999px" },
  shadows: {
    sm: "0 2px 6px rgba(44,58,99,0.08)",
    md: "0 10px 28px rgba(44,58,99,0.12)",
    lg: "0 28px 64px rgba(44,58,99,0.2)",
  },
  layout: { contentMaxWidth: "1480px" },
  buttonStyle: { shape: "rounded", size: "lg", variant: "solid" },
  // `border: false` : cartes plus éditoriales (ombre seule, pas de contour dur) —
  // contraste volontaire avec les 3 premiers templates (tous `border: true`).
  cardStyle: { radius: "md", shadow: "md", border: false },
  headerStyle: { variant: "transparent-on-hero", height: "88px" },
  footerStyle: { variant: "expanded" },
  formStyle: { inputRadius: "sm", inputBorderStyle: "underline" },
  animation: {
    level: "dynamic",
    durations: { fast: 150, base: 350, slow: 550 },
    easing: {
      standard: "cubic-bezier(0.4, 0, 0.2, 1)",
      decelerate: "cubic-bezier(0, 0, 0.2, 1)",
      accelerate: "cubic-bezier(0.4, 0, 1, 1)",
    },
  },
};

export const SHOP_NAME = "Teranga Atelier";
export const WHATSAPP_NUMBER = "+221761234567";
export const SHOP_TAGLINE = {
  fr: "Mode et objets africains contemporains, façonnés par des créateurs sénégalais.",
  en: "Contemporary African fashion and objects, crafted by Senegalese designers.",
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
            eyebrow: "Collection Teranga",
            title: "L'élégance africaine, façonnée à Dakar",
            subtitle:
              "Vêtements, bijoux et objets de décoration créés par des designers sénégalais, pour le Sénégal et sa diaspora.",
            media: {
              url: unsplash(PHOTO.heroEditorial, { w: 2400 }),
              alt: "Portrait éditorial en tenue contemporaine africaine",
            },
            ctaLabel: "Découvrir la collection",
            ctaHref: "/catalogue",
          },
        },
        {
          id: "manifesto-1",
          sectionKey: "brand_manifesto",
          variant: "image-left",
          order: 1,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            eyebrow: "Notre démarche",
            statement: "Chaque pièce raconte un savoir-faire, un lieu, une main qui l'a façonnée.",
            body: "Teranga Atelier réunit des créateurs sénégalais qui réinventent les techniques traditionnelles — tissage, maroquinerie, bijouterie, poterie — dans un vocabulaire contemporain. Fabrication locale, matières choisies avec soin, séries volontairement limitées.",
            media: {
              url: unsplash(PHOTO.craftHands, { w: 1600 }),
              alt: "Mains d'artisan travaillant une matière brute",
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
          params: { categoryIds: ["femmes", "hommes", "maison", "bijoux"] },
        },
        {
          id: "designers-1",
          sectionKey: "designers",
          variant: "grid",
          order: 3,
          isEnabled: true,
          animationOverride: "inherit",
          params: { designerIds: ["aissatou-diop", "moussa-sarr", "fatou-ndiaye"] },
        },
        {
          id: "featured-1",
          sectionKey: "featured_products",
          variant: "masonry",
          order: 4,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            productIds: [
              "robe-wax-structuree",
              "chemise-brodee-homme",
              "collier-bronze-martele",
              "panier-tisse-raphia",
              "etole-indigo-tissee",
              "boucles-oreilles-laiton",
            ],
          },
        },
        {
          id: "signature-1",
          sectionKey: "signature_product",
          variant: "leather",
          order: 5,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            eyebrow: "Édition limitée",
            collectionNumber: "Série Baobab — N°01",
            title: "Le Boubou Indigo Tissé Main",
            description:
              "Coton filé et teint à l'indigo naturel, tissé sur métier traditionnel à Casamance. Douze pièces seulement, chacune légèrement unique.",
            media: {
              url: unsplash(PHOTO.womenCollection, { w: 1800 }),
              alt: "Boubou indigo porté, mise en scène éditoriale",
            },
            detailMedia: {
              url: unsplash(PHOTO.indigoTexture, { w: 900, h: 900 }),
              alt: "Détail du tissage indigo",
            },
            ctaLabel: "Découvrir la pièce",
            ctaHref: "/demo/teranga-atelier/produit/boubou-indigo-tisse",
            piecesRemaining: 4,
          },
        },
        {
          id: "heritage-1",
          sectionKey: "heritage",
          variant: "image-right",
          order: 6,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            eyebrow: "Savoir-faire",
            title: "L'histoire de nos artisans",
            body: "Derrière chaque pièce, un geste transmis depuis plusieurs générations. Nos ateliers partenaires à Dakar, Thiès et en Casamance emploient des techniques de tissage, de maroquinerie et de bijouterie que Teranga Atelier s'engage à faire vivre et à rémunérer justement.",
            media: {
              url: unsplash(PHOTO.craftsmanPortrait, { w: 1400 }),
              alt: "Portrait d'un artisan dans son atelier",
            },
            stats: [
              { value: "23", label: "Créateurs partenaires" },
              { value: "5", label: "Régions du Sénégal" },
              { value: "100%", label: "Fabrication locale" },
            ],
            ctaLabel: "Notre démarche",
            ctaHref: "#createurs",
          },
        },
        {
          id: "provenance-1",
          sectionKey: "provenance",
          variant: "map",
          order: 7,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            title: "Origines & savoir-faire",
            intro:
              "Chaque région du Sénégal apporte sa propre technique — découvrez d'où viennent les pièces Teranga Atelier.",
            regions: [
              {
                id: "casamance",
                name: "Casamance",
                craft: "Tissage & teinture indigo",
                description:
                  "Le coton est filé, tissé sur métier traditionnel puis teint à l'indigo naturel — une technique transmise de mère en fille depuis des générations.",
                media: {
                  url: unsplash(PHOTO.indigoTexture, { w: 1000, h: 1000 }),
                  alt: "Texture de tissage indigo",
                },
                x: 22,
                y: 78,
              },
              {
                id: "thies",
                name: "Thiès",
                craft: "Poterie & céramique",
                description:
                  "L'argile locale est façonnée à la main puis cuite au feu de bois, pour des pièces de décoration à la texture brute et chaleureuse.",
                media: {
                  url: unsplash(PHOTO.homeDecor, { w: 1000, h: 1000 }),
                  alt: "Poterie en argile façonnée à la main",
                },
                x: 48,
                y: 55,
              },
              {
                id: "dakar",
                name: "Dakar",
                craft: "Bijouterie",
                description:
                  "Dans les ateliers de la capitale, le bronze et le laiton sont travaillés par des artisans formés aux techniques de fonte à la cire perdue et de martelage.",
                media: {
                  url: unsplash(PHOTO.jewelryClose, { w: 1000, h: 1000 }),
                  alt: "Bijoux en bronze façonnés à la main",
                },
                x: 15,
                y: 62,
              },
              {
                id: "saint-louis",
                name: "Saint-Louis",
                craft: "Broderie",
                description:
                  "La broderie main, héritée de l'influence signare, orne cols et manches de motifs géométriques discrets.",
                media: {
                  url: unsplash(PHOTO.menCollection, { w: 1000, h: 1000 }),
                  alt: "Détail de broderie sur tissu",
                },
                x: 20,
                y: 20,
              },
            ],
          },
        },
        {
          id: "lookbook-1",
          sectionKey: "lookbook",
          variant: "mosaic",
          order: 8,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            title: "Lookbook",
            images: [
              {
                url: unsplash(PHOTO.womenCollection, { w: 1200, h: 1500 }),
                alt: "Look femme, collection Teranga",
                hotspots: [{ x: 50, y: 60, productId: "robe-wax-structuree" }],
              },
              {
                url: unsplash(PHOTO.menCollection, { w: 1200, h: 1500 }),
                alt: "Look homme, collection Teranga",
                hotspots: [{ x: 45, y: 55, productId: "chemise-brodee-homme" }],
              },
              {
                url: unsplash(PHOTO.jewelryClose, { w: 1200, h: 1500 }),
                alt: "Détail bijoux bronze",
                hotspots: [{ x: 55, y: 50, productId: "collier-bronze-martele" }],
              },
            ],
          },
        },
        {
          id: "video-1",
          sectionKey: "video",
          variant: "framed",
          order: 9,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            title: "Dans l'atelier",
            videoUrl: "https://cdn.coverr.co/videos/coverr-hands-weaving-fabric-2633/1080p.mp4",
            posterUrl: unsplash(PHOTO.craftHands, { w: 1600 }),
          },
        },
        {
          id: "testimonials-1",
          sectionKey: "testimonials",
          variant: "editorial",
          order: 10,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            items: [
              {
                author: "Coumba Sy",
                quote:
                  "Le boubou indigo est une pièce d'exception — on sent le travail du tissage main. Livré en Belgique sans problème.",
                avatarUrl: unsplash(PHOTO.portraitWoman1, { w: 800, h: 800 }),
                productPurchased: "Boubou Indigo Tissé Main",
                rating: 5,
              },
              {
                author: "Ibrahima Fall",
                quote:
                  "La chemise brodée est superbe, la broderie est d'une finesse rare. Je recommande sans hésiter.",
                avatarUrl: unsplash(PHOTO.portraitMan1, { w: 800, h: 800 }),
                productPurchased: "Chemise Brodée Homme",
                rating: 5,
              },
              {
                author: "Aminata Cissé",
                quote:
                  "Mon collier en bronze martelé attire tous les regards. Le paiement en euros a été très simple.",
                avatarUrl: unsplash(PHOTO.portraitWoman2, { w: 800, h: 800 }),
                productPurchased: "Collier Bronze Martelé",
                rating: 4,
              },
            ],
          },
        },
        {
          id: "benefits-1",
          sectionKey: "benefits",
          variant: "icons-row",
          order: 11,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            items: [
              {
                icon: "truck",
                title: "Livraison internationale",
                description: "Sénégal, Europe et Amérique du Nord.",
              },
              {
                icon: "craft",
                title: "Fabrication locale",
                description: "Chaque pièce façonnée par un créateur sénégalais.",
              },
              {
                icon: "shield",
                title: "Paiements locaux et internationaux",
                description: "Wave, Orange Money, carte, FCFA/EUR/CAD/USD.",
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
          id: "gallery-1",
          sectionKey: "gallery",
          variant: "grid",
          order: 12,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            title: "Suivez-nous @teranga.atelier",
            images: [
              {
                url: unsplash(PHOTO.basketWeaveTexture, { w: 800, h: 800 }),
                alt: "Tissage artisanal, publication Instagram",
              },
              {
                url: unsplash(PHOTO.jewelryPendant, { w: 800, h: 800 }),
                alt: "Pendentif bronze, publication Instagram",
              },
              {
                url: unsplash(PHOTO.homeDecor, { w: 800, h: 800 }),
                alt: "Décoration maison, publication Instagram",
              },
              {
                url: unsplash(PHOTO.craftHands, { w: 800, h: 800 }),
                alt: "Mains d'artisan, publication Instagram",
              },
              {
                url: unsplash(PHOTO.woodenTableware, { w: 800, h: 800 }),
                alt: "Objets en bois, publication Instagram",
              },
              {
                url: unsplash(PHOTO.boutiqueInterior, { w: 800, h: 800 }),
                alt: "Notre atelier, publication Instagram",
              },
            ],
          },
        },
        {
          id: "cta-instagram-1",
          sectionKey: "cta",
          variant: "banner",
          order: 13,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            title: "Rejoignez la communauté Teranga",
            description:
              "Nouvelles pièces, coulisses d'atelier et portraits de créateurs, chaque semaine.",
            buttonLabel: "Voir sur Instagram",
            buttonHref: "https://instagram.com",
          },
        },
        {
          id: "newsletter-1",
          sectionKey: "newsletter",
          variant: "inline",
          order: 14,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            title: "Ne manquez aucune collection",
            description:
              "Les nouvelles pièces et éditions limitées, directement dans votre boîte mail.",
          },
        },
        {
          id: "faq-1",
          sectionKey: "faq",
          variant: "accordion",
          order: 15,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            items: [
              {
                question: "Livrez-vous à l'international ?",
                answer:
                  "Oui, au Sénégal, en Europe et en Amérique du Nord — les frais sont calculés au moment de la commande.",
              },
              {
                question: "Puis-je payer en euros ou en dollars ?",
                answer:
                  "Oui, choisissez votre devise d'affichage en haut de page (FCFA, EUR, CAD, USD).",
              },
              {
                question: "Les éditions limitées sont-elles réapprovisionnées ?",
                answer:
                  "Non, chaque série limitée n'est produite qu'une fois — une fois épuisée, la pièce ne revient pas.",
              },
            ],
          },
        },
        {
          id: "whatsapp-1",
          sectionKey: "whatsapp",
          variant: "floating-button",
          order: 16,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            phoneNumber: WHATSAPP_NUMBER,
            defaultMessage: "Bonjour, j'ai une question sur une création Teranga Atelier.",
          },
        },
      ],
    },
  ],
};

export const DEMO_MANIFEST: TemplateManifest = validateTemplateManifest(RAW_DEMO_MANIFEST);

const CATEGORY_CATALOG: Record<string, ResolvedCategoryItem> = {
  femmes: {
    id: "femmes",
    name: "Femmes",
    imageUrl: unsplash(PHOTO.womenCollection, { w: 1000, h: 1250 }),
    href: "/catalogue/femmes",
  },
  hommes: {
    id: "hommes",
    name: "Hommes",
    imageUrl: unsplash(PHOTO.menCollection, { w: 1000, h: 1250 }),
    href: "/catalogue/hommes",
  },
  maison: {
    id: "maison",
    name: "Maison",
    imageUrl: unsplash(PHOTO.homeDecor, { w: 1000, h: 1250 }),
    href: "/catalogue/maison",
  },
  bijoux: {
    id: "bijoux",
    name: "Bijoux",
    imageUrl: unsplash(PHOTO.jewelryClose, { w: 1000, h: 1250 }),
    href: "/catalogue/bijoux",
  },
};

type ResolvedCategoryItem = ResolvedCategoriesContent["categories"][number];

const PRODUCT_HREF = "/demo/teranga-atelier/produit/robe-wax-structuree";

const SIZE_GUIDE_CLOTHING = [
  { size: "S", chest: "84–88", waist: "66–70" },
  { size: "M", chest: "89–93", waist: "71–75" },
  { size: "L", chest: "94–99", waist: "76–81" },
  { size: "XL", chest: "100–106", waist: "82–88" },
];

const PRODUCT_CATALOG: Record<string, ResolvedProductsContent["products"][number]> = {
  "robe-wax-structuree": {
    id: "robe-wax-structuree",
    name: "Robe Wax Structurée",
    price: 68_000,
    imageUrl: unsplash(PHOTO.womenCollection, { w: 900, h: 1125 }),
    hoverImageUrl: unsplash(PHOTO.indigoTexture, { w: 900, h: 1125 }),
    badge: "Best-seller",
    href: PRODUCT_HREF,
  },
  "chemise-brodee-homme": {
    id: "chemise-brodee-homme",
    name: "Chemise Brodée Homme",
    price: 45_000,
    imageUrl: unsplash(PHOTO.menCollection, { w: 900, h: 1125 }),
    href: PRODUCT_HREF,
  },
  "collier-bronze-martele": {
    id: "collier-bronze-martele",
    name: "Collier Bronze Martelé",
    price: 32_000,
    imageUrl: unsplash(PHOTO.jewelryClose, { w: 900, h: 1125 }),
    badge: "Nouveau",
    href: PRODUCT_HREF,
  },
  "panier-tisse-raphia": {
    id: "panier-tisse-raphia",
    name: "Panier Tissé Raphia",
    price: 24_000,
    imageUrl: unsplash(PHOTO.homeDecor, { w: 900, h: 1125 }),
    href: PRODUCT_HREF,
  },
  "etole-indigo-tissee": {
    id: "etole-indigo-tissee",
    name: "Étole Indigo Tissée Main",
    price: 42_000,
    compareAtPrice: 52_000,
    imageUrl: unsplash(PHOTO.indigoTexture, { w: 900, h: 1125 }),
    badge: "-19%",
    href: PRODUCT_HREF,
  },
  "boucles-oreilles-laiton": {
    id: "boucles-oreilles-laiton",
    name: "Boucles d'Oreilles Laiton",
    price: 18_000,
    imageUrl: unsplash(PHOTO.jewelryPendant, { w: 900, h: 1125 }),
    href: PRODUCT_HREF,
  },
  "boubou-indigo-tisse": {
    id: "boubou-indigo-tisse",
    name: "Boubou Indigo Tissé Main",
    price: 145_000,
    imageUrl: unsplash(PHOTO.womenCollection, { w: 900, h: 1125 }),
    badge: "Édition limitée",
    href: "/demo/teranga-atelier/produit/boubou-indigo-tisse",
  },
  "sac-panier-raphia": {
    id: "sac-panier-raphia",
    name: "Sac Panier Raphia",
    price: 29_000,
    imageUrl: unsplash(PHOTO.homeDecor, { w: 900, h: 1125 }),
    href: PRODUCT_HREF,
  },
  "coussin-tisse-terracotta": {
    id: "coussin-tisse-terracotta",
    name: "Coussin Tissé Terracotta",
    price: 22_000,
    imageUrl: unsplash(PHOTO.basketWeaveTexture, { w: 900, h: 1125 }),
    href: PRODUCT_HREF,
  },
  "plateau-bois-artisanal": {
    id: "plateau-bois-artisanal",
    name: "Plateau en Bois Sculpté",
    price: 26_000,
    imageUrl: unsplash(PHOTO.woodenTableware, { w: 900, h: 1125 }),
    href: PRODUCT_HREF,
  },
};

const PROMOTION_CATALOG: Record<string, ResolvedPromotionsContent> = {
  TERANGA10: {
    headline: "-10% sur la première commande",
    description: "Code TERANGA10, valable pour toute nouvelle cliente ou nouveau client.",
    discountLabel: "-10%",
    ctaLabel: "En profiter",
    ctaHref: "/catalogue",
  },
};

export const DEMO_NAV_ITEMS: NavItem[] = [
  {
    label: "Femmes",
    href: "/catalogue/femmes",
    megaMenu: {
      columns: [
        {
          title: "Vêtements",
          links: [
            { label: "Robes", href: "/catalogue/femmes/robes" },
            { label: "Ensembles", href: "/catalogue/femmes/ensembles" },
          ],
        },
      ],
      featured: {
        imageUrl: unsplash(PHOTO.womenCollection, { w: 900, h: 1125 }),
        title: "La collection Harmattan",
        href: "/catalogue/femmes",
        ctaLabel: "Découvrir",
      },
    },
  },
  { label: "Hommes", href: "/catalogue/hommes" },
  { label: "Maison", href: "/catalogue/maison" },
  { label: "Bijoux", href: "/catalogue/bijoux" },
  { label: "Créateurs", href: "#createurs" },
  { label: "Contact", href: "#contact" },
];

export const DEMO_CART_LINES: CartLine[] = [
  {
    id: "robe-wax-structuree",
    name: "Robe Wax Structurée",
    price: 68_000,
    quantity: 1,
    variant: "Taille M",
    imageUrl: unsplash(PHOTO.womenCollection, { w: 400, h: 500 }),
  },
];

export const DEMO_SEARCH_SUGGESTIONS: SearchSuggestion[] = [
  { label: "Robes", href: "/catalogue/femmes" },
  { label: "Bijoux bronze", href: "/catalogue/bijoux" },
  { label: "Décoration", href: "/catalogue/maison" },
  { label: "Éditions limitées", href: "/catalogue?tri=limitee" },
];

const DESIGNER_CATALOG: Record<string, DesignerProfileData> = {
  "aissatou-diop": {
    id: "aissatou-diop",
    name: "Aïssatou Diop",
    specialty: "Bijouterie",
    region: "Dakar",
    bio: "Formée à la fonte à la cire perdue, Aïssatou façonne chaque bijou dans son atelier de la Médina. Elle travaille le bronze et le laiton, martelés et coulés à la main.",
    photoUrl: unsplash(PHOTO.portraitWoman1, { w: 1000, h: 1250 }),
    workshopPhotoUrl: unsplash(PHOTO.craftsmanPortrait, { w: 2000, h: 900 }),
    quote: "Chaque pièce doit pouvoir se transmettre, pas seulement se porter.",
  },
  "moussa-sarr": {
    id: "moussa-sarr",
    name: "Moussa Sarr",
    specialty: "Prêt-à-porter homme",
    region: "Saint-Louis",
    bio: "Moussa réinvente la chemise traditionnelle avec des coupes contemporaines et une broderie main héritée de la tradition signare de Saint-Louis.",
    photoUrl: unsplash(PHOTO.portraitMan1, { w: 1000, h: 1250 }),
    quote: "La broderie, c'est une écriture qu'on porte sur soi.",
  },
  "fatou-ndiaye": {
    id: "fatou-ndiaye",
    name: "Fatou Ndiaye",
    specialty: "Tissage & décoration",
    region: "Casamance",
    bio: "Fatou perpétue le tissage sur métier traditionnel appris auprès de sa grand-mère, aujourd'hui réinterprété en coussins, paniers et pièces de décoration contemporaines.",
    photoUrl: unsplash(PHOTO.portraitWoman2, { w: 1000, h: 1250 }),
    workshopPhotoUrl: unsplash(PHOTO.indigoTexture, { w: 2000, h: 900 }),
    quote: "Le fil raconte autant que la couleur.",
  },
};

const DESIGNER_PRODUCTS: Record<string, string[]> = {
  "aissatou-diop": ["collier-bronze-martele", "boucles-oreilles-laiton"],
  "moussa-sarr": ["chemise-brodee-homme"],
  "fatou-ndiaye": [
    "panier-tisse-raphia",
    "sac-panier-raphia",
    "coussin-tisse-terracotta",
    "boubou-indigo-tisse",
    "etole-indigo-tissee",
    "plateau-bois-artisanal",
  ],
};

export function getDesignerByHandle(handle: string): DesignerProfileData | undefined {
  return DESIGNER_CATALOG[handle];
}

export function getAllDesignerHandles(): string[] {
  return Object.keys(DESIGNER_CATALOG);
}

export function getProductsByDesigner(handle: string): ResolvedProductsContent {
  const designer = DESIGNER_CATALOG[handle];
  const ids = DESIGNER_PRODUCTS[handle] ?? [];
  return {
    title: designer ? `Créations de ${designer.name}` : undefined,
    products: ids.map((id) => PRODUCT_CATALOG[id]!),
  };
}

export const DEMO_RESOLVED_CONTENT: ResolvedContentBySectionId = {
  "categories-1": {
    categories: ["femmes", "hommes", "maison", "bijoux"].map((id) => CATEGORY_CATALOG[id]!),
  },
  "designers-1": {
    designers: ["aissatou-diop", "moussa-sarr", "fatou-ndiaye"].map((id) => {
      const designer = DESIGNER_CATALOG[id]!;
      return {
        id: designer.id,
        name: designer.name,
        specialty: designer.specialty,
        photoUrl: designer.photoUrl,
        href: `/demo/teranga-atelier/createur/${designer.id}`,
        productCount: (DESIGNER_PRODUCTS[id] ?? []).length,
      };
    }),
  } satisfies ResolvedDesignersContent,
  "featured-1": {
    products: [
      "robe-wax-structuree",
      "chemise-brodee-homme",
      "collier-bronze-martele",
      "panier-tisse-raphia",
      "etole-indigo-tissee",
      "boucles-oreilles-laiton",
    ].map((id) => PRODUCT_CATALOG[id]!),
  },
};

const PRODUCT_DETAILS_BY_HANDLE: Record<string, ProductDetailData> = {
  "robe-wax-structuree": {
    id: "robe-wax-structuree",
    name: "Robe Wax Structurée",
    price: 68_000,
    description:
      "Une robe à la coupe structurée, taillée dans un wax de coton imprimé et doublée de coton uni. Fermeture invisible au dos, poches latérales.",
    materialNote: "100% coton wax, doublure coton. Confection à l'atelier Teranga Atelier, Dakar.",
    images: [
      unsplash(PHOTO.womenCollection, { w: 1200, h: 1500 }),
      unsplash(PHOTO.indigoTexture, { w: 1200, h: 1500 }),
    ],
    colors: [
      { label: "Terracotta", hex: "var(--color-secondary)" },
      { label: "Indigo", hex: "var(--color-primary)" },
    ],
    sizes: ["S", "M", "L", "XL"],
    inStock: true,
    href: PRODUCT_HREF,
    sizeGuideRows: SIZE_GUIDE_CLOTHING,
  },
  "boubou-indigo-tisse": {
    id: "boubou-indigo-tisse",
    name: "Boubou Indigo Tissé Main",
    price: 145_000,
    description:
      "Coton filé et teint à l'indigo naturel, tissé à la main sur métier traditionnel en Casamance. Édition limitée à 12 pièces — chacune très légèrement unique du fait du tissage manuel.",
    materialNote:
      "100% coton filé main, teinture indigo naturelle (Lonchocarpus cyanescens). Tissage traditionnel casamançais.",
    images: [
      unsplash(PHOTO.womenCollection, { w: 1200, h: 1500 }),
      unsplash(PHOTO.indigoTexture, { w: 1200, h: 1500 }),
    ],
    colors: [{ label: "Indigo naturel", hex: "var(--color-primary)" }],
    sizes: ["S", "M", "L"],
    inStock: true,
    href: "/demo/teranga-atelier/produit/boubou-indigo-tisse",
    sizeGuideRows: SIZE_GUIDE_CLOTHING,
  },
};

export function getProductByHandle(handle: string): ProductDetailData | undefined {
  return PRODUCT_DETAILS_BY_HANDLE[handle];
}

export function getAllProductHandles(): string[] {
  return Object.keys(PRODUCT_DETAILS_BY_HANDLE);
}

export const DEMO_RELATED_PRODUCT_IDS = [
  "etole-indigo-tissee",
  "collier-bronze-martele",
  "panier-tisse-raphia",
];

export function getRelatedProducts(): ResolvedProductsContent {
  return {
    title: "Vous aimerez aussi",
    products: DEMO_RELATED_PRODUCT_IDS.map((id) => PRODUCT_CATALOG[id]!),
  };
}

export const DEMO_FOOTER_GROUPS = [
  {
    title: "Boutique",
    links: [
      { label: "Toute la collection", href: "/catalogue" },
      { label: "Créateurs", href: "#createurs" },
    ],
  },
  {
    title: "Aide",
    links: [
      { label: "Livraison internationale", href: "/livraison" },
      { label: "Retours", href: "/retours" },
      { label: "Contact", href: "#contact" },
    ],
  },
  {
    title: "Légal",
    links: [
      { label: "Mentions légales", href: "/mentions-legales" },
      { label: "Confidentialité", href: "/confidentialite" },
    ],
  },
];
