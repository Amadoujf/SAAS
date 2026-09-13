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
 * Données de démonstration du template « Commerce moderne et dynamique » — troisième
 * des trois premiers templates e-commerce (voir docs/09, Phase 1), pour une marque de
 * streetwear/sneakers fictive « Sunu Kicks ». Structurellement différent des deux
 * autres : pas de storytelling éditorial (comme « Luxe minimaliste »), pas de densité
 * catalogue pure (comme « Marketplace ») — ici, l'accent est mis sur l'énergie visuelle
 * : hero fractionné avec image d'action, cartes de bénéfices encadrées, galerie de
 * produits/détails, animations plus rapides et plus visibles. Même moteur de rendu et
 * même catalogue de sections que les deux autres ; la différence vient des tokens, des
 * variantes choisies par section et du contenu.
 */

function unsplash(photoId: string, { w = 1600, h }: { w?: number; h?: number } = {}): string {
  const params = new URLSearchParams({ q: "80", fm: "jpg", fit: "crop", w: String(w) });
  if (h) params.set("h", String(h));
  return `https://images.unsplash.com/${photoId}?${params.toString()}`;
}

const PHOTO = {
  skaterTrick: "photo-1639262501783-c273044c71cc",
  basketballDunk: "photo-1755418486245-db81809d16a8",
  sneakerRedBg: "photo-1514388614019-c755c395185c",
  sneakerRedRain: "photo-1783139965231-9ecfc25eaf45",
  sneakerHighTop: "photo-1545934507-46aad1d43487",
  sneakerRunning: "photo-1759674804375-3d0c038a0a6a",
  hoodie: "photo-1668441515735-39c4331a1fcb",
  beanie: "photo-1543610892-0b1f7e6d8ac1",
  joggersRooftop: "photo-1569206700565-35dfc9456b80",
  bomberJacket: "photo-1555991610-dc16d095c6f5",
  backpack: "photo-1591534577302-1696205bb2bc",
  cap: "photo-1691256676359-20e5c6d4bc92",
  sunglasses: "photo-1693482721913-1b342153ebe4",
  leatherStitching: "photo-1763674292700-317879c2038c",
  fabricTexture: "photo-1693592560460-60dc6d52dc21",
} as const;

export const COMMERCE_MODERNE_DESIGN_TOKENS: DesignTokens = {
  // Palette énergique : charbon quasi noir + orange vif, fond blanc net — à l'opposé
  // de l'ivoire/noir profond de « Luxe minimaliste » et du bleu/jaune « confiance » de
  // « Marketplace » (voir la revue du 16 septembre 2026 sur les tokens d'accent).
  colors: {
    primary: "#16181D",
    secondary: "#FF5A1F",
    background: "#FFFFFF",
    surface: "#F4F5F7",
    surfaceMuted: "#E8EAED",
    textPrimary: "#16181D",
    textSecondary: "#4B4F58",
    textMuted: "#8A8F98",
    border: "#E2E4E8",
    success: "#1FA463",
    danger: "#E23B3B",
    warning: "#E2A03B",
    accentPrimary: "#FF5A1F",
    accentSecondary: "#2D6CF6",
    leather: "#8A5A34",
    champagne: "#F5D68C",
    overlay: "rgba(22, 24, 29, 0.55)",
    mutedSurface: "#1F2128",
  },
  typography: {
    headingFont:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    bodyFont:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    // Échelle fluide, énergique mais moins extrême que « Luxe minimaliste » (celle-ci
    // est éditoriale/cinématographique ; ici on veut du "poster" percutant, pas un
    // hero-titre géant).
    headingSizes: {
      xs: "1.125rem",
      sm: "1.5rem",
      md: "clamp(1.75rem, 1.5rem + 1vw, 2.25rem)",
      lg: "clamp(2rem, 1.6rem + 2vw, 3rem)",
      xl: "clamp(2.5rem, 1.8rem + 3vw, 4rem)",
      "2xl": "clamp(2.75rem, 1.8rem + 4.5vw, 5rem)",
      "3xl": "clamp(3rem, 1.8rem + 6vw, 6rem)",
      "4xl": "clamp(3.25rem, 1.5rem + 8vw, 7rem)",
    },
    bodySizes: { xs: "0.75rem", sm: "0.875rem", md: "1rem", lg: "1.125rem", xl: "1.375rem" },
  },
  spacing: { scale: ["0px", "4px", "8px", "12px", "16px", "24px", "32px", "48px", "64px", "96px"] },
  borders: { width: "2px", color: "#16181D" },
  radii: { sm: "4px", md: "8px", lg: "16px", full: "9999px" },
  shadows: {
    sm: "0 2px 4px rgba(22,24,29,0.08)",
    md: "0 8px 20px rgba(22,24,29,0.12)",
    lg: "0 20px 48px rgba(22,24,29,0.2)",
  },
  layout: { contentMaxWidth: "1440px" },
  // Boutons pilule + taille "md" (compacte et nerveuse) — contraste direct avec les
  // boutons carrés "lg" de « Luxe minimaliste ».
  buttonStyle: { shape: "pill", size: "md", variant: "solid" },
  cardStyle: { radius: "md", shadow: "md", border: true },
  headerStyle: { variant: "solid", height: "80px" },
  footerStyle: { variant: "expanded" },
  formStyle: { inputRadius: "md", inputBorderStyle: "solid" },
  animation: {
    // "immersive" mais avec des durées BEAUCOUP plus courtes qu'un template éditorial —
    // l'énergie vient de la vitesse et de la fréquence des animations, pas de leur
    // ampleur lente et posée (voir « Luxe minimaliste », durées 2 à 4x plus longues).
    level: "immersive",
    durations: { fast: 120, base: 220, slow: 360 },
    easing: {
      standard: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      decelerate: "cubic-bezier(0, 0, 0.2, 1)",
      accelerate: "cubic-bezier(0.4, 0, 1, 1)",
    },
  },
};

