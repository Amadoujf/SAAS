import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { SiteShell } from "@/components/site-shell";
import { ProductDetail } from "@/components/product/product-detail";
import { FeaturedProductsSection } from "@/components/sections/featured-products";
import { formatFcfa } from "@/lib/format";
import {
  DEMO_NAV_ITEMS,
  DEMO_SEARCH_SUGGESTIONS,
  LUXURY_MINIMAL_DESIGN_TOKENS,
  SHOP_NAME,
  SHOP_TAGLINE,
  WHATSAPP_NUMBER,
  getAllProductHandles,
  getProductByHandle,
  getRelatedProducts,
} from "@/lib/demo/luxury-minimal-template";

/**
 * Fiche produit — VRAIE route dynamique Next.js (voir la revue du 16 septembre 2026,
 * point 3 : « compatible avec une future route dynamique »). `generateStaticParams`
 * ne déclare aujourd'hui qu'un seul identifiant (une seule fiche complète existe dans
 * les données de démonstration), mais la page elle-même ne connaît que `params.handle`
 * — ajouter un produit ne demande qu'une entrée dans `PRODUCT_DETAILS_BY_HANDLE`
 * (lib/demo/luxury-minimal-template.ts), jamais une modification de cette page.
 */
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
      tokens={LUXURY_MINIMAL_DESIGN_TOKENS}
      animationLevel={LUXURY_MINIMAL_DESIGN_TOKENS.animation.level}
    >
      <Header
        shopName={SHOP_NAME}
        navItems={DEMO_NAV_ITEMS}
        searchSuggestions={DEMO_SEARCH_SUGGESTIONS}
      />
      <main>
        <ProductDetail product={product} locale="fr" />
        <FeaturedProductsSection variant="grid" content={getRelatedProducts()} locale="fr" />
      </main>
      <Footer
        shopName={SHOP_NAME}
        whatsappNumber={WHATSAPP_NUMBER}
        tagline={SHOP_TAGLINE}
        groups={[
          {
            title: "Boutique",
            links: [
              { label: "Toute la collection", href: "/catalogue" },
              { label: "Nouveautés", href: "/catalogue?tri=nouveaute" },
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
        ]}
      />
    </SiteShell>
  );
}
