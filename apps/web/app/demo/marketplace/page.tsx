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
  MARKETPLACE_DESIGN_TOKENS,
  SHOP_NAME,
  SHOP_TAGLINE,
  WHATSAPP_NUMBER,
} from "@/lib/demo/marketplace-template";

/**
 * Démonstration du template « Marketplace riche en produits » — deuxième des trois
 * premiers templates e-commerce (voir docs/09, Phase 1). Page 100% statique, comme
 * « Luxe minimaliste », pour rester vérifiable sans base de données.
 */
export const metadata: Metadata = {
  title: `${SHOP_NAME} — Électronique, maison, beauté et mode au Sénégal`,
  description:
    "Des milliers de produits, des centaines de vendeurs vérifiés. Livraison partout au Sénégal, paiement Wave, Orange Money, Free Money et carte.",
};

export default function MarketplaceDemoPage() {
  const homePage = DEMO_MANIFEST.pages.find((page) => page.isHome) ?? DEMO_MANIFEST.pages[0]!;
  const transparentOverHero =
    MARKETPLACE_DESIGN_TOKENS.headerStyle.variant === "transparent-on-hero";

  return (
    <SiteShell
      tokens={MARKETPLACE_DESIGN_TOKENS}
      animationLevel={MARKETPLACE_DESIGN_TOKENS.animation.level}
      initialCartLines={DEMO_CART_LINES}
    >
      <Header
        shopName={SHOP_NAME}
        transparentOverHero={transparentOverHero}
        navItems={DEMO_NAV_ITEMS}
        searchSuggestions={DEMO_SEARCH_SUGGESTIONS}
      />
      {/* Le header est toujours en position fixe (voir header.tsx) : quand il n'est
          PAS transparent-sur-hero, il faut compenser sa hauteur ici, sinon il
          recouvre le haut de la première section — voir la note de resolve-tenant-site
          et le correctif déjà appliqué à ProductDetail pour la même raison. */}
      <main style={transparentOverHero ? undefined : { paddingTop: "var(--header-height)" }}>
        <RenderTemplatePage
          page={homePage}
          tokens={MARKETPLACE_DESIGN_TOKENS}
          animationLevel={MARKETPLACE_DESIGN_TOKENS.animation.level}
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
