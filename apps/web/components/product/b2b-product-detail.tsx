"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/commerce/cart-context";
import { useCurrency } from "@/lib/commerce/currency-context";
import type { Locale } from "@/lib/i18n";

export interface PriceTier {
  minQty: number;
  unitPrice: number;
}

/**
 * Fiche produit B2B — volontairement un composant SÉPARÉ de `ProductDetail` (voir
 * product-detail.tsx) plutôt qu'un ProductDetail avec une douzaine de champs B2B
 * optionnels : la mise en page (référence SKU, palier de prix, calcul de total,
 * entrepôt) et le PARCOURS (devis plutôt que variantes couleur/taille) sont trop
 * différents pour rester un seul composant lisible — voir Dakar Distribution Pro
 * (template 5, 20 septembre 2026). Le principe reste identique : props entièrement
 * typées, aucun contenu ni logique métier propre à une entreprise codé ici.
 */
export interface B2BProductDetailData {
  id: string;
  sku: string;
  name: string;
  description: string;
  images: string[];
  unitPrice: number;
  priceTiers: PriceTier[];
  moq: number;
  availableQty: number;
  packaging: string;
  leadTimeDays: number;
  warehouse: string;
  specSheetUrl?: string;
  href?: string;
}

function tierPriceFor(quantity: number, unitPrice: number, tiers: PriceTier[]): number {
  const applicable = [...tiers]
    .sort((a, b) => b.minQty - a.minQty)
    .find((tier) => quantity >= tier.minQty);
  return applicable?.unitPrice ?? unitPrice;
}

