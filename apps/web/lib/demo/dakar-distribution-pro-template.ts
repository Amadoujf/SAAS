import type { DesignTokens } from "@yamacommerce/design-tokens";
import { validateTemplateManifest, type TemplateManifest } from "@yamacommerce/templates";
import type {
  ResolvedCategoriesContent,
  ResolvedProductsContent,
  ResolvedPromotionsContent,
} from "@/components/sections/content-types";
import type { ResolvedContentBySectionId } from "@/components/sections/section-renderer";
import type { NavItem } from "@/components/layout/mega-menu-nav";
import type { SearchSuggestion } from "@/components/layout/search-overlay";
import type { B2BProductDetailData } from "@/components/product/b2b-product-detail";

/**
 * Données de démonstration du template « Grossiste et revendeur professionnel » —
 * cinquième et dernier des premiers templates e-commerce (voir docs/09, Phase 1), pour
 * une entreprise fictive B2B « Dakar Distribution Pro ». Le PLUS différent
 * structurellement des 4 autres, volontairement : pas de hero produit/lifestyle (une
 * recherche catalogue en première position, voir `catalog_search`), pas de panier
 * "boutique" classique (bon de commande, devis, paliers de prix), pas de storytelling
 * de marque — densité d'information, lisibilité, navigation rapide.
 *
 * Ce que ce template NE simule PAS avec un vrai backend (limitation assumée et
 * documentée dans le rapport de livraison, exactement comme "compte" sur les 4 autres
 * templates n'a pas d'authentification réelle) : validation de compte par un
 * administrateur, facturation réelle, limite de crédit appliquée, import de fichier de
 * commande traité côté serveur. Ce qui EST réellement fonctionnel : le formulaire
 * d'inscription revendeur et la demande de devis (soumission avec confirmation), le
 * calcul de prix par palier de quantité, l'ajout réel au panier partagé, et l'export
 * CSV de l'espace revendeur (génère un vrai fichier téléchargeable côté client).
 */

function unsplash(photoId: string, { w = 1600, h }: { w?: number; h?: number } = {}): string {
  const params = new URLSearchParams({ q: "80", fm: "jpg", fit: "crop", w: String(w) });
  if (h) params.set("h", String(h));
  return `https://images.unsplash.com/${photoId}?${params.toString()}`;
}

// Identifiants Unsplash vérifiés (recherche dédiée entrepôt/logistique B2B, tier
// gratuit uniquement, aucun logo de marque visible — voir le rapport de livraison de ce
// template pour le détail des exclusions premium/marques rencontrées).
const PHOTO = {
  warehouseAisle: "photo-1553413077-190dd305871c",
  warehouseShelving: "photo-1627309366653-2dedc084cdf1",
  logisticsBoxes: "photo-1700165644892-3dd6b67b25bc",
  officeMeeting: "photo-1681949287382-052ea3954a51",
  electronicsGeneric: "photo-1517373116369-9bdb8cdc9f62",
  hardwareTools: "photo-1754666104618-3e0655f5fa7c",
  homewareGeneric: "photo-1777869779118-2389f6c951eb",
  buildingMaterials: "photo-1508450859948-4e04fabaa4ea",
  handshake: "photo-1521791136064-7986c2920216",
  dispatchDesk: "photo-1639313521811-fdfb1c040ddb",
  warehouseTablet: "photo-1781559818983-4180d744416a",
  teamMeeting: "photo-1572021335469-31706a17aaef",
} as const;

