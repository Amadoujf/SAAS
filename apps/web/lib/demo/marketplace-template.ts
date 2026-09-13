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
 * Données de démonstration du template « Marketplace riche en produits » — deuxième
 * des trois premiers templates e-commerce (voir docs/09, Phase 1). Volontairement
 * STRUCTURELLEMENT différent de « Luxe minimaliste », pas seulement recoloré : pas de
 * hero cinématographique plein écran, pas de section manifeste/héritage/signature —
 * ici, tout pousse vers la densité de catalogue (beaucoup de produits visibles, en-tête
 * toujours solide, typographie compacte, animations discrètes). Réutilise le même
 * moteur de rendu et le même catalogue de sections que « Luxe minimaliste » : la
 * différence structurelle vient du CHOIX des sections, de leurs variantes, et des
 * tokens — pas de nouveau code de section.
 *
 * Photographie : Unsplash (CDN `images.unsplash.com`), catalogue produit propre —
 * fonds neutres/studio plutôt qu'éditorial, cohérent avec un marketplace généraliste.
 */

function unsplash(photoId: string, { w = 1600, h }: { w?: number; h?: number } = {}): string {
  const params = new URLSearchParams({ q: "80", fm: "jpg", fit: "crop", w: String(w) });
  if (h) params.set("h", String(h));
  return `https://images.unsplash.com/${photoId}?${params.toString()}`;
}

const PHOTO = {
  heroBags: "photo-1760565030243-c92ed557e8da",
  phoneBlack: "photo-1617300040847-369dee9d35f1",
  phoneWhite: "photo-1562147458-0c12e8d29f50",
  earbuds: "photo-1572569979132-b4f10c9ec185",
  smartwatchSport: "photo-1639564879163-a2a85682410e",
  smartwatchRound: "photo-1523275335684-37898b6baf30",
  laptop: "photo-1611186871348-b1ce696e52c9",
  toaster: "photo-1686644823126-7ed947386b77",
  cookware: "photo-1584990347193-6bebebfeaeee",
  cookwareAlt: "photo-1604414499020-f9ac575bc5ec",
  potPlant: "photo-1618220179428-22790b461013",
  perfume: "photo-1619352704218-ab07491b9353",
  perfumeAlt: "photo-1630344360804-acaab8f80b99",
  skincareSet: "photo-1552046122-03184de85e08",
  sunglasses: "photo-1523884156331-22cc4f5df98d",
  sunglassesAlt: "photo-1506359368206-1c055e47e971",
  bagSling: "photo-1600857062241-98e5dba7f214",
  packageBox: "photo-1573376670774-4427757f7963",
} as const;

