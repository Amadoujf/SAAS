import type { DesignTokens } from "@yamacommerce/design-tokens";
import { validateTemplateManifest, type TemplateManifest } from "@yamacommerce/templates";
import type {
  ResolvedCategoriesContent,
  ResolvedProductsContent,
  ResolvedPromotionsContent,
} from "@/components/sections/content-types";
import type { ResolvedContentBySectionId } from "@/components/sections/section-renderer";

/**
 * Données de démonstration du template « Luxe minimaliste » — voir la demande de
 * validation du 13 septembre 2026 (« premier rendu visuel »). Statiques et
 * autoporteuses (aucune base de données requise) pour permettre de vérifier le
 * moteur de rendu de bout en bout dans n'importe quel environnement.
 *
 * Direction artistique : proche de « Mode premium » (docs/12 §12.5) — noir/blanc
 * strict, serif éditoriale, grandes photos, très peu de couleur hors l'accent doré.
 */

const img = (seed: string, w: number, h: number) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

export const LUXURY_MINIMAL_DESIGN_TOKENS: DesignTokens = {
  colors: {
    primary: "#111111",
    secondary: "#C9A227",
    background: "#FFFFFF",
    surface: "#FAFAFA",
    surfaceMuted: "#F0F0EE",
    textPrimary: "#111111",
    textSecondary: "#3F3F3F",
    textMuted: "#8A8A85",
    border: "#E7E5E1",
    success: "#16A34A",
    danger: "#B3261E",
    warning: "#B98900",
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
    headingSizes: {
      xs: "1.125rem",
      sm: "1.5rem",
      md: "1.875rem",
      lg: "2.5rem",
      xl: "3rem",
      "2xl": "3.5rem",
      "3xl": "4.25rem",
      "4xl": "5rem",
    },
    bodySizes: { xs: "0.75rem", sm: "0.9375rem", md: "1.0625rem", lg: "1.25rem", xl: "1.5rem" },
  },
  spacing: { scale: ["0px", "4px", "8px", "12px", "16px", "24px", "32px", "48px", "64px", "96px"] },
  borders: { width: "1px", color: "#E7E5E1" },
  radii: { sm: "2px", md: "4px", lg: "8px", full: "9999px" },
  shadows: {
    sm: "0 1px 2px rgba(17,17,17,0.05)",
    md: "0 8px 24px rgba(17,17,17,0.08)",
    lg: "0 24px 64px rgba(17,17,17,0.14)",
  },
  layout: { contentMaxWidth: "1320px" },
  buttonStyle: { shape: "square", size: "md", variant: "solid" },
  cardStyle: { radius: "sm", shadow: "sm", border: true },
  headerStyle: { variant: "solid", height: "88px" },
  footerStyle: { variant: "expanded" },
  formStyle: { inputRadius: "sm", inputBorderStyle: "underline" },
  animation: {
    level: "immersive",
    durations: { fast: 180, base: 420, slow: 720 },
    easing: {
      standard: "cubic-bezier(0.4, 0, 0.2, 1)",
      decelerate: "cubic-bezier(0, 0, 0.2, 1)",
      accelerate: "cubic-bezier(0.4, 0, 1, 1)",
    },
  },
};

