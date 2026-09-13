"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { t, type Locale } from "@/lib/i18n";
import { CloseIcon } from "@/components/ui/icons";
import type { ProductCardData, ProductColorOption } from "@/components/ui/product-card";
import { useCart } from "@/lib/commerce/cart-context";
import { useCurrency } from "@/lib/commerce/currency-context";

const DEFAULT_SIZES = ["S", "M", "L"];
/** Repli générique quand un produit ne définit pas ses propres couleurs — référence
 *  les tokens du template (`var(--color-...)`) plutôt que des teintes propres à une
 *  entreprise (voir la revue du 16 septembre 2026, point 1). */
const DEFAULT_COLORS: ProductColorOption[] = [
  { label: "Ton foncé", hex: "var(--color-primary)" },
  { label: "Ton clair", hex: "var(--color-champagne)" },
];

/**
 * Aperçu rapide produit — voir la refonte artistique du 16 septembre 2026
 * (« choix des variantes », « aperçu rapide »). Les couleurs/tailles viennent
 * désormais de `product.colors`/`product.sizes` (données produit typées — revue du
 * 16 septembre 2026, point 3) ; à défaut, un repli générique neutre s'applique.
 * L'ajout au panier écrit réellement dans `useCart()` (plus un simple minuteur local).
 */
export function QuickView({
  open,
  onClose,
  product,
  locale,
}: {
  open: boolean;
  onClose: () => void;
  product: ProductCardData;
  locale: Locale;
}) {
  const { addLine } = useCart();
  const { formatPrice } = useCurrency();
  const colors = product.colors && product.colors.length > 0 ? product.colors : DEFAULT_COLORS;
  const sizes = product.sizes && product.sizes.length > 0 ? product.sizes : DEFAULT_SIZES;
  const inStock = product.inStock !== false;
  const [size, setSize] = useState(sizes[Math.min(1, sizes.length - 1)]);
  const [color, setColor] = useState(colors[0]!.hex);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  function handleAddToCart() {
    if (!inStock) return;
    const colorLabel = colors.find((c) => c.hex === color)?.label;
    const variant = [colorLabel, size].filter(Boolean).join(" / ") || undefined;
    addLine({
      id: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
      variant,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={product.name}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[65] flex items-center justify-center bg-black/50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, transform: "scale(0.96)" }}
            animate={{ opacity: 1, transform: "scale(1)" }}
            exit={{ opacity: 0, transform: "scale(0.96)" }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="relative grid w-full max-w-3xl grid-cols-1 overflow-hidden bg-[var(--color-background)] sm:grid-cols-2"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label={locale === "en" ? "Close" : "Fermer"}
              className="absolute right-4 top-4 z-10 text-[var(--color-text-primary)]"
            >
              <CloseIcon />
            </button>
            <div className="relative aspect-[4/5] sm:aspect-auto">
              <Image src={product.imageUrl} alt={product.name} fill className="object-cover" />
            </div>
            <div className="flex flex-col justify-center p-8 lg:p-10">
              <h3 className="font-[family-name:var(--font-heading)] text-[length:var(--text-heading-sm)] text-[var(--color-text-primary)]">
                {product.name}
              </h3>
              <p className="mt-2 text-[length:var(--text-body-lg)] font-semibold text-[var(--color-text-primary)]">
                {formatPrice(product.price, locale)}
              </p>
              {!inStock && (
                <p className="mt-2 text-[length:var(--text-body-sm)] text-[var(--color-danger)]">
                  {locale === "en" ? "Sold out" : "Rupture de stock"}
                </p>
              )}

              <div className="mt-8">
                <p className="mb-3 text-[length:var(--text-body-xs)] uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
                  {locale === "en" ? "Color" : "Couleur"}
                </p>
                <div className="flex gap-2">
                  {colors.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      aria-label={c.label}
                      aria-pressed={color === c.hex}
                      onClick={() => setColor(c.hex)}
                      className={`h-8 w-8 rounded-full border-2 transition ${
                        color === c.hex ? "border-[var(--color-primary)]" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-6">
                <p className="mb-3 text-[length:var(--text-body-xs)] uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
                  {locale === "en" ? "Size" : "Taille"}
                </p>
                <div className="flex gap-2">
                  {sizes.map((s) => (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={size === s}
                      onClick={() => setSize(s)}
                      className={`flex h-10 w-10 items-center justify-center border text-[length:var(--text-body-sm)] transition ${
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

              <button
                type="button"
                onClick={handleAddToCart}
                disabled={!inStock}
                className="mt-9 bg-[var(--color-primary)] py-3.5 text-[length:var(--text-body-sm)] font-medium uppercase tracking-[0.06em] text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {!inStock
                  ? locale === "en"
                    ? "Sold out"
                    : "Rupture de stock"
                  : added
                    ? locale === "en"
                      ? "Added ✓"
                      : "Ajouté ✓"
                    : t(locale, "product.add_to_cart")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
