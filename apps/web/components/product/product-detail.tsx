"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ProductGallery } from "@/components/product/product-gallery";
import { Button } from "@/components/ui/button";
import { Magnetic } from "@/lib/motion/magnetic";
import { HeartIcon, CheckIcon, TruckIcon, ReturnIcon, ShieldIcon } from "@/components/ui/icons";
import { formatFcfa } from "@/lib/format";
import { t, type Locale } from "@/lib/i18n";
import type { ProductColorOption } from "@/components/ui/product-card";
import { useCart } from "@/lib/commerce/cart-context";
import { useFavorites } from "@/lib/commerce/favorites-context";

/**
 * Props entièrement typées, sans logique métier ni contenu codé dans le composant —
 * voir la revue du 16 septembre 2026, point 3. `ProductDetail` ne sait rien de
 * "Maison Almadies" : il reçoit un `product` et l'affiche, ce qui le rend directement
 * compatible avec une future route dynamique par identifiant (voir
 * app/demo/luxury-minimal/produit/[handle]/page.tsx, déjà bâti sur ce principe).
 */
export interface ProductDetailData {
  id: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  description: string;
  materialNote: string;
  images: string[];
  colors: ProductColorOption[];
  sizes: string[];
  /** Absent = en stock. */
  inStock?: boolean;
  href?: string;
}