export const SHOP_NAME = "Sunu Kicks";
export const WHATSAPP_NUMBER = "+221701234567";
export const SHOP_TAGLINE = {
  fr: "Sneakers et streetwear sélectionnés pour la rue, livrés partout au Sénégal.",
  en: "Sneakers and streetwear picked for the street, delivered across Senegal.",
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
          variant: "split",
          order: 0,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            eyebrow: "Nouveau drop",
            title: "La rue est votre terrain",
            subtitle: "Sneakers et streetwear pensés pour Dakar, portés partout ailleurs.",
            media: {
              url: unsplash(PHOTO.skaterTrick, { w: 1800 }),
              alt: "Skateur en pleine figure dans la rue",
            },
            ctaLabel: "Voir le drop",
            ctaHref: "/catalogue",
          },
        },
        {
          id: "categories-1",
          sectionKey: "categories",
          variant: "grid",
          order: 1,
          isEnabled: true,
          animationOverride: "inherit",
          params: { categoryIds: ["sneakers", "streetwear", "accessoires", "editions-limitees"] },
        },
        {
          id: "featured-1",
          sectionKey: "featured_products",
          variant: "grid",
          order: 2,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            productIds: [
              "sneaker-blanche-rouge",
              "hoodie-graphique",
              "sneaker-montante-grise",
              "casquette-blanche",
            ],
          },
        },
        {
          id: "promo-1",
          sectionKey: "promotions",
          variant: "split",
          order: 3,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            title: "Drop Exclusif",
            promoCodeIds: ["DUNK15"],
            media: { url: unsplash(PHOTO.basketballDunk, { w: 1600 }) },
          },
        },
        {
          id: "new-arrivals-1",
          sectionKey: "new_arrivals",
          variant: "carousel",
          order: 4,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            productIds: [
              "sneaker-rouge-street",
              "bombers-vert",
              "sac-a-dos-gris",
              "lunettes-aviator",
            ],
          },
        },
        {
          id: "benefits-1",
          sectionKey: "benefits",
          variant: "cards",
          order: 5,
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
                icon: "shield",
                title: "Paiement sécurisé",
                description: "Wave, Orange Money, Free Money, carte.",
              },
              {
                icon: "return",
                title: "Retours sous 14 jours",
                description: "Taille pas bonne ? On échange.",
              },
            ],
          },
        },
        {
          id: "testimonials-1",
          sectionKey: "testimonials",
          variant: "grid",
          order: 6,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            items: [
              {
                author: "Malick Fall",
                quote: "Les sneakers rouges cassent tout, j'ai eu que des compliments.",
                rating: 5,
              },
              {
                author: "Aïda Sy",
                quote: "Livraison rapide et le hoodie est encore mieux qu'en photo.",
                rating: 5,
              },
              {
                author: "Cheikh Ba",
                quote: "Bonne qualité pour le prix, je recommande.",
                rating: 4,
              },
            ],
          },
        },
        {
          id: "gallery-1",
          sectionKey: "gallery",
          variant: "grid",
          order: 7,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            title: "Dans la rue",
            images: [
              {
                url: unsplash(PHOTO.sneakerRedBg, { w: 900, h: 900 }),
                alt: "Sneakers sur fond rouge",
              },
              { url: unsplash(PHOTO.hoodie, { w: 900, h: 900 }), alt: "Hoodie graphique" },
              { url: unsplash(PHOTO.backpack, { w: 900, h: 900 }), alt: "Sac à dos urbain" },
              {
                url: unsplash(PHOTO.leatherStitching, { w: 900, h: 900 }),
                alt: "Détail de couture",
              },
              { url: unsplash(PHOTO.fabricTexture, { w: 900, h: 900 }), alt: "Texture textile" },
              { url: unsplash(PHOTO.cap, { w: 900, h: 900 }), alt: "Casquette snapback" },
            ],
          },
        },
        {
          id: "newsletter-1",
          sectionKey: "newsletter",
          variant: "banner",
          order: 8,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            title: "Ne rate aucun drop",
            description: "Les nouveautés et les ventes flash direct dans ta boîte mail.",
          },
        },
        {
          id: "faq-1",
          sectionKey: "faq",
          variant: "two-column",
          order: 9,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            items: [
              {
                question: "Quels sont les délais de livraison ?",
                answer: "24h à Dakar, 3 à 5 jours ailleurs au Sénégal.",
              },
              {
                question: "Puis-je échanger une taille ?",
                answer: "Oui, sous 14 jours, article non porté.",
              },
              {
                question: "Quels moyens de paiement ?",
                answer: "Wave, Orange Money, Free Money, carte bancaire.",
              },
            ],
          },
        },
        {
          id: "cta-1",
          sectionKey: "cta",
          variant: "split",
          order: 10,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            title: "Le prochain drop arrive vite",
            description: "Ne rate pas la prochaine sortie limitée.",
            buttonLabel: "Voir la collection",
            buttonHref: "/catalogue",
          },
        },
        {
          id: "whatsapp-1",
          sectionKey: "whatsapp",
          variant: "floating-button",
          order: 11,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            phoneNumber: WHATSAPP_NUMBER,
            defaultMessage: "Bonjour, j'ai une question sur un article Sunu Kicks.",
          },
        },
      ],
    },
  ],
};