export const MARKETPLACE_DESIGN_TOKENS: DesignTokens = {
  // Palette « marketplace de confiance » : bleu sapphire + jaune/orange « bon plan »,
  // fond blanc net — volontairement à l'opposé de l'ivoire/noir profond de « Luxe
  // minimaliste » (voir la revue du 16 septembre 2026 sur les tokens d'accent).
  colors: {
    primary: "#0F52BA",
    secondary: "#FFB020",
    background: "#FFFFFF",
    surface: "#F7F8FA",
    surfaceMuted: "#EEF1F5",
    textPrimary: "#1A1F36",
    textSecondary: "#4B5468",
    textMuted: "#8891A5",
    border: "#E3E7EE",
    success: "#1FA463",
    danger: "#E23B3B",
    warning: "#B9790A",
    accentPrimary: "#FFB020",
    accentSecondary: "#0F52BA",
    leather: "#8A5A34",
    champagne: "#FFE29A",
    overlay: "rgba(15, 15, 20, 0.5)",
    mutedSurface: "#151A2E",
  },
  typography: {
    headingFont:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    bodyFont:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    // Échelle nettement plus compacte que « Luxe minimaliste » : un marketplace
    // privilégie la densité d'information à la démonstration typographique — voir la
    // note de structure ci-dessus.
    headingSizes: {
      xs: "1rem",
      sm: "1.25rem",
      md: "1.5rem",
      lg: "1.875rem",
      xl: "2.25rem",
      "2xl": "2.75rem",
      "3xl": "3.25rem",
      "4xl": "3.75rem",
    },
    bodySizes: { xs: "0.75rem", sm: "0.8125rem", md: "0.9375rem", lg: "1.0625rem", xl: "1.25rem" },
  },
  spacing: { scale: ["0px", "4px", "8px", "12px", "16px", "24px", "32px", "48px", "64px", "96px"] },
  borders: { width: "1px", color: "#E3E7EE" },
  radii: { sm: "4px", md: "6px", lg: "10px", full: "9999px" },
  shadows: {
    sm: "0 1px 2px rgba(15,31,54,0.06)",
    md: "0 6px 16px rgba(15,31,54,0.08)",
    lg: "0 16px 40px rgba(15,31,54,0.14)",
  },
  layout: { contentMaxWidth: "1560px" },
  buttonStyle: { shape: "rounded", size: "sm", variant: "solid" },
  cardStyle: { radius: "sm", shadow: "sm", border: true },
  // Toujours solide (jamais transparent-sur-hero) : le hero d'un marketplace n'est pas
  // une image cinématographique plein cadre, la transparence n'aurait pas de sens.
  headerStyle: { variant: "solid", height: "72px" },
  footerStyle: { variant: "expanded" },
  formStyle: { inputRadius: "sm", inputBorderStyle: "solid" },
  animation: {
    // "discreet" : un marketplace privilégie l'efficacité, pas la démonstration —
    // contraste volontaire avec "dynamic"/"immersive" des deux autres templates.
    level: "discreet",
    durations: { fast: 100, base: 200, slow: 300 },
    easing: {
      standard: "cubic-bezier(0.4, 0, 0.2, 1)",
      decelerate: "cubic-bezier(0, 0, 0.2, 1)",
      accelerate: "cubic-bezier(0.4, 0, 1, 1)",
    },
  },
};

export const SHOP_NAME = "Sunu Marché";
export const WHATSAPP_NUMBER = "+221781234567";
export const SHOP_TAGLINE = {
  fr: "Des milliers de produits, des centaines de vendeurs vérifiés, livrés partout au Sénégal.",
  en: "Thousands of products, hundreds of verified sellers, delivered across Senegal.",
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
          variant: "centered",
          order: 0,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            eyebrow: "Sunu Marché",
            title: "Tout ce qu'il vous faut, livré partout au Sénégal",
            subtitle:
              "Électronique, maison, beauté et mode — des milliers de produits, des centaines de vendeurs, une seule livraison.",
            media: {
              url: unsplash(PHOTO.heroBags, { w: 2000 }),
              alt: "Client tenant plusieurs sacs de courses",
            },
            ctaLabel: "Explorer le catalogue",
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
          params: { categoryIds: ["electronique", "maison", "beaute", "mode"] },
        },
        {
          id: "featured-1",
          sectionKey: "featured_products",
          variant: "masonry",
          order: 2,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            productIds: [
              "smartphone-noir",
              "ecouteurs-sans-fil",
              "montre-connectee-sport",
              "grille-pain-inox",
              "parfum-homme",
              "lunettes-soleil",
            ],
          },
        },
        {
          id: "promo-1",
          sectionKey: "promotions",
          variant: "banner",
          order: 3,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            title: "Vente Flash",
            promoCodeIds: ["FLASH10"],
          },
        },
        {
          id: "new-arrivals-1",
          sectionKey: "new_arrivals",
          variant: "grid",
          order: 4,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            productIds: [
              "smartphone-blanc",
              "batterie-cuisine-inox",
              "coffret-soins-visage",
              "sac-bandouliere",
            ],
          },
        },
        {
          id: "benefits-1",
          sectionKey: "benefits",
          variant: "icons-row",
          order: 5,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            items: [
              {
                icon: "truck",
                title: "Livraison partout au Sénégal",
                description: "Dakar en 24h, régions en 2 à 4 jours.",
              },
              {
                icon: "shield",
                title: "Paiement sécurisé",
                description: "Wave, Orange Money, Free Money, carte.",
              },
              {
                icon: "return",
                title: "Retours faciles",
                description: "14 jours pour changer d'avis.",
              },
              {
                icon: "craft",
                title: "Vendeurs vérifiés",
                description: "Chaque boutique est contrôlée avant mise en ligne.",
              },
            ],
          },
        },
        {
          id: "testimonials-1",
          sectionKey: "testimonials",
          variant: "carousel",
          order: 6,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            items: [
              {
                author: "Fatou Ndiaye",
                quote: "Commande reçue en 24h à Dakar, exactement comme décrit sur le site.",
                rating: 5,
              },
              {
                author: "Ibrahima Sarr",
                quote: "Le service client répond vite sur WhatsApp, ça change tout.",
                rating: 5,
              },
              {
                author: "Aminata Diallo",
                quote:
                  "Beaucoup de choix pour la maison, meilleurs prix que ce que j'ai trouvé ailleurs.",
                rating: 4,
              },
            ],
          },
        },
        {
          id: "newsletter-1",
          sectionKey: "newsletter",
          variant: "inline",
          order: 7,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            title: "Les meilleures offres, chaque semaine",
            description: "Recevez les ventes flash avant tout le monde.",
          },
        },
        {
          id: "faq-1",
          sectionKey: "faq",
          variant: "accordion",
          order: 8,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            items: [
              {
                question: "Combien de temps prend la livraison ?",
                answer:
                  "24h à Dakar, 2 à 4 jours ouvrés dans le reste du Sénégal selon le vendeur.",
              },
              {
                question: "Puis-je payer à la livraison ?",
                answer: "Oui, en plus de Wave, Orange Money, Free Money et la carte bancaire.",
              },
              {
                question: "Comment sont sélectionnés les vendeurs ?",
                answer:
                  "Chaque boutique est vérifiée manuellement avant sa mise en ligne sur Sunu Marché.",
              },
            ],
          },
        },
        {
          id: "cta-1",
          sectionKey: "cta",
          variant: "banner",
          order: 9,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            title: "Prêt à trouver votre bonheur ?",
            description: "Des milliers de produits vous attendent sur Sunu Marché.",
            buttonLabel: "Voir le catalogue",
            buttonHref: "/catalogue",
          },
        },
        {
          id: "whatsapp-1",
          sectionKey: "whatsapp",
          variant: "floating-button",
          order: 10,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            phoneNumber: WHATSAPP_NUMBER,
            defaultMessage: "Bonjour, j'ai une question sur un produit Sunu Marché.",
          },
        },
      ],
    },
  ],
};

