"use client";

import { useState } from "react";
import Image from "next/image";
import { MissingPhoto } from "./missing-photo";
import { AnimatePresence, motion } from "framer-motion";
import { useAnimationLevel } from "@/lib/motion/animation-level-context";
import { t, type Locale } from "@/lib/i18n";
import { HeartIcon, EyeIcon, CheckIcon } from "@/components/ui/icons";
import { QuickView } from "@/components/ui/quick-view";
import { useCart } from "@/lib/commerce/cart-context";
import { useFavorites } from "@/lib/commerce/favorites-context";
import { useCurrency } from "@/lib/commerce/currency-context";

/**
 * Carte produit générique — contrat commun `CardItem` évoqué en
 * docs/12 §12.7 (« un seul composant de présentation pour tous les secteurs »),
 * ici spécialisé e-commerce (prix, badge, ajout au panier, favori, aperçu rapide —
 * voir la refonte artistique du 16 septembre 2026).
 *
 * `hoverImageUrl` et `href` restent optionnels : une entreprise qui n'a encore
 * photographié qu'un seul angle par produit, ou pas encore de fiche produit publiée,
 * garde un rendu complet et cohérent (pas de survol de substitution, carte non
 * cliquable vers une fiche).
 */
/** Une option de couleur — `hex` accepte aussi bien une couleur littérale qu'une
 *  référence `var(--color-...)`, pour rester rattachée aux tokens du template plutôt
 *  qu'à une couleur propre à une entreprise (voir la revue du 16 septembre 2026,
 *  point 1 : « aucune couleur propre à Maison Almadies ne doit rester codée en dur »). */
export interface ProductColorOption {
  label: string;
  hex: string;
}

export interface ProductCardData {
  id: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  imageUrl: string;
  hoverImageUrl?: string;
  badge?: string;
  href?: string;
  /** Variantes — voir la revue du 16 septembre 2026, point 3 : les variantes doivent
   *  provenir des données produit, jamais être codées dans le composant d'aperçu. */
  colors?: ProductColorOption[];
  sizes?: string[];
  /** Absent = en stock (comportement historique inchangé pour les données existantes). */
  inStock?: boolean;
}

export function ProductCard({ product, locale }: { product: ProductCardData; locale: Locale }) {
  const level = useAnimationLevel();
  const { addLine } = useCart();
  const { isFavorited, toggle } = useFavorites();
  const { formatPrice } = useCurrency();
  const favorited = isFavorited(product.id);
  const [added, setAdded] = useState(false);
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const revealActions = level !== "none" && level !== "discreet";
  const inStock = product.inStock !== false;

  function handleAddToCart(event: React.MouseEvent) {
    event.preventDefault();
    if (!inStock) return;
    addLine({
      id: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  }

  const Wrapper = product.href ? "a" : "div";

  return (
    <>
      <motion.article
        className="group relative flex flex-col"
        whileHover="hover"
        initial="rest"
        animate="rest"
      >
        <Wrapper
          {...(product.href ? { href: product.href, "data-cursor-hover": true } : {})}
          className="relative block aspect-[4/5] w-full overflow-hidden bg-[var(--color-surface-muted)]"
        >
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, 33vw"
              className={`object-cover transition-opacity duration-500 ${
                product.hoverImageUrl ? "group-hover:opacity-0" : "group-hover:scale-[1.04]"
              } ${!product.hoverImageUrl ? "transition-transform duration-[var(--motion-duration-slow)]" : ""}`}
            />
          ) : (
            <MissingPhoto />
          )}
          {product.hoverImageUrl && (
            <Image
              src={product.hoverImageUrl}
              alt=""
              aria-hidden="true"
              fill
              sizes="(max-width: 640px) 50vw, 33vw"
              className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            />
          )}

          {product.badge && (
            <span className="absolute left-4 top-4 rounded-[var(--radius-full)] bg-[var(--color-background)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-primary)]">
              {product.badge}
            </span>
          )}
          {!inStock && (
            <span className="absolute left-4 top-4 rounded-[var(--radius-full)] bg-[var(--color-text-primary)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-background)]">
              {locale === "en" ? "Sold out" : "Rupture de stock"}
            </span>
          )}

          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              toggle({
                id: product.id,
                name: product.name,
                price: product.price,
                imageUrl: product.imageUrl,
                href: product.href,
              });
            }}
            aria-label={locale === "en" ? "Add to wishlist" : "Ajouter aux favoris"}
            aria-pressed={favorited}
            className="bg-[var(--color-background)]/90 absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-primary)] opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          >
            <HeartIcon filled={favorited} className="h-4 w-4" />
          </button>

          {revealActions && (
            <motion.div
              variants={{
                rest: { transform: "translateY(100%)" },
                hover: { transform: "translateY(0%)" },
              }}
              transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
              className="absolute inset-x-0 bottom-0 flex"
            >
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={!inStock}
                className="hover:bg-[var(--color-primary)]/90 flex flex-1 items-center justify-center gap-2 bg-[var(--color-primary)] py-3.5 text-[13px] font-medium uppercase tracking-[0.06em] text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {!inStock ? (
                    <motion.span
                      key="out-of-stock"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      {locale === "en" ? "Sold out" : "Rupture de stock"}
                    </motion.span>
                  ) : added ? (
                    <motion.span
                      key="added"
                      className="flex items-center gap-2"
                      initial={{ opacity: 0, transform: "scale(0.8)" }}
                      animate={{ opacity: 1, transform: "scale(1)" }}
                      exit={{ opacity: 0, transform: "scale(0.8)" }}
                    >
                      <CheckIcon className="h-4 w-4" />
                      {locale === "en" ? "Added" : "Ajouté"}
                    </motion.span>
                  ) : (
                    <motion.span
                      key="add"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      {t(locale, "product.add_to_cart")}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  setQuickViewOpen(true);
                }}
                aria-label={locale === "en" ? "Quick view" : "Aperçu rapide"}
                className="hover:bg-[var(--color-primary)]/90 flex w-14 items-center justify-center border-l border-white/20 bg-[var(--color-primary)] text-white transition-colors"
              >
                <EyeIcon className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </Wrapper>
        <div className="flex flex-col gap-1.5 pt-4">
          <h3 className="text-[length:var(--text-body-md)] text-[var(--color-text-primary)]">
            {product.name}
          </h3>
          <div className="flex items-baseline gap-2.5">
            <span className="text-[length:var(--text-body-md)] font-semibold text-[var(--color-text-primary)]">
              {formatPrice(product.price, locale)}
            </span>
            {product.compareAtPrice && (
              <span className="text-[length:var(--text-body-sm)] text-[var(--color-text-muted)] line-through">
                {formatPrice(product.compareAtPrice, locale)}
              </span>
            )}
          </div>
        </div>
      </motion.article>

      <QuickView
        open={quickViewOpen}
        onClose={() => setQuickViewOpen(false)}
        product={product}
        locale={locale}
      />
    </>
  );
}