export const DEMO_MANIFEST: TemplateManifest = validateTemplateManifest(RAW_DEMO_MANIFEST);

const CATEGORY_CATALOG: Record<string, ResolvedCategoriesContent["categories"][number]> = {
  sneakers: {
    id: "sneakers",
    name: "Sneakers",
    imageUrl: unsplash(PHOTO.sneakerHighTop, { w: 1000, h: 1000 }),
    href: "/catalogue/sneakers",
  },
  streetwear: {
    id: "streetwear",
    name: "Streetwear",
    imageUrl: unsplash(PHOTO.hoodie, { w: 1000, h: 1000 }),
    href: "/catalogue/streetwear",
  },
  accessoires: {
    id: "accessoires",
    name: "Accessoires",
    imageUrl: unsplash(PHOTO.backpack, { w: 1000, h: 1000 }),
    href: "/catalogue/accessoires",
  },
  "editions-limitees": {
    id: "editions-limitees",
    name: "Éditions Limitées",
    imageUrl: unsplash(PHOTO.leatherStitching, { w: 1000, h: 1000 }),
    href: "/catalogue/editions-limitees",
  },
};

const PRODUCT_HREF = "/demo/commerce-moderne/produit/sneaker-blanche-rouge";

const PRODUCT_CATALOG: Record<string, ResolvedProductsContent["products"][number]> = {
  "sneaker-blanche-rouge": {
    id: "sneaker-blanche-rouge",
    name: "Sneakers Blanches Édition Rouge",
    price: 45_000,
    imageUrl: unsplash(PHOTO.sneakerRedBg, { w: 900, h: 1125 }),
    hoverImageUrl: unsplash(PHOTO.fabricTexture, { w: 900, h: 1125 }),
    badge: "Best-seller",
    href: PRODUCT_HREF,
  },
  "sneaker-rouge-street": {
    id: "sneaker-rouge-street",
    name: "Sneakers Rouges Street",
    price: 42_000,
    imageUrl: unsplash(PHOTO.sneakerRedRain, { w: 900, h: 1125 }),
    href: PRODUCT_HREF,
  },
  "sneaker-montante-grise": {
    id: "sneaker-montante-grise",
    name: "Sneakers Montantes Grises",
    price: 48_000,
    imageUrl: unsplash(PHOTO.sneakerHighTop, { w: 900, h: 1125 }),
    href: PRODUCT_HREF,
  },
  "sneaker-running": {
    id: "sneaker-running",
    name: "Sneakers Running Performance",
    price: 39_000,
    imageUrl: unsplash(PHOTO.sneakerRunning, { w: 900, h: 1125 }),
    href: PRODUCT_HREF,
  },
  "hoodie-graphique": {
    id: "hoodie-graphique",
    name: "Hoodie Graphique",
    price: 28_000,
    imageUrl: unsplash(PHOTO.hoodie, { w: 900, h: 1125 }),
    badge: "Nouveau",
    href: PRODUCT_HREF,
  },
  "bonnet-cotele": {
    id: "bonnet-cotele",
    name: "Bonnet Côtelé Noir",
    price: 9_500,
    imageUrl: unsplash(PHOTO.beanie, { w: 900, h: 1125 }),
    href: PRODUCT_HREF,
  },
  "jogger-urbain": {
    id: "jogger-urbain",
    name: "Jogger Urbain",
    price: 22_000,
    imageUrl: unsplash(PHOTO.joggersRooftop, { w: 900, h: 1125 }),
    href: PRODUCT_HREF,
  },
  "bombers-vert": {
    id: "bombers-vert",
    name: "Bomber Vert Kaki",
    price: 35_000,
    compareAtPrice: 42_000,
    imageUrl: unsplash(PHOTO.bomberJacket, { w: 900, h: 1125 }),
    badge: "-17%",
    href: PRODUCT_HREF,
  },
  "sac-a-dos-gris": {
    id: "sac-a-dos-gris",
    name: "Sac à Dos Urbain",
    price: 18_000,
    imageUrl: unsplash(PHOTO.backpack, { w: 900, h: 1125 }),
    href: PRODUCT_HREF,
  },
  "casquette-blanche": {
    id: "casquette-blanche",
    name: "Casquette Snapback Blanche",
    price: 8_500,
    imageUrl: unsplash(PHOTO.cap, { w: 900, h: 1125 }),
    href: PRODUCT_HREF,
  },
  "lunettes-aviator": {
    id: "lunettes-aviator",
    name: "Lunettes Aviator",
    price: 14_000,
    imageUrl: unsplash(PHOTO.sunglasses, { w: 900, h: 1125 }),
    href: PRODUCT_HREF,
  },
};

