import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { SiteShell } from "@/components/site-shell";
import { ProductDetail } from "@/components/product/product-detail";
import { FeaturedProductsSection } from "@/components/sections/featured-products";
import { formatFcfa } from "@/lib/format";
import {
  DEMO_FOOTER_GROUPS,
  DEMO_NAV_ITEMS,
  DEMO_SEARCH_SUGGESTIONS,
  MARKETPLACE_DESIGN_TOKENS,
  SHOP_NAME,
  SHOP_TAGLINE,
  WHATSAPP_NUMBER,
  getAllProductHandles,
  getProductByHandle,
  getRelatedProducts,
} from "@/lib/demo/marketplace-template";

export function generateStaticParams() {
  return getAllProductHandles().map((handle) => ({ handle }));
}

export function generateMetadata({ params }: { params: { handle: string } }): Metadata {
  const product = getProductByHandle(params.handle);
  if (!product) return {};
  return {
    title: `${product.name} — ${SHOP_NAME}`,
    description: `${product.name} — ${formatFcfa(product.price, "fr")}. ${product.description}`,
  };
}

export default function ProductPage({ params }: { params: { handle: string } }) {
  const product = getProductByHandle(params.handle);
  if (!product) notFound();

  return (
    <SiteShell
      tokens={MARKETPLACE_DESIGN_TOKENS}
      animationLevel={MARKETPLACE_DESIGN_TOKENS.animation.level}
    >
      <Header
        shopName={SHOP_NAME}
        navItems={DEMO_NAV_ITEMS}
        searchSuggestions={DEMO_SEARCH_SUGGESTIONS}
      />
      {/* Pas de padding-top ici : `ProductDetail` compense déjà la hauteur du header
          fixe en interne (`pt-32 lg:pt-40`) — voir product-detail.tsx. L'ajouter aussi
          ici doublerait l'espace au-dessus de la fiche produit. */}
      <main>
        <ProductDetail product={product} locale="fr" />
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
