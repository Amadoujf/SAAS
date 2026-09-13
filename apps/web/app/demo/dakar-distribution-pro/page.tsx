import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { RenderTemplatePage } from "@/components/render-template-page";
import { SiteShell } from "@/components/site-shell";
import {
  DAKAR_DISTRIBUTION_DESIGN_TOKENS,
  DEMO_FOOTER_GROUPS,
  DEMO_MANIFEST,
  DEMO_NAV_ITEMS,
  DEMO_RESOLVED_CONTENT,
  DEMO_SEARCH_SUGGESTIONS,
  SHOP_NAME,
  SHOP_TAGLINE,
  WHATSAPP_NUMBER,
} from "@/lib/demo/dakar-distribution-pro-template";

/**
 * Démonstration du template « Grossiste et revendeur professionnel » — cinquième et
 * dernier des premiers templates e-commerce (voir docs/09, Phase 1). Page 100%
 * statique, comme les 4 précédents.
 */
export const metadata: Metadata = {
  title: `${SHOP_NAME} — Grossiste multi-catégories pour revendeurs`,
  description:
    "Électronique, quincaillerie, équipement de maison et matériaux de construction en gros. Tarifs dégressifs, livraison par zone, facturation professionnelle.",
};

export default function DakarDistributionProDemoPage() {
  const homePage = DEMO_MANIFEST.pages.find((page) => page.isHome) ?? DEMO_MANIFEST.pages[0]!;
  const transparentOverHero =
    DAKAR_DISTRIBUTION_DESIGN_TOKENS.headerStyle.variant === "transparent-on-hero";

  return (
    <SiteShell
      tokens={DAKAR_DISTRIBUTION_DESIGN_TOKENS}
      animationLevel={DAKAR_DISTRIBUTION_DESIGN_TOKENS.animation.level}
    >
      <Header
        shopName={SHOP_NAME}
        transparentOverHero={transparentOverHero}
        navItems={DEMO_NAV_ITEMS}
        searchSuggestions={DEMO_SEARCH_SUGGESTIONS}
      />
      {/* Header toujours solide ici (voir header.tsx) : il faut compenser sa hauteur,
          sinon il recouvre le haut de la section de recherche — même correctif que
          Marketplace et Commerce moderne. */}
      <main style={transparentOverHero ? undefined : { paddingTop: "var(--header-height)" }}>
        <RenderTemplatePage
          page={homePage}
          tokens={DAKAR_DISTRIBUTION_DESIGN_TOKENS}
          animationLevel={DAKAR_DISTRIBUTION_DESIGN_TOKENS.animation.level}
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