export const SHOP_NAME = "Maison Almadies";

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
            subtitle: "Maroquinerie et prêt-à-porter façonnés à Dakar, pensés pour durer une vie.",
            media: { url: img("hero-almadies", 1600, 1000), alt: "Vitrine Maison Almadies" },
            ctaLabel: "Découvrir la collection",
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
          params: { categoryIds: ["maroquinerie", "pret-a-porter", "bijoux", "accessoires"] },
        },
        {
          id: "featured-1",
          sectionKey: "featured_products",
          variant: "grid",
          order: 2,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            productIds: ["sac-cabas-wax", "boubou-bazin-or", "babouches-tressees", "collier-ambre"],
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
            title: "Offre Harmattan",
            promoCodeIds: ["HARMATTAN15"],
            media: { url: img("promo-almadies", 1200, 900) },
          },
        },
        {
          id: "new-arrivals-1",
          sectionKey: "new_arrivals",
          variant: "carousel",
          order: 4,
          isEnabled: true,
          animationOverride: "inherit",
          params: { productIds: ["turban-soie", "sandales-beige", "robe-wax", "pochette-grainee"] },
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
                icon: "🚚",
                title: "Livraison à Dakar en 24h",
                description: "Et sous 3 à 5 jours partout au Sénégal.",
              },
              {
                icon: "🧵",
                title: "Façonné à la main",
                description: "Ateliers partenaires à Dakar et Thiès.",
              },
              {
                icon: "🔒",
                title: "Paiement sécurisé",
                description: "Wave, Orange Money, Free Money, carte.",
              },
              {
                icon: "↩️",
                title: "Retours sous 14 jours",
                description: "Satisfait ou remboursé.",
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
                author: "Aïssatou Ba",
                quote: "La qualité du cuir est exceptionnelle, on sent le savoir-faire artisanal.",
                avatarUrl: img("avatar-aissatou", 100, 100),
                rating: 5,
              },
              {
                author: "Ndèye Fatou Sarr",
                quote:
                  "Mon boubou pour la Tabaski venait de Maison Almadies — que des compliments !",
                avatarUrl: img("avatar-ndeye", 100, 100),
                rating: 5,
              },
              {
                author: "Khady Diop",
                quote: "Livraison rapide à Dakar et service client très réactif sur WhatsApp.",
                avatarUrl: img("avatar-khady", 100, 100),
                rating: 4,
              },
            ],
          },
        },
        {
          id: "gallery-1",
          sectionKey: "gallery",
          variant: "masonry",
          order: 7,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            images: [
              { url: img("gallery-1", 800, 1000) },
              { url: img("gallery-2", 800, 600) },
              { url: img("gallery-3", 800, 900) },
              { url: img("gallery-4", 800, 700) },
              { url: img("gallery-5", 800, 1000) },
              { url: img("gallery-6", 800, 650) },
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
            description:
              "Recevez nos nouvelles collections et offres exclusives en avant-première.",
          },
        },
        {
          id: "faq-1",
          sectionKey: "faq",
          variant: "accordion",
          order: 9,
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
          order: 10,
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
          order: 11,
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
    imageUrl: img("cat-maroquinerie", 600, 600),
    href: "/catalogue/maroquinerie",
  },
  "pret-a-porter": {
    id: "pret-a-porter",
    name: "Prêt-à-porter",
    imageUrl: img("cat-pret-a-porter", 600, 600),
    href: "/catalogue/pret-a-porter",
  },
  bijoux: {
    id: "bijoux",
    name: "Bijoux",
    imageUrl: img("cat-bijoux", 600, 600),
    href: "/catalogue/bijoux",
  },
  accessoires: {
    id: "accessoires",
    name: "Accessoires",
    imageUrl: img("cat-accessoires", 600, 600),
    href: "/catalogue/accessoires",
  },
};

const PRODUCT_CATALOG: Record<string, ResolvedProductsContent["products"][number]> = {
  "sac-cabas-wax": {
    id: "sac-cabas-wax",
    name: "Sac Cabas Wax Édition Limitée",
    price: 145_000,
    imageUrl: img("p-sac-cabas", 640, 800),
  },
  "boubou-bazin-or": {
    id: "boubou-bazin-or",
    name: "Boubou Bazin Riche Brodé Or",
    price: 225_000,
    compareAtPrice: 265_000,
    imageUrl: img("p-boubou", 640, 800),
    badge: "Promo",
  },
  "babouches-tressees": {
    id: "babouches-tressees",
    name: "Babouches en Cuir Tressé",
    price: 45_000,
    imageUrl: img("p-babouches", 640, 800),
  },
  "collier-ambre": {
    id: "collier-ambre",
    name: "Collier Perles d'Ambre",
    price: 68_000,
    imageUrl: img("p-collier", 640, 800),
  },
  "turban-soie": {
    id: "turban-soie",
    name: "Turban Soie Imprimé Wax",
    price: 32_000,
    imageUrl: img("p-turban", 640, 800),
  },
  "sandales-beige": {
    id: "sandales-beige",
    name: "Sandales Cuir Beige",
    price: 58_000,
    imageUrl: img("p-sandales", 640, 800),
  },
  "robe-wax": {
    id: "robe-wax",
    name: "Robe Wax Structurée",
    price: 98_000,
    imageUrl: img("p-robe", 640, 800),
  },
  "pochette-grainee": {
    id: "pochette-grainee",
    name: "Pochette Cuir Grainé",
    price: 52_000,
    imageUrl: img("p-pochette", 640, 800),
  },
};

const PROMOTION_CATALOG: Record<string, ResolvedPromotionsContent> = {
  HARMATTAN15: {
    headline: "-15% sur la collection Harmattan",
    description: "Offre valable jusqu'au 30 septembre, sur toute la maroquinerie.",
    discountLabel: "-15%",
    ctaLabel: "En profiter",
    ctaHref: "/catalogue",
  },
};

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
    products: ["sac-cabas-wax", "boubou-bazin-or", "babouches-tressees", "collier-ambre"].map(
      (id) => PRODUCT_CATALOG[id]!,
    ),
  },
  "promo-1": PROMOTION_CATALOG.HARMATTAN15!,
  "new-arrivals-1": {
    products: ["turban-soie", "sandales-beige", "robe-wax", "pochette-grainee"].map(
      (id) => PRODUCT_CATALOG[id]!,
    ),
  },
};