export const DAKAR_DISTRIBUTION_DESIGN_TOKENS: DesignTokens = {
  // Palette « B2B professionnel » (20 septembre 2026) : bleu nuit, blanc, gris clair,
  // cyan — délibérément à l'opposé des 4 templates "boutique" (aucune chaleur
  // éditoriale, aucune ambiance lifestyle : lisibilité et densité d'abord).
  colors: {
    primary: "#0B1E3D",
    secondary: "#0EA5C4",
    background: "#FFFFFF",
    surface: "#F4F6F8",
    surfaceMuted: "#E7EBEF",
    textPrimary: "#101828",
    textSecondary: "#475467",
    textMuted: "#98A2B3",
    border: "#D0D5DD",
    success: "#1F9D55",
    danger: "#D92D20",
    warning: "#B54708",
    accentPrimary: "#0EA5C4",
    accentSecondary: "#0B1E3D",
    leather: "#6B4A32",
    champagne: "#D8C9A3",
    overlay: "rgba(11, 30, 61, 0.6)",
    mutedSurface: "#132A4D",
  },
  typography: {
    headingFont:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    bodyFont:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    // Échelle compacte, plus proche de Marketplace que des templates éditoriaux — un
    // acheteur professionnel scanne un catalogue, il ne lit pas un magazine.
    headingSizes: {
      xs: "1rem",
      sm: "1.25rem",
      md: "1.5rem",
      lg: "1.875rem",
      xl: "2.25rem",
      "2xl": "2.625rem",
      "3xl": "3rem",
      "4xl": "3.5rem",
    },
    bodySizes: { xs: "0.75rem", sm: "0.8125rem", md: "0.9375rem", lg: "1.0625rem", xl: "1.25rem" },
  },
  spacing: { scale: ["0px", "4px", "8px", "12px", "16px", "24px", "32px", "48px", "64px", "96px"] },
  borders: { width: "1px", color: "#D0D5DD" },
  radii: { sm: "4px", md: "6px", lg: "10px", full: "9999px" },
  shadows: {
    sm: "0 1px 2px rgba(16,24,40,0.06)",
    md: "0 6px 16px rgba(16,24,40,0.08)",
    lg: "0 16px 40px rgba(16,24,40,0.12)",
  },
  layout: { contentMaxWidth: "1600px" },
  buttonStyle: { shape: "rounded", size: "sm", variant: "solid" },
  cardStyle: { radius: "sm", shadow: "sm", border: true },
  headerStyle: { variant: "solid", height: "68px" },
  footerStyle: { variant: "expanded" },
  formStyle: { inputRadius: "sm", inputBorderStyle: "solid" },
  animation: {
    // "discreet" et des durées très courtes : voir l'exigence explicite « animations
    // courtes et fonctionnelles » — jamais de mise en scène, juste un retour visuel net.
    level: "discreet",
    durations: { fast: 80, base: 150, slow: 220 },
    easing: {
      standard: "cubic-bezier(0.4, 0, 0.2, 1)",
      decelerate: "cubic-bezier(0, 0, 0.2, 1)",
      accelerate: "cubic-bezier(0.4, 0, 1, 1)",
    },
  },
};

export const SHOP_NAME = "Dakar Distribution Pro";
export const WHATSAPP_NUMBER = "+221331234567";
export const SHOP_TAGLINE = {
  fr: "Grossiste multi-catégories pour revendeurs professionnels — tarifs dégressifs, stock en temps réel.",
  en: "Multi-category wholesaler for professional resellers — volume pricing, real-time stock.",
};

