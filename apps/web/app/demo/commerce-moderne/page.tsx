import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { RenderTemplatePage } from "@/components/render-template-page";
import { SiteShell } from "@/components/site-shell";
import {
  COMMERCE_MODERNE_DESIGN_TOKENS,
  DEMO_CART_LINES,
  DEMO_FOOTER_GROUPS,
  DEMO_MANIFEST,
  DEMO_NAV_ITEMS,
  DEMO_RESOLVED_CONTENT,
  DEMO_SEARCH_SUGGESTIONS,
  SHOP_NAME,
  SHOP_TAGLINE,
  WHATSAPP_NUMBER,
} from "@/lib/demo/commerce-moderne-template";

/**
 * Démonstration du template « Commerce moderne et dynamique » — troisième des trois
 * premiers templates e-commerce (voir docs/09, Phase 1). Page 100% statique, comme
 * les deux autres, pour rester vérifiable sans base de données.
 */
export const metadata: Metadata = {
  title: `${SHOP_NAME} — Sneakers et streetwear au Sénégal`,
  description:
    "Sneakers, streetwear et accessoires urbains. Livraison à Dakar en 24h, paiement Wave, Orange Money, Free Money et carte.",
};

export default function CommerceModerneDemoPage() {
  const homePage = DEMO_MANIFEST.pages.find((page) => page.isHome) ?? DEMO_MANIFEST.pages[0]!;
  const transparentOverHero =
    COMMERCE_MODERNE_DESIGN_TOKENS.headerStyle.variant === "transparent-on-hero";

  return (
    <SiteShell
      tokens={COMMERCE_MODERNE_DESIGN_TOKENS}
      animationLevel={COMMERCE_MODERNE_DESIGN_TOKENS.animation.level}
      initialCartLines={DEMO_CART_LINES}
    >
      <Header
        shopName={SHOP_NAME}
        transparentOverHero={transparentOverHero}
        navItems={DEMO_NAV_ITEMS}
        searchSuggestions={DEMO_SEARCH_SUGGESTIONS}
      />
      {/* Header toujours fixe et non transparent-sur-hero ici (voir header.tsx) : il
          faut donc compenser sa hauteur, sinon il recouvre le haut du hero — même
          correctif que sur la page d'accueil Marketplace. */}
      <main style={transparentOverHero ? undefined : { paddingTop: "var(--header-height)" }}>
        <RenderTemplatePage
          page={homePage}
          tokens={COMMERCE_MODERNE_DESIGN_TOKENS}
          animationLevel={COMMERCE_MODERNE_DESIGN_TOKENS.animation.level}
          locale="fr"
          resolvedContent={DEMO_RESOLVED_CONTENT}
        />
      </main>
      <Footer
        shopName={SHOP_NAME}
        whatsappNumber={WHATSAPP_NUMBER}
        tagline={SHOP_TAGLINE}
        groups={DEMO_FOOTER_GROUPS}
      />
    </SiteShell>
  );
}