const PROMOTION_CATALOG: Record<string, ResolvedPromotionsContent> = {
  DUNK15: {
    headline: "-15% sur toute la collection sneakers",
    description: "Code DUNK15 valable cette semaine seulement.",
    discountLabel: "-15%",
    ctaLabel: "J'en profite",
    ctaHref: "/catalogue",
  },
};

export const DEMO_NAV_ITEMS: NavItem[] = [
  {
    label: "Sneakers",
    href: "/catalogue/sneakers",
    megaMenu: {
      columns: [
        {
          title: "Styles",
          links: [
            { label: "Basses", href: "/catalogue/sneakers/basses" },
            { label: "Montantes", href: "/catalogue/sneakers/montantes" },
            { label: "Running", href: "/catalogue/sneakers/running" },
          ],
        },
      ],
      featured: {
        imageUrl: unsplash(PHOTO.sneakerRedBg, { w: 900, h: 1125 }),
        title: "Le drop de la semaine",
        href: "/catalogue/sneakers",
        ctaLabel: "Découvrir",
      },
    },
  },
  {
    label: "Streetwear",
    href: "/catalogue/streetwear",
    megaMenu: {
      columns: [
        {
          title: "Vêtements",
          links: [
            { label: "Hoodies", href: "/catalogue/streetwear/hoodies" },
            { label: "Joggers", href: "/catalogue/streetwear/joggers" },
            { label: "Vestes", href: "/catalogue/streetwear/vestes" },
          ],
        },
      ],
      featured: {
        imageUrl: unsplash(PHOTO.bomberJacket, { w: 900, h: 1125 }),
        title: "Nouvelle collection",
        href: "/catalogue/streetwear",
        ctaLabel: "Découvrir",
      },
    },
  },
  { label: "Accessoires", href: "/catalogue/accessoires" },
  { label: "Contact", href: "#contact" },
];

