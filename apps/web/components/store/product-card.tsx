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

/** Variantes de la carte selon le cadre du site (attribut `data-frame` de la coque) :
 *  éditorial = portrait 3:4, nom en titre ; sculptural = format carré, pièce isolée,
 *  texte fin ; studio = angles vifs, nom en capitales grasses. Classes écrites en clair
 *  pour que Tailwind les génère. */
const FRAME_IMAGE = "group-data-[frame=editorial]/frame:aspect-[3/4] group-data-[frame=editorial]/frame:rounded-none group-data-[frame=sculptural]/frame:aspect-square group-data-[frame=sculptural]/frame:rounded-none group-data-[frame=studio]/frame:rounded-none";
const FRAME_TEXT = "group-data-[frame=editorial]/frame:items-center group-data-[frame=editorial]/frame:text-center group-data-[frame=editorial]/frame:gap-1 group-data-[frame=editorial]/frame:pt-1 group-data-[frame=sculptural]/frame:pt-1";
const FRAME_NAME = "group-data-[frame=editorial]/frame:font-[family-name:var(--font-heading)] group-data-[frame=editorial]/frame:text-[19px] group-data-[frame=editorial]/frame:font-normal group-data-[frame=sculptural]/frame:font-normal group-data-[frame=sculptural]/frame:text-[15px] group-data-[frame=studio]/frame:uppercase group-data-[frame=studio]/frame:font-extrabold group-data-[frame=studio]/frame:tracking-[-0.01em] group-data-[frame=studio]/frame:text-[15px]";
const FRAME_CATEGORY = "group-data-[frame=editorial]/frame:text-[10.5px] group-data-[frame=editorial]/frame:tracking-[0.24em] group-data-[frame=studio]/frame:font-bold group-data-[frame=studio]/frame:text-[var(--color-primary)]";


/** Carte produit : lien vers la fiche + bouton d'aperçu rapide (frère du lien, jamais
 *  imbriqué dedans). Réagit au survol (zoom de l'image, bouton qui apparaît). */
export function ProductCard({ product, priority = false, quickView = true }: { product: StoreProductCard; priority?: boolean; quickView?: boolean }) {
  const discount = product.compareAtPrice && product.compareAtPrice > product.price ? Math.round((1 - product.price / product.compareAtPrice) * 100) : 0;
  return (
    <div className="group relative">
    <Link href={`/p/${product.slug}`} className="flex flex-col gap-3 rounded-[var(--radius-lg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-4">
      <span className={`relative block aspect-[4/5] overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-surface-muted)] ${FRAME_IMAGE}`}>
        {product.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt={product.name} loading={priority ? "eager" : "lazy"} width={800} height={1000} className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]" />
        )}
        <span className="absolute left-3 top-3 flex gap-1.5">
          {discount > 0 && <span className="rounded-full bg-[var(--color-danger)] px-2.5 py-1 text-xs font-bold text-white">-{discount}%</span>}
          {product.soldOut && <span className="rounded-full bg-black/70 px-2.5 py-1 text-xs font-semibold text-white">Épuisé</span>}
        </span>
      </span>
      <span className={`flex flex-col gap-0.5 px-0.5 ${FRAME_TEXT}`}>
        {product.category && <span className={`text-xs uppercase tracking-[0.12em] text-[var(--color-text-muted)] ${FRAME_CATEGORY}`}>{product.category}</span>}
        <span className={`font-semibold leading-snug ${FRAME_NAME}`}>{product.name}</span>
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