export const DEMO_MANIFEST: TemplateManifest = validateTemplateManifest(RAW_DEMO_MANIFEST);

const CATEGORY_CATALOG: Record<string, ResolvedCategoriesContent["categories"][number]> = {
  electronique: {
    id: "electronique",
    name: "Électronique",
    imageUrl: unsplash(PHOTO.phoneBlack, { w: 1000, h: 1000 }),
    href: "/catalogue/electronique",
  },
  maison: {
    id: "maison",
    name: "Maison & Cuisine",
    imageUrl: unsplash(PHOTO.cookware, { w: 1000, h: 1000 }),
    href: "/catalogue/maison",
  },
  beaute: {
    id: "beaute",
    name: "Beauté & Soins",
    imageUrl: unsplash(PHOTO.perfume, { w: 1000, h: 1000 }),
    href: "/catalogue/beaute",
  },
  mode: {
    id: "mode",
    name: "Mode & Accessoires",
    imageUrl: unsplash(PHOTO.sunglasses, { w: 1000, h: 1000 }),
    href: "/catalogue/mode",
  },
};

const PRODUCT_HREF = "/demo/marketplace/produit/smartphone-noir";

const PRODUCT_CATALOG: Record<string, ResolvedProductsContent["products"][number]> = {
  "smartphone-noir": {
    id: "smartphone-noir",
    name: "Smartphone 128 Go — Noir",
    price: 149_000,
    imageUrl: unsplash(PHOTO.phoneBlack, { w: 900, h: 1125 }),
    href: PRODUCT_HREF,
  },
  "smartphone-blanc": {
    id: "smartphone-blanc",
    name: "Smartphone 256 Go — Blanc",
    price: 189_000,
    imageUrl: unsplash(PHOTO.phoneWhite, { w: 900, h: 1125 }),
    badge: "Nouveau",
    href: PRODUCT_HREF,
  },
  "ecouteurs-sans-fil": {
    id: "ecouteurs-sans-fil",
    name: "Écouteurs Sans Fil",
    price: 24_500,
    imageUrl: unsplash(PHOTO.earbuds, { w: 900, h: 1125 }),
    href: PRODUCT_HREF,
  },
  "montre-connectee-sport": {
    id: "montre-connectee-sport",
    name: "Montre Connectée Sport",
    price: 39_000,
    imageUrl: unsplash(PHOTO.smartwatchSport, { w: 900, h: 1125 }),
    href: PRODUCT_HREF,
  },
  "montre-connectee-ronde": {
    id: "montre-connectee-ronde",
    name: "Montre Connectée Ronde",
    price: 45_000,
    imageUrl: unsplash(PHOTO.smartwatchRound, { w: 900, h: 1125 }),
    href: PRODUCT_HREF,
  },
  "ordinateur-portable": {
    id: "ordinateur-portable",
    name: 'Ordinateur Portable 14"',
    price: 385_000,
    imageUrl: unsplash(PHOTO.laptop, { w: 900, h: 1125 }),
    href: PRODUCT_HREF,
  },
  "grille-pain-inox": {
    id: "grille-pain-inox",
    name: "Grille-Pain Inox",
    price: 18_500,
    imageUrl: unsplash(PHOTO.toaster, { w: 900, h: 1125 }),
    href: PRODUCT_HREF,
  },
  "batterie-cuisine-inox": {
    id: "batterie-cuisine-inox",
    name: "Batterie de Cuisine Inox (8 pièces)",
    price: 52_000,
    imageUrl: unsplash(PHOTO.cookwareAlt, { w: 900, h: 1125 }),
    badge: "Nouveau",
    href: PRODUCT_HREF,
  },
  "cache-pot-ceramique": {
    id: "cache-pot-ceramique",
    name: "Cache-Pot Céramique Blanc",
    price: 9_500,
    imageUrl: unsplash(PHOTO.potPlant, { w: 900, h: 1125 }),
    href: PRODUCT_HREF,
  },
  "parfum-homme": {
    id: "parfum-homme",
    name: "Eau de Parfum Homme 100ml",
    price: 32_000,
    compareAtPrice: 40_000,
    imageUrl: unsplash(PHOTO.perfume, { w: 900, h: 1125 }),
    badge: "-20%",
    href: PRODUCT_HREF,
  },
  "coffret-soins-visage": {
    id: "coffret-soins-visage",
    name: "Coffret Soins Visage",
    price: 27_500,
    imageUrl: unsplash(PHOTO.skincareSet, { w: 900, h: 1125 }),
    badge: "Nouveau",
    href: PRODUCT_HREF,
  },
  "lunettes-soleil": {
    id: "lunettes-soleil",
    name: "Lunettes de Soleil",
    price: 15_000,
    imageUrl: unsplash(PHOTO.sunglasses, { w: 900, h: 1125 }),
    href: PRODUCT_HREF,
  },
  "sac-bandouliere": {
    id: "sac-bandouliere",
    name: "Sac Bandoulière",
    price: 22_000,
    imageUrl: unsplash(PHOTO.bagSling, { w: 900, h: 1125 }),
    href: PRODUCT_HREF,
  },
};

