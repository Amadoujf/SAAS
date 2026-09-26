import Link from "next/link";
import { QuickViewButton } from "./quick-view";

export interface StoreProductCard {
  id?: string;
  slug: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
  imageUrl: string | null;
  soldOut: boolean;
  category?: string | null;
}

const fmt = (n: number) => new Intl.NumberFormat("fr-SN").format(n);

/** Carte produit : lien vers la fiche + bouton d'aperçu rapide (frère du lien, jamais
 *  imbriqué dedans). Réagit au survol (zoom de l'image, bouton qui apparaît). */
export function ProductCard({ product, priority = false, quickView = true }: { product: StoreProductCard; priority?: boolean; quickView?: boolean }) {
  const discount = product.compareAtPrice && product.compareAtPrice > product.price ? Math.round((1 - product.price / product.compareAtPrice) * 100) : 0;
  return (
    <div className="group relative">
    <Link href={`/p/${product.slug}`} className="flex flex-col gap-3 rounded-[var(--radius-lg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-4">
      <span className="relative block aspect-[4/5] overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-surface-muted)]">
        {product.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt={product.name} loading={priority ? "eager" : "lazy"} width={800} height={1000} className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]" />
        )}
        <span className="absolute left-3 top-3 flex gap-1.5">
          {discount > 0 && <span className="rounded-full bg-[var(--color-danger)] px-2.5 py-1 text-xs font-bold text-white">-{discount}%</span>}
          {product.soldOut && <span className="rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold text-white">Épuisé</span>}
        </span>
      </span>
      <span className="flex flex-col gap-0.5 px-0.5">
        {product.category && <span className="text-xs uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{product.category}</span>}
        <span className="font-semibold leading-snug">{product.name}</span>
        <span className="flex items-baseline gap-2 tabular-nums">
          <span className="font-semibold">{fmt(product.price)} FCFA</span>
          {discount > 0 && <span className="text-sm text-[var(--color-text-muted)] line-through">{fmt(product.compareAtPrice!)}</span>}
        </span>
      </span>
    </Link>
    {quickView && !product.soldOut && (
      <QuickViewButton slug={product.slug} name={product.name} className="absolute right-3 top-3 sm:translate-y-1 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100 sm:focus-visible:translate-y-0 sm:focus-visible:opacity-100" />
    )}
    </div>
  );
}