const RAW_DEMO_MANIFEST = {
  pages: [
    {
      slug: "accueil",
      title: "Accueil",
      isHome: true,
      sections: [
        {
          id: "search-1",
          sectionKey: "catalog_search",
          variant: "hero",
          order: 0,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            eyebrow: "Espace revendeurs",
            title: "Tout votre approvisionnement, un seul fournisseur",
            subtitle:
              "Électronique, quincaillerie, équipement de maison et matériaux — tarifs dégressifs dès 12 unités.",
            searchPlaceholder: "Rechercher une référence, un produit, une marque...",
            quickCategories: [
              { label: "Électronique", href: "/catalogue/electronique" },
              { label: "Quincaillerie", href: "/catalogue/quincaillerie" },
              { label: "Équipement maison", href: "/catalogue/maison" },
              { label: "Matériaux", href: "/catalogue/materiaux" },
            ],
            stats: [
              { value: "1 200+", label: "Références" },
              { value: "480", label: "Revendeurs actifs" },
              { value: "24h", label: "Expédition Dakar" },
              { value: "4", label: "Entrepôts régionaux" },
            ],
            media: {
              url: unsplash(PHOTO.warehouseAisle, { w: 2400 }),
              alt: "Entrepôt de distribution, allée d'étagères",
            },
          },
        },
        {
          id: "categories-1",
          sectionKey: "categories",
          variant: "grid",
          order: 1,
          isEnabled: true,
          animationOverride: "inherit",
          params: { categoryIds: ["electronique", "quincaillerie", "maison", "materiaux"] },
        },
        {
          id: "promo-1",
          sectionKey: "promotions",
          variant: "banner",
          order: 2,
          isEnabled: true,
          animationOverride: "inherit",
          params: { title: "Promotion de gros", promoCodeIds: ["GROS10"] },
        },
        {
          id: "featured-1",
          sectionKey: "featured_products",
          variant: "grid",
          order: 3,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            title: "Produits les plus commandés",
            productIds: [
              "cable-hdmi-lot20",
              "perceuse-visseuse-pro",
              "ampoule-led-carton",
              "ciment-sac-50kg",
              "multiprise-industrielle",
              "gants-travail-lot50",
            ],
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
            title: "Nouveaux arrivages",
            productIds: ["chargeur-usb-c-lot50", "casque-securite-chantier", "carrelage-m2-boite"],
          },
        },
        {
          id: "brands-1",
          sectionKey: "brands",
          variant: "marquee",
          order: 5,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            logos: [
              {
                url: unsplash(PHOTO.electronicsGeneric, { w: 300, h: 120 }),
                alt: "Marque partenaire A",
              },
              {
                url: unsplash(PHOTO.hardwareTools, { w: 300, h: 120 }),
                alt: "Marque partenaire B",
              },
              {
                url: unsplash(PHOTO.homewareGeneric, { w: 300, h: 120 }),
                alt: "Marque partenaire C",
              },
              {
                url: unsplash(PHOTO.buildingMaterials, { w: 300, h: 120 }),
                alt: "Marque partenaire D",
              },
            ],
          },
        },
        {
          id: "benefits-1",
          sectionKey: "benefits",
          variant: "cards",
          order: 6,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            items: [
              {
                icon: "truck",
                title: "Livraison par zone",
                description: "Dakar, régions et pays limitrophes sous 24 à 72h.",
              },
              {
                icon: "shield",
                title: "Tarifs dégressifs",
                description: "Prix par palier de quantité sur tout le catalogue.",
              },
              {
                icon: "craft",
                title: "Commercial dédié",
                description: "Un interlocuteur unique assigné à votre compte.",
              },
              {
                icon: "return",
                title: "Facturation flexible",
                description: "Paiement partiel, échéances, historique complet.",
              },
            ],
          },
        },
        {
          id: "testimonials-1",
          sectionKey: "testimonials",
          variant: "grid",
          order: 7,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            items: [
              {
                author: "Ousmane Ba — Quincaillerie Ba & Fils",
                quote: "Les tarifs par palier nous ont permis de baisser nos coûts d'achat de 15%.",
                rating: 5,
              },
              {
                author: "Marième Diouf — Électro Plus",
                quote: "Le commercial assigné répond en moins d'une heure, même le week-end.",
                rating: 5,
              },
              {
                author: "Cheikh Tidiane Sow — BTP Services",
                quote: "Livraison fiable sur nos 3 chantiers, jamais de rupture surprise.",
                rating: 4,
              },
            ],
          },
        },
        {
          id: "cta-compte-1",
          sectionKey: "cta",
          variant: "split",
          order: 8,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            title: "Devenez revendeur agréé",
            description:
              "Accédez aux tarifs professionnels, à la facturation et à votre commercial dédié.",
            buttonLabel: "Ouvrir un compte revendeur",
            buttonHref: "/demo/dakar-distribution-pro/devenir-revendeur",
          },
        },
        {
          id: "cta-devis-1",
          sectionKey: "cta",
          variant: "banner",
          order: 9,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            title: "Besoin d'un devis pour une commande volumineuse ?",
            description: "Notre équipe commerciale répond sous 24h ouvrées.",
            buttonLabel: "Demander un devis",
            buttonHref: "/demo/dakar-distribution-pro/demande-devis",
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
            defaultMessage: "Bonjour, je suis revendeur et j'ai une question sur le catalogue.",
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
    imageUrl: unsplash(PHOTO.electronicsGeneric, { w: 1000, h: 750 }),
    href: "/catalogue/electronique",
  },
  quincaillerie: {
    id: "quincaillerie",
    name: "Quincaillerie",
    imageUrl: unsplash(PHOTO.hardwareTools, { w: 1000, h: 750 }),
    href: "/catalogue/quincaillerie",
  },
  maison: {
    id: "maison",
    name: "Équipement maison",
    imageUrl: unsplash(PHOTO.homewareGeneric, { w: 1000, h: 750 }),
    href: "/catalogue/maison",
  },
  materiaux: {
    id: "materiaux",
    name: "Matériaux de construction",
    imageUrl: unsplash(PHOTO.buildingMaterials, { w: 1000, h: 750 }),
    href: "/catalogue/materiaux",
  },
};

const PRODUCT_HREF = "/demo/dakar-distribution-pro/produit/cable-hdmi-lot20";

