import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { SiteShell } from "@/components/site-shell";
import { DesignerProfileHeader } from "@/components/product/designer-profile";
import { FeaturedProductsSection } from "@/components/sections/featured-products";
import {
  DEMO_FOOTER_GROUPS,
  DEMO_NAV_ITEMS,
  DEMO_SEARCH_SUGGESTIONS,
  SHOP_NAME,
  SHOP_TAGLINE,
  TERANGA_ATELIER_DESIGN_TOKENS,
  WHATSAPP_NUMBER,
  getAllDesignerHandles,
  getDesignerByHandle,
  getProductsByDesigner,
} from "@/lib/demo/teranga-atelier-template";

/**
 * Fiche créateur — route dynamique dédiée (« fiches des créateurs, produits par
 * créateur », voir Teranga Atelier template 4, 20 septembre 2026). Même principe que la
 * fiche produit : `generateStaticParams` + fonction de lookup remplaçable, la page
 * elle-même ne connaît que `params.handle`.
 */
export function generateStaticParams() {
  return getAllDesignerHandles().map((handle) => ({ handle }));
}

export function generateMetadata({ params }: { params: { handle: string } }): Metadata {
  const designer = getDesignerByHandle(params.handle);
  if (!designer) return {};
  return {
    title: `${designer.name} — ${SHOP_NAME}`,
    description: `${designer.specialty} · ${designer.region}. ${designer.bio}`,
  };
}

export default function DesignerPage({ params }: { params: { handle: string } }) {
  const designer = getDesignerByHandle(params.handle);
  if (!designer) notFound();

  return (
    <SiteShell
      tokens={TERANGA_ATELIER_DESIGN_TOKENS}
      animationLevel={TERANGA_ATELIER_DESIGN_TOKENS.animation.level}
    >
      <Header
        shopName={SHOP_NAME}
        navItems={DEMO_NAV_ITEMS}
        searchSuggestions={DEMO_SEARCH_SUGGESTIONS}
        showCurrencySelector
      />
      <main>
        <DesignerProfileHeader designer={designer} locale="fr" />
        <FeaturedProductsSection
          variant="grid"
          content={getProductsByDesigner(designer.id)}
          locale="fr"
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
