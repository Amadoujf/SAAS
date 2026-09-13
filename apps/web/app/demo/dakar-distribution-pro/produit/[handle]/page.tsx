import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { SiteShell } from "@/components/site-shell";
import { B2BProductDetail } from "@/components/product/b2b-product-detail";
import { FeaturedProductsSection } from "@/components/sections/featured-products";
import { formatFcfa } from "@/lib/format";
import {
  DAKAR_DISTRIBUTION_DESIGN_TOKENS,
  DEMO_FOOTER_GROUPS,
  DEMO_NAV_ITEMS,
  DEMO_SEARCH_SUGGESTIONS,
  SHOP_NAME,
  SHOP_TAGLINE,
  WHATSAPP_NUMBER,
  getAllProductHandles,
  getProductByHandle,
  getRelatedProducts,
} from "@/lib/demo/dakar-distribution-pro-template";

export function generateStaticParams() {
  return getAllProductHandles().map((handle) => ({ handle }));
}

export function generateMetadata({ params }: { params: { handle: string } }): Metadata {
  const product = getProductByHandle(params.handle);
  if (!product) return {};
  return {
    title: `${product.name} — ${SHOP_NAME}`,
    description: `Réf. ${product.sku} — à partir de ${formatFcfa(product.unitPrice, "fr")}. ${product.description}`,
  };
}

export default function ProductPage({ params }: { params: { handle: string } }) {
  const product = getProductByHandle(params.handle);
  if (!product) notFound();

  return (
    <SiteShell
      tokens={DAKAR_DISTRIBUTION_DESIGN_TOKENS}
      animationLevel={DAKAR_DISTRIBUTION_DESIGN_TOKENS.animation.level}
    >
      <Header
        shopName={SHOP_NAME}
        navItems={DEMO_NAV_ITEMS}
        searchSuggestions={DEMO_SEARCH_SUGGESTIONS}
      />
      {/* Header solide, fixe : `B2BProductDetail` compense sa hauteur en interne
          (`pt-16 lg:pt-20`, moins généreux que la fiche consommateur car pas de photo
          plein cadre en haut de page). */}
      <main style={{ paddingTop: "var(--header-height)" }}>
        <B2BProductDetail product={product} locale="fr" />
        <FeaturedProductsSection variant="grid" content={getRelatedProducts()} locale="fr" />
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