const PRODUCT_CATALOG: Record<string, ResolvedProductsContent["products"][number]> = {
  "cable-hdmi-lot20": {
    id: "cable-hdmi-lot20",
    name: "Câble HDMI 2m — Lot de 20",
    price: 45_000,
    imageUrl: unsplash(PHOTO.electronicsGeneric, { w: 900, h: 900 }),
    badge: "Best-seller",
    href: PRODUCT_HREF,
  },
  "perceuse-visseuse-pro": {
    id: "perceuse-visseuse-pro",
    name: "Perceuse-Visseuse Pro 18V",
    price: 38_000,
    imageUrl: unsplash(PHOTO.hardwareTools, { w: 900, h: 900 }),
    href: PRODUCT_HREF,
  },
  "ampoule-led-carton": {
    id: "ampoule-led-carton",
    name: "Ampoule LED 9W — Carton de 100",
    price: 65_000,
    imageUrl: unsplash(PHOTO.electronicsGeneric, { w: 900, h: 900 }),
    href: PRODUCT_HREF,
  },
  "ciment-sac-50kg": {
    id: "ciment-sac-50kg",
    name: "Ciment CPJ 45 — Sac 50kg",
    price: 4_500,
    imageUrl: unsplash(PHOTO.buildingMaterials, { w: 900, h: 900 }),
    href: PRODUCT_HREF,
  },
  "multiprise-industrielle": {
    id: "multiprise-industrielle",
    name: "Multiprise Industrielle 6 Prises",
    price: 12_000,
    imageUrl: unsplash(PHOTO.electronicsGeneric, { w: 900, h: 900 }),
    href: PRODUCT_HREF,
  },
  "gants-travail-lot50": {
    id: "gants-travail-lot50",
    name: "Gants de Travail — Lot de 50",
    price: 55_000,
    imageUrl: unsplash(PHOTO.hardwareTools, { w: 900, h: 900 }),
    href: PRODUCT_HREF,
  },
  "chargeur-usb-c-lot50": {
    id: "chargeur-usb-c-lot50",
    name: "Chargeur USB-C 20W — Lot de 50",
    price: 175_000,
    imageUrl: unsplash(PHOTO.electronicsGeneric, { w: 900, h: 900 }),
    badge: "Nouveau",
    href: PRODUCT_HREF,
  },
  "casque-securite-chantier": {
    id: "casque-securite-chantier",
    name: "Casque de Sécurité Chantier",
    price: 6_500,
    imageUrl: unsplash(PHOTO.hardwareTools, { w: 900, h: 900 }),
    badge: "Nouveau",
    href: PRODUCT_HREF,
  },
  "carrelage-m2-boite": {
    id: "carrelage-m2-boite",
    name: "Carrelage 60×60 — Boîte 1,44 m²",
    price: 8_900,
    imageUrl: unsplash(PHOTO.buildingMaterials, { w: 900, h: 900 }),
    badge: "Nouveau",
    href: PRODUCT_HREF,
  },
};

const PROMOTION_CATALOG: Record<string, ResolvedPromotionsContent> = {
  GROS10: {
    headline: "-10% sur toute commande de plus de 50 unités",
    description: "Code GROS10 valable ce mois-ci sur l'ensemble du catalogue.",
    discountLabel: "-10%",
    ctaLabel: "Voir le catalogue",
    ctaHref: "/catalogue",
  },
};

export const DEMO_NAV_ITEMS: NavItem[] = [
  { label: "Électronique", href: "/catalogue/electronique" },
  { label: "Quincaillerie", href: "/catalogue/quincaillerie" },
  { label: "Équipement maison", href: "/catalogue/maison" },
  { label: "Matériaux", href: "/catalogue/materiaux" },
  { label: "Devenir revendeur", href: "/demo/dakar-distribution-pro/devenir-revendeur" },
  { label: "Contact", href: "#contact" },
];

export const DEMO_SEARCH_SUGGESTIONS: SearchSuggestion[] = [
  { label: "Câbles HDMI", href: "/catalogue/electronique" },
  { label: "Ciment", href: "/catalogue/materiaux" },
  { label: "Perceuses", href: "/catalogue/quincaillerie" },
  { label: "Ampoules LED", href: "/catalogue/electronique" },
];

export const DEMO_RESOLVED_CONTENT: ResolvedContentBySectionId = {
  "categories-1": {
    categories: ["electronique", "quincaillerie", "maison", "materiaux"].map(
      (id) => CATEGORY_CATALOG[id]!,
    ),
  },
  "promo-1": PROMOTION_CATALOG.GROS10!,
  "featured-1": {
    products: [
      "cable-hdmi-lot20",
      "perceuse-visseuse-pro",
      "ampoule-led-carton",
      "ciment-sac-50kg",
      "multiprise-industrielle",
      "gants-travail-lot50",
    ].map((id) => PRODUCT_CATALOG[id]!),
  },
  "new-arrivals-1": {
    products: ["chargeur-usb-c-lot50", "casque-securite-chantier", "carrelage-m2-boite"].map(
      (id) => PRODUCT_CATALOG[id]!,
    ),
  },
};

