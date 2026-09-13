"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useAnimationLevel } from "@/lib/motion/animation-level-context";
import { hoverLift } from "@/lib/motion/variants";
import { formatFcfa } from "@/lib/format";

/**
 * Carte produit générique — contrat commun `CardItem` évoqué en
 * docs/12 §12.7 (« un seul composant de présentation pour tous les secteurs »),
 * ici spécialisé e-commerce (prix, badge, ajout au panier).
 */
export interface ProductCardData {
  id: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  imageUrl: string;
  badge?: string;
}

export function ProductCard({
  product,
  locale,
}: {
  product: ProductCardData;
  locale: "fr" | "en" | "wo";
}) {
  const level = useAnimationLevel();
  const hover = hoverLift(level);

  return (
    <motion.article
      className="group flex flex-col overflow-hidden rounded-[var(--card-radius)] border border-[var(--color-border)] bg-[var(--color-surface)] [box-shadow:var(--card-shadow)]"
      {...hover}
      transition={{ duration: 0.2 }}
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-[var(--color-surface-muted)]">
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 50vw, 25vw"
          className="object-cover transition-transform duration-[var(--motion-duration-slow)] group-hover:scale-105"
        />
        {product.badge && (
          <span className="absolute left-3 top-3 rounded-[var(--radius-full)] bg-[var(--color-secondary)] px-3 py-1 text-xs font-semibold text-white">
            {product.badge}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="font-medium text-[var(--color-text-primary)] text-[var(--text-body-md)]">
          {product.name}
        </h3>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-semibold text-[var(--color-text-primary)] text-[var(--text-body-md)]">
            {formatFcfa(product.price, locale)}
          </span>
          {product.compareAtPrice && (
            <span className="text-[var(--color-text-muted)] text-[var(--text-body-sm)] line-through">
              {formatFcfa(product.compareAtPrice, locale)}
            </span>
          )}
        </div>
      </div>
    </motion.article>
  );
}