const PROMOTION_CATALOG: Record<string, ResolvedPromotionsContent> = {
  FLASH10: {
    headline: "-10% sur tout le site ce week-end",
    description: "Code FLASH10 valable jusqu'à dimanche minuit, sur toutes les catégories.",
    discountLabel: "-10%",
    ctaLabel: "En profiter",
    ctaHref: "/catalogue",
  },
};

export const DEMO_NAV_ITEMS: NavItem[] = [
  {
    label: "Électronique",
    href: "/catalogue/electronique",
    megaMenu: {
      columns: [
        {
          title: "Téléphonie",
          links: [
            { label: "Smartphones", href: "/catalogue/electronique/smartphones" },
            { label: "Écouteurs", href: "/catalogue/electronique/ecouteurs" },
          ],
        },
        {
          title: "Informatique",
          links: [{ label: "Ordinateurs portables", href: "/catalogue/electronique/ordinateurs" }],
        },
      ],
      featured: {
        imageUrl: unsplash(PHOTO.smartwatchSport, { w: 900, h: 1125 }),
        title: "Montres connectées",
        href: "/catalogue/electronique/montres",
        ctaLabel: "Découvrir",
      },
    },
  },
  {
    label: "Maison",
    href: "/catalogue/maison",
    megaMenu: {
      columns: [
        {
          title: "Cuisine",
          links: [
            { label: "Batteries de cuisine", href: "/catalogue/maison/cuisine" },
            { label: "Petit électroménager", href: "/catalogue/maison/electromenager" },
          ],
        },
        {
          title: "Décoration",
          links: [{ label: "Cache-pots", href: "/catalogue/maison/decoration" }],
        },
      ],
      featured: {
        imageUrl: unsplash(PHOTO.cookware, { w: 900, h: 1125 }),
        title: "Équiper sa cuisine",
        href: "/catalogue/maison",
        ctaLabel: "Découvrir",
      },
    },
  },
  { label: "Beauté", href: "/catalogue/beaute" },
  { label: "Mode", href: "/catalogue/mode" },
  { label: "Contact", href: "#contact" },
];

