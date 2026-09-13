import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { RenderTemplatePage } from "@/components/render-template-page";
import { SiteShell } from "@/components/site-shell";
import {
  DEMO_CART_LINES,
  DEMO_FOOTER_GROUPS,
  DEMO_MANIFEST,
  DEMO_NAV_ITEMS,
  DEMO_RESOLVED_CONTENT,
  DEMO_SEARCH_SUGGESTIONS,
  SHOP_NAME,
  SHOP_TAGLINE,
  TERANGA_ATELIER_DESIGN_TOKENS,
  WHATSAPP_NUMBER,
} from "@/lib/demo/teranga-atelier-template";

/**
 * Démonstration du template « Boutique africaine contemporaine » — quatrième des cinq
 * premiers templates e-commerce (voir docs/09, Phase 1). Page 100% statique, comme les
 * trois précédents, pour rester vérifiable sans base de données.
 */
export const metadata: Metadata = {
  title: `${SHOP_NAME} — Mode et créations africaines contemporaines`,
  description:
    "Vêtements, bijoux et objets de décoration créés par des designers sénégalais. Livraison au Sénégal et à la diaspora, paiement Wave, Orange Money, carte, FCFA/EUR/CAD/USD.",
};

export default function TerangaAtelierDemoPage() {
  const homePage = DEMO_MANIFEST.pages.find((page) => page.isHome) ?? DEMO_MANIFEST.pages[0]!;
  const transparentOverHero =
    TERANGA_ATELIER_DESIGN_TOKENS.headerStyle.variant === "transparent-on-hero";

  return (
    <SiteShell
      tokens={TERANGA_ATELIER_DESIGN_TOKENS}
      animationLevel={TERANGA_ATELIER_DESIGN_TOKENS.animation.level}
      initialCartLines={DEMO_CART_LINES}
    >
      <Header
        shopName={SHOP_NAME}
        transparentOverHero={transparentOverHero}
        navItems={DEMO_NAV_ITEMS}
        searchSuggestions={DEMO_SEARCH_SUGGESTIONS}
        showCurrencySelector
      />
      {/* Header toujours fixe (voir header.tsx) : transparent sur le hero ici, donc pas
          de compensation de hauteur nécessaire sur cette page — même raisonnement que
          Luxe minimaliste. */}
      <main>
        <RenderTemplatePage
          page={homePage}
          tokens={TERANGA_ATELIER_DESIGN_TOKENS}
          animationLevel={TERANGA_ATELIER_DESIGN_TOKENS.animation.level}
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