export function B2BProductDetail({
  product,
  locale,
}: {
  product: B2BProductDetailData;
  locale: Locale;
}) {
  const { addLine } = useCart();
  const { formatPrice } = useCurrency();
  const [quantity, setQuantity] = useState(product.moq);
  const [added, setAdded] = useState(false);

  const activeUnitPrice = tierPriceFor(quantity, product.unitPrice, product.priceTiers);
  const total = activeUnitPrice * quantity;
  const inStock = product.availableQty > 0;

  const sortedTiers = useMemo(
    () => [...product.priceTiers].sort((a, b) => a.minQty - b.minQty),
    [product.priceTiers],
  );

  function handleAddToOrder() {
    addLine({
      id: product.id,
      name: product.name,
      price: activeUnitPrice,
      imageUrl: product.images[0]!,
      quantity,
      variant: `${quantity} × (${product.packaging})`,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }

  return (
    <div className="mx-auto max-w-[var(--content-max-width)] px-6 pb-24 pt-16 lg:px-10 lg:pt-20">
      <nav
        aria-label="Fil d'Ariane"
        className="mb-6 text-[length:var(--text-body-xs)] text-[var(--color-text-muted)]"
      >
        <a href="/" className="hover:text-[var(--color-primary)]">
          Accueil
        </a>{" "}
        / <span className="text-[var(--color-text-primary)]">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-14">
        <div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--card-radius)] bg-[var(--color-surface-muted)]">
            <Image
              src={product.images[0]!}
              alt={product.name}
              fill
              sizes="(max-width: 1024px) 100vw, 60vw"
              className="object-cover"
            />
          </div>

          <h1 className="mt-6 font-[family-name:var(--font-heading)] text-[length:var(--text-heading-lg)] text-[var(--color-text-primary)]">
            {product.name}
          </h1>
          <p className="mt-1 text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
            Réf. SKU : <span className="font-mono">{product.sku}</span>
          </p>
          <p className="mt-4 max-w-2xl text-[length:var(--text-body-md)] text-[var(--color-text-secondary)]">
            {product.description}
          </p>

          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-left text-[length:var(--text-body-sm)]">
              <caption className="mb-2 text-left text-[length:var(--text-body-xs)] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                Tarifs par palier de quantité
              </caption>
              <thead>
                <tr className="border-b border-[var(--color-border)] text-[var(--color-text-muted)]">
                  <th className="py-2 pr-4">Quantité</th>
                  <th className="py-2 pr-4">Prix unitaire</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  className={
                    activeUnitPrice === product.unitPrice
                      ? "font-semibold text-[var(--color-primary)]"
                      : ""
                  }
                >
                  <td className="py-2 pr-4">
                    1 – {sortedTiers[0] ? sortedTiers[0].minQty - 1 : product.moq - 1}
                  </td>
                  <td className="py-2 pr-4">{formatPrice(product.unitPrice, locale)}</td>
                </tr>
                {sortedTiers.map((tier, index) => {
                  const next = sortedTiers[index + 1];
                  const isActive = activeUnitPrice === tier.unitPrice && quantity >= tier.minQty;
                  return (
                    <tr
                      key={tier.minQty}
                      className={isActive ? "font-semibold text-[var(--color-primary)]" : ""}
                    >
                      <td className="py-2 pr-4">
                        {tier.minQty}
                        {next ? ` – ${next.minQty - 1}` : "+"}
                      </td>
                      <td className="py-2 pr-4">{formatPrice(tier.unitPrice, locale)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-4 border-t border-[var(--color-border)] pt-6 text-[length:var(--text-body-sm)] sm:grid-cols-3">
            <div>
              <dt className="text-[var(--color-text-muted)]">Quantité minimale</dt>
              <dd className="font-medium text-[var(--color-text-primary)]">{product.moq} unités</dd>
            </div>
            <div>
              <dt className="text-[var(--color-text-muted)]">Disponible</dt>
              <dd className="font-medium text-[var(--color-text-primary)]">
                {inStock ? `${product.availableQty} unités` : "Rupture de stock"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-text-muted)]">Conditionnement</dt>
              <dd className="font-medium text-[var(--color-text-primary)]">{product.packaging}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-text-muted)]">Délai d&apos;approvisionnement</dt>
              <dd className="font-medium text-[var(--color-text-primary)]">
                {product.leadTimeDays} jours
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-text-muted)]">Entrepôt</dt>
              <dd className="font-medium text-[var(--color-text-primary)]">{product.warehouse}</dd>
            </div>
          </dl>

          {product.specSheetUrl && (
            <a
              href={product.specSheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 text-[length:var(--text-body-sm)] text-[var(--color-primary)] underline underline-offset-2"
            >
              Télécharger la fiche technique (PDF)
            </a>
          )}
        </div>

        {/* Bloc de commande — volontairement dans une colonne latérale distincte
            (jamais mélangé au descriptif) : c'est la zone que scanne un acheteur
            professionnel pressé. */}
        <aside className="h-fit rounded-[var(--card-radius)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <p className="text-[length:var(--text-body-xs)] text-[var(--color-text-muted)]">
            Prix unitaire actuel
          </p>
          <p className="mt-1 font-[family-name:var(--font-heading)] text-[length:var(--text-heading-md)] text-[var(--color-text-primary)]">
            {formatPrice(activeUnitPrice, locale)}
          </p>

          <label
            htmlFor="b2b-quantity"
            className="mt-6 block text-[length:var(--text-body-xs)] text-[var(--color-text-muted)]"
          >
            Quantité (minimum {product.moq})
          </label>
          <div className="mt-2 flex items-center border border-[var(--color-border)]">
            <button
              type="button"
              aria-label="Diminuer la quantité"
              onClick={() => setQuantity((q) => Math.max(product.moq, q - product.moq))}
              className="px-4 py-3 text-[var(--color-text-primary)]"
            >
              −
            </button>
            <input
              id="b2b-quantity"
              type="number"
              min={product.moq}
              step={product.moq}
              value={quantity}
              onChange={(event) =>
                setQuantity(Math.max(product.moq, Number(event.target.value) || product.moq))
              }
              className="w-full flex-1 border-x border-[var(--color-border)] bg-transparent py-3 text-center text-[var(--color-text-primary)] outline-none"
            />
            <button
              type="button"
              aria-label="Augmenter la quantité"
              onClick={() => setQuantity((q) => q + product.moq)}
              className="px-4 py-3 text-[var(--color-text-primary)]"
            >
              +
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border)] pt-4 text-[length:var(--text-body-md)]">
            <span className="text-[var(--color-text-muted)]">Total estimé</span>
            <span className="font-semibold text-[var(--color-text-primary)]">
              {formatPrice(total, locale)}
            </span>
          </div>

          <Button
            onClick={handleAddToOrder}
            disabled={!inStock}
            className="mt-4 w-full justify-center"
          >
            {!inStock
              ? "Rupture de stock"
              : added
                ? "Ajouté au bon de commande ✓"
                : "Ajouter au bon de commande"}
          </Button>
          <Button
            href={`/demo/dakar-distribution-pro/demande-devis?produit=${encodeURIComponent(product.sku)}`}
            variant="outline"
            className="mt-3 w-full justify-center"
          >
            Demander un devis
          </Button>
        </aside>
      </div>
    </div>
  );
}