export const DEMO_CART_LINES: CartLine[] = [
  {
    id: "smartphone-noir",
    name: "Smartphone 128 Go — Noir",
    price: 149_000,
    quantity: 1,
    imageUrl: unsplash(PHOTO.phoneBlack, { w: 400, h: 500 }),
  },
  {
    id: "ecouteurs-sans-fil",
    name: "Écouteurs Sans Fil",
    price: 24_500,
    quantity: 1,
    imageUrl: unsplash(PHOTO.earbuds, { w: 400, h: 500 }),
  },
];

export const DEMO_SEARCH_SUGGESTIONS: SearchSuggestion[] = [
  { label: "Smartphones", href: "/catalogue/electronique" },
  { label: "Montres connectées", href: "/catalogue/electronique" },
  { label: "Parfums", href: "/catalogue/beaute" },
  { label: "Sacs", href: "/catalogue/mode" },
  { label: "Ventes flash", href: "/catalogue?tri=promotions" },
];

export const DEMO_RESOLVED_CONTENT: ResolvedContentBySectionId = {
  "categories-1": {
    categories: ["electronique", "maison", "beaute", "mode"].map((id) => CATEGORY_CATALOG[id]!),
  },
  "featured-1": {
    products: [
      "smartphone-noir",
      "ecouteurs-sans-fil",
      "montre-connectee-sport",
      "grille-pain-inox",
      "parfum-homme",
      "lunettes-soleil",
    ].map((id) => PRODUCT_CATALOG[id]!),
  },
  "promo-1": PROMOTION_CATALOG.FLASH10!,
  "new-arrivals-1": {
    products: [
      "smartphone-blanc",
      "batterie-cuisine-inox",
      "coffret-soins-visage",
      "sac-bandouliere",
    ].map((id) => PRODUCT_CATALOG[id]!),
  },
};

const PRODUCT_DETAILS_BY_HANDLE: Record<string, ProductDetailData> = {
  "smartphone-noir": {
    id: "smartphone-noir",
    name: "Smartphone 128 Go — Noir",
    price: 149_000,
    description:
      "Un smartphone polyvalent avec 128 Go de stockage, un bel écran et une batterie qui tient la journée. Livré avec chargeur et coque de protection.",
    materialNote:
      "Châssis aluminium, dos verre trempé, écran verre renforcé résistant aux rayures.",
    images: [
      unsplash(PHOTO.phoneBlack, { w: 1200, h: 1500 }),
      unsplash(PHOTO.earbuds, { w: 1200, h: 1500 }),
      unsplash(PHOTO.phoneWhite, { w: 1200, h: 1500 }),
    ],
    colors: [
      { label: "Noir", hex: "var(--color-primary)" },
      { label: "Blanc", hex: "#FFFFFF" },
    ],
    sizes: ["128 Go", "256 Go"],
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
  "ecouteurs-sans-fil",
  "montre-connectee-ronde",
  "ordinateur-portable",
  "cache-pot-ceramique",
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
      { label: "Toutes les catégories", href: "/catalogue" },
      { label: "Ventes flash", href: "/catalogue?tri=promotions" },
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