export const DEMO_CART_LINES: CartLine[] = [
  {
    id: "sneaker-blanche-rouge",
    name: "Sneakers Blanches Édition Rouge",
    price: 45_000,
    quantity: 1,
    variant: "Pointure 42",
    imageUrl: unsplash(PHOTO.sneakerRedBg, { w: 400, h: 500 }),
  },
  {
    id: "hoodie-graphique",
    name: "Hoodie Graphique",
    price: 28_000,
    quantity: 1,
    variant: "Taille M",
    imageUrl: unsplash(PHOTO.hoodie, { w: 400, h: 500 }),
  },
];

export const DEMO_SEARCH_SUGGESTIONS: SearchSuggestion[] = [
  { label: "Sneakers rouges", href: "/catalogue/sneakers" },
  { label: "Hoodies", href: "/catalogue/streetwear" },
  { label: "Casquettes", href: "/catalogue/accessoires" },
  { label: "Nouveautés", href: "/catalogue?tri=nouveaute" },
];

export const DEMO_RESOLVED_CONTENT: ResolvedContentBySectionId = {
  "categories-1": {
    categories: ["sneakers", "streetwear", "accessoires", "editions-limitees"].map(
      (id) => CATEGORY_CATALOG[id]!,
    ),
  },
  "featured-1": {
    products: [
      "sneaker-blanche-rouge",
      "hoodie-graphique",
      "sneaker-montante-grise",
      "casquette-blanche",
    ].map((id) => PRODUCT_CATALOG[id]!),
  },
  "promo-1": PROMOTION_CATALOG.DUNK15!,
  "new-arrivals-1": {
    products: ["sneaker-rouge-street", "bombers-vert", "sac-a-dos-gris", "lunettes-aviator"].map(
      (id) => PRODUCT_CATALOG[id]!,
    ),
  },
};

const PRODUCT_DETAILS_BY_HANDLE: Record<string, ProductDetailData> = {
  "sneaker-blanche-rouge": {
    id: "sneaker-blanche-rouge",
    name: "Sneakers Blanches Édition Rouge",
    price: 45_000,
    description:
      "Une sneaker basse en toile résistante, semelle grip renforcée pour la ville comme pour le skate. L'édition rouge est limitée à ce drop.",
    materialNote: "Tige toile technique, semelle caoutchouc haute adhérence, doublure respirante.",
    images: [
      unsplash(PHOTO.sneakerRedBg, { w: 1200, h: 1500 }),
      unsplash(PHOTO.fabricTexture, { w: 1200, h: 1500 }),
      unsplash(PHOTO.sneakerRedRain, { w: 1200, h: 1500 }),
    ],
    colors: [
      { label: "Rouge", hex: "var(--color-secondary)" },
      { label: "Noir", hex: "var(--color-primary)" },
    ],
    sizes: ["40", "41", "42", "43", "44"],
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
  "hoodie-graphique",
  "casquette-blanche",
  "sac-a-dos-gris",
  "bonnet-cotele",
];

export function getRelatedProducts(): ResolvedProductsContent {
  return {
    title: "Complète le look",
    products: DEMO_RELATED_PRODUCT_IDS.map((id) => PRODUCT_CATALOG[id]!),
  };
}

export const DEMO_FOOTER_GROUPS = [
  {
    title: "Boutique",
    links: [
      { label: "Toute la collection", href: "/catalogue" },
      { label: "Nouveautés", href: "/catalogue?tri=nouveaute" },
    ],
  },
  {
    title: "Aide",
    links: [
      { label: "Livraison", href: "/livraison" },
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