const B2B_PRODUCT_DETAILS: Record<string, B2BProductDetailData> = {
  "cable-hdmi-lot20": {
    id: "cable-hdmi-lot20",
    sku: "CBL-HDMI-2M-L20",
    name: "Câble HDMI 2m — Lot de 20",
    description:
      "Câble HDMI 2.0 haute vitesse, connecteurs plaqués or, gaine tressée. Vendu par lot de 20 unités, idéal pour la revente en magasin d'électronique.",
    images: [unsplash(PHOTO.electronicsGeneric, { w: 1200, h: 900 })],
    unitPrice: 2_500,
    priceTiers: [
      { minQty: 5, unitPrice: 2_250 },
      { minQty: 10, unitPrice: 2_000 },
      { minQty: 25, unitPrice: 1_750 },
    ],
    moq: 1,
    availableQty: 340,
    packaging: "Lot de 20 câbles",
    leadTimeDays: 2,
    warehouse: "Entrepôt Dakar — Zone Industrielle",
    specSheetUrl: "/documents/fiche-technique-exemple.pdf",
    href: PRODUCT_HREF,
  },
};

export function getProductByHandle(handle: string): B2BProductDetailData | undefined {
  return B2B_PRODUCT_DETAILS[handle];
}

export function getAllProductHandles(): string[] {
  return Object.keys(B2B_PRODUCT_DETAILS);
}

export const DEMO_RELATED_PRODUCT_IDS = [
  "multiprise-industrielle",
  "chargeur-usb-c-lot50",
  "ampoule-led-carton",
];

export function getRelatedProducts(): ResolvedProductsContent {
  return {
    title: "Produits alternatifs",
    products: DEMO_RELATED_PRODUCT_IDS.map((id) => PRODUCT_CATALOG[id]!),
  };
}

export const DEMO_FOOTER_GROUPS = [
  {
    title: "Catalogue",
    links: [
      { label: "Toutes les catégories", href: "/catalogue" },
      { label: "Nouveaux arrivages", href: "/catalogue?tri=nouveaute" },
    ],
  },
  {
    title: "Revendeurs",
    links: [
      { label: "Ouvrir un compte", href: "/demo/dakar-distribution-pro/devenir-revendeur" },
      { label: "Demander un devis", href: "/demo/dakar-distribution-pro/demande-devis" },
      { label: "Espace revendeur", href: "/demo/dakar-distribution-pro/espace-revendeur" },
    ],
  },
  {
    title: "Légal",
    links: [
      { label: "Mentions légales", href: "/mentions-legales" },
      { label: "Conditions de vente B2B", href: "/conditions-b2b" },
    ],
  },
];

/** Utilisées par la page de démonstration « espace revendeur » — données fictives
 *  d'un compte connecté (voir la note de limitation en tête de fichier : pas de vraie
 *  authentification, ceci illustre l'interface). */
export const DEMO_ACCOUNT = {
  companyName: "Quincaillerie Ba & Fils",
  accountManager: {
    name: "Fatoumata Sarr",
    phone: "+221 77 555 12 34",
    email: "fatoumata.sarr@dakardistributionpro.sn",
  },
  creditLimit: 5_000_000,
  creditUsed: 1_850_000,
  addresses: [
    { label: "Siège — Dakar", address: "12 Rue des Grossistes, Zone Industrielle, Dakar" },
    { label: "Dépôt — Thiès", address: "Route de Tivaouane, Thiès" },
  ],
  users: [
    { name: "Ousmane Ba", role: "Administrateur", email: "ousmane.ba@quincba.sn" },
    { name: "Aida Ba", role: "Acheteuse", email: "aida.ba@quincba.sn" },
  ],
  orders: [
    { id: "CMD-2026-0912", date: "2026-09-10", amount: 850_000, status: "Livrée" },
    { id: "CMD-2026-0887", date: "2026-08-28", amount: 1_200_000, status: "Livrée" },
    { id: "CMD-2026-0855", date: "2026-08-14", amount: 430_000, status: "En cours" },
  ],
  invoices: [
    { id: "FAC-2026-0912", date: "2026-09-10", amount: 850_000, status: "Payée" },
    { id: "FAC-2026-0887", date: "2026-08-28", amount: 1_200_000, status: "Payée" },
    { id: "FAC-2026-0855", date: "2026-08-14", amount: 430_000, status: "Échéance 30j" },
  ],
};