export function ProductDetail({ product, locale }: { product: ProductDetailData; locale: Locale }) {
  const { addLine } = useCart();
  const { isFavorited, toggle } = useFavorites();
  const [color, setColor] = useState(product.colors[0]!.hex);
  const [size, setSize] = useState(product.sizes[1] ?? product.sizes[0]);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [openPanel, setOpenPanel] = useState<string | null>("description");
  const inStock = product.inStock !== false;
  const favorited = isFavorited(product.id);

  function handleAddToCart() {
    if (!inStock) return;
    const colorLabel = product.colors.find((c) => c.hex === color)?.label;
    const variant = [colorLabel, size].filter(Boolean).join(" / ") || undefined;
    addLine({
      id: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.images[0]!,
      quantity,
      variant,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }

  function handleToggleFavorite() {
    toggle({ id: product.id, name: product.name, price: product.price, imageUrl: product.images[0]!, href: product.href });
  }

  return (
    <div className="mx-auto max-w-[var(--content-max-width)] px-6 pb-32 pt-32 lg:px-10 lg:pb-24 lg:pt-40">
      <nav aria-label="Fil d'Ariane" className="mb-8 text-[length:var(--text-body-xs)] text-[var(--color-text-muted)]">
        <a href="/" className="hover:text-[var(--color-primary)]">
          {locale === "en" ? "Home" : "Accueil"}
        </a>{" "}
        / <span className="text-[var(--color-text-primary)]">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-20">
        <ProductGallery images={product.images} alt={product.name} />

        <div>
          <h1 className="font-[family-name:var(--font-heading)] text-[var(--color-text-primary)] text-[length:var(--text-heading-lg)]">
            {product.name}
          </h1>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="font-semibold text-[var(--color-text-primary)] text-[length:var(--text-heading-xs)]">
              {formatFcfa(product.price, locale)}
            </span>
            {product.compareAtPrice && (
              <span className="text-[var(--color-text-muted)] text-[length:var(--text-body-md)] line-through">
                {formatFcfa(product.compareAtPrice, locale)}
              </span>
            )}
          </div>
          {!inStock && (
            <p className="mt-3 font-medium text-[var(--color-danger)] text-[length:var(--text-body-sm)]">
              {locale === "en" ? "Sold out" : "Rupture de stock"}
            </p>
          )}

          <p className="mt-6 max-w-md text-[var(--color-text-secondary)] text-[length:var(--text-body-md)]">
            {product.description}
          </p>

          <div className="mt-8">
            <p className="mb-3 uppercase tracking-[0.1em] text-[var(--color-text-muted)] text-[length:var(--text-body-xs)]">
              {locale === "en" ? "Color" : "Couleur"}
            </p>
            <div className="flex gap-2">
              {product.colors.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  aria-label={c.label}
                  aria-pressed={color === c.hex}
                  onClick={() => setColor(c.hex)}
                  className={`h-9 w-9 rounded-full border-2 transition ${
                    color === c.hex ? "border-[var(--color-primary)]" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>

          <div className="mt-6">
            <p className="mb-3 uppercase tracking-[0.1em] text-[var(--color-text-muted)] text-[length:var(--text-body-xs)]">
              {locale === "en" ? "Size" : "Taille"}
            </p>
            <div className="flex gap-2">
              {product.sizes.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={size === s}
                  onClick={() => setSize(s)}
                  className={`flex h-11 w-11 items-center justify-center border text-[length:var(--text-body-sm)] transition ${
                    size === s
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                      : "border-[var(--color-border)] text-[var(--color-text-primary)]"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 hidden items-stretch gap-3 lg:flex">
            <div className="flex items-center border border-[var(--color-border)]">
              <button
                type="button"
                aria-label="-"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="px-4 py-3 text-[var(--color-text-primary)]"
              >
                −
              </button>
              <span className="w-8 text-center text-[length:var(--text-body-sm)]">{quantity}</span>
              <button
                type="button"
                aria-label="+"
                onClick={() => setQuantity((q) => q + 1)}
                className="px-4 py-3 text-[var(--color-text-primary)]"
              >
                +
              </button>
            </div>
            <Magnetic className="flex-1">
              <Button onClick={handleAddToCart} disabled={!inStock} className="w-full" size="xl">
                <AnimatePresence mode="wait" initial={false}>
                  {!inStock ? (
                    <motion.span key="out-of-stock" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      {locale === "en" ? "Sold out" : "Rupture de stock"}
                    </motion.span>
                  ) : added ? (
                    <motion.span
                      key="added"
                      className="flex items-center gap-2"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <CheckIcon className="h-4 w-4" />
                      {locale === "en" ? "Added to cart" : "Ajouté au panier"}
                    </motion.span>
                  ) : (
                    <motion.span key="add" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      {t(locale, "product.add_to_cart")}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Button>
            </Magnetic>
            <button
              type="button"
              onClick={handleToggleFavorite}
              aria-label={locale === "en" ? "Add to wishlist" : "Ajouter aux favoris"}
              aria-pressed={favorited}
              className="flex h-[58px] w-[58px] shrink-0 items-center justify-center border border-[var(--color-border)] text-[var(--color-primary)]"
            >
              <HeartIcon filled={favorited} className="h-5 w-5" />
            </button>
          </div>

          <dl className="mt-10 grid grid-cols-1 gap-4 border-y border-[var(--color-border)] py-6 sm:grid-cols-3">
            <div className="flex items-start gap-2">
              <TruckIcon className="h-5 w-5 shrink-0 text-[var(--color-primary)]" />
              <dt className="text-[length:var(--text-body-xs)] text-[var(--color-text-secondary)]">
                {locale === "en" ? "24h delivery in Dakar" : "Livraison 24h à Dakar"}
              </dt>
            </div>
            <div className="flex items-start gap-2">
              <ShieldIcon className="h-5 w-5 shrink-0 text-[var(--color-primary)]" />
              <dt className="text-[length:var(--text-body-xs)] text-[var(--color-text-secondary)]">
                {locale === "en" ? "Secure payment" : "Paiement sécurisé"}
              </dt>
            </div>
            <div className="flex items-start gap-2">
              <ReturnIcon className="h-5 w-5 shrink-0 text-[var(--color-primary)]" />
              <dt className="text-[length:var(--text-body-xs)] text-[var(--color-text-secondary)]">
                {locale === "en" ? "14-day returns" : "Retours sous 14 jours"}
              </dt>
            </div>
          </dl>

          <div className="mt-2 divide-y divide-[var(--color-border)]">
            {[
              { id: "description", label: locale === "en" ? "Description" : "Description", body: product.description },
              {
                id: "material",
                label: locale === "en" ? "Material & craftsmanship" : "Matière & fabrication",
                body: product.materialNote,
              },
              {
                id: "delivery",
                label: locale === "en" ? "Delivery & returns" : "Livraison & retours",
                body:
                  locale === "en"
                    ? "24h delivery in Dakar, 3–5 business days elsewhere in Senegal. Free returns within 14 days."
                    : "Livraison 24h à Dakar, 3 à 5 jours ouvrés ailleurs au Sénégal. Retours gratuits sous 14 jours.",
              },
            ].map((panel) => (
              <div key={panel.id}>
                <button
                  type="button"
                  onClick={() => setOpenPanel((current) => (current === panel.id ? null : panel.id))}
                  aria-expanded={openPanel === panel.id}
                  className="flex w-full items-center justify-between py-4 text-left font-medium text-[var(--color-text-primary)]"
                >
                  {panel.label}
                  <span aria-hidden="true" style={{ transform: openPanel === panel.id ? "rotate(45deg)" : "none" }} className="transition-transform">
                    +
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {openPanel === panel.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <p className="pb-4 text-[var(--color-text-muted)] text-[length:var(--text-body-sm)]">
                        {panel.body}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Barre d'action mobile — voir la refonte artistique du 16 septembre 2026
          (« barre d'action sur les fiches produits »), toujours accessible au pouce. */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-[var(--color-border)] bg-[var(--color-background)] p-4 lg:hidden">
        <span className="shrink-0 font-semibold text-[var(--color-text-primary)] text-[length:var(--text-body-md)]">
          {formatFcfa(product.price, locale)}
        </span>
        <Button
          onClick={handleAddToCart}
          disabled={!inStock}
          className="flex-1 justify-center whitespace-nowrap text-[length:var(--text-body-sm)]"
        >
          {!inStock
            ? locale === "en"
              ? "Sold out"
              : "Rupture"
            : added
              ? locale === "en"
                ? "Added ✓"
                : "Ajouté ✓"
              : t(locale, "product.add_to_cart")}
        </Button>
        <button
          type="button"
          onClick={handleToggleFavorite}
          aria-label={locale === "en" ? "Add to wishlist" : "Ajouter aux favoris"}
          aria-pressed={favorited}
          className="flex h-[52px] w-[52px] shrink-0 items-center justify-center border border-[var(--color-border)] text-[var(--color-primary)]"
        >
          <HeartIcon filled={favorited} className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
