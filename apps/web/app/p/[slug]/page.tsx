import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { withTenant, getProductBySlugForTenant } from "@yamacommerce/database";
import { resolveActiveTenant } from "@/lib/rendering/resolve-public-site";
import { resolveStore } from "@/lib/storefront/store-context";
import { loadProductCards } from "@/lib/storefront/catalog-view";
import { StoreShell } from "@/components/store/store-shell";
import { AddToCart } from "@/components/store/add-to-cart";
import { ProductCard } from "@/components/store/product-card";
import { IconPhone, IconTruck, IconWallet } from "@/components/yc/icons";
import { PublicSiteSuspended } from "@/components/public-site-suspended";
import { PublicSiteBillingSuspended } from "@/components/public-site-billing-suspended";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const active = await resolveActiveTenant((await headers()).get("host") ?? "");
  if (active.status !== "ok") return {};
  const product = await withTenant(active.tenantId, (tx) => getProductBySlugForTenant(tx, active.tenantId, params.slug, "PUBLISHED"));
  if (!product) return {};
  return { title: `${product.name} — ${active.tenantName}`, description: product.shortDescription ?? undefined };
}

/** Fiche produit publique : galerie, choix de variante avec stock réel, ajout au
 *  panier serveur, suggestions de la même catégorie (jamais bloquantes). */
export default async function ProductDetailPage({ params }: { params: { slug: string } }) {
  const resolution = await resolveStore(`/p/${params.slug}`);
  if (resolution.status === "suspended") return <PublicSiteSuspended tenantName={resolution.tenantName} />;
  if (resolution.status === "billing_suspended") return <PublicSiteBillingSuspended tenantName={resolution.tenantName} />;
  const { store } = resolution;
  const product = await withTenant(store.tenantId, (tx) => getProductBySlugForTenant(tx, store.tenantId, params.slug, "PUBLISHED"));
  if (!product) notFound();
  const suggestions = (await loadProductCards(store.tenantId, { categoryId: product.categoryId ?? undefined, excludeSlug: product.slug, limit: 12 })).slice(0, 4);
  const variants = product.variants.map((v) => ({ id: v.id, name: v.name, price: v.price, available: v.inventoryItems.reduce((s, i) => s + i.availableQuantity, 0) }));
  const images = product.images.length ? product.images : [];

  return (
    <StoreShell store={store}>
      <div className="mx-auto max-w-[var(--content-max-width,1280px)] px-4 pt-6 sm:px-6 sm:pt-10">
        <nav aria-label="Fil d'Ariane" className="mb-6 text-sm text-[var(--color-text-muted)]">
          <Link href="/catalogue" className="hover:underline">Catalogue</Link>
          {product.category && (<> <span aria-hidden="true">/</span> <Link href={`/catalogue?categorie=${product.category.slug}`} className="hover:underline">{product.category.name}</Link></>)}
        </nav>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0">
            {images.length === 0 ? (
              <div className="aspect-[4/5] w-full rounded-[var(--radius-lg)] bg-[var(--color-surface-muted)] sm:col-span-2" />
            ) : (
              images.map((img, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={img.id} src={img.url} alt={img.altText ?? product.name} width={800} height={1000} loading={i === 0 ? "eager" : "lazy"}
                  className={`aspect-[4/5] w-[85%] shrink-0 snap-center rounded-[var(--radius-lg)] object-cover sm:w-full ${i === 0 ? "sm:col-span-2" : ""}`} />
              ))
            )}
          </div>
          <div className="lg:sticky lg:top-24 lg:self-start">
            {product.category && <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">{product.category.name}</p>}
            <h1 className="mt-2 font-[family-name:var(--font-heading)] text-[length:var(--text-heading-lg,2rem)] font-semibold leading-tight tracking-tight">{product.name}</h1>
            {product.compareAtPrice && product.compareAtPrice > product.basePrice && (
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">Au lieu de <span className="line-through">{new Intl.NumberFormat("fr-SN").format(product.compareAtPrice)} FCFA</span></p>
            )}
            <div className="mt-6"><AddToCart variants={variants} /></div>
            {product.description && <p className="mt-8 leading-relaxed text-[var(--color-text-secondary)]">{product.description}</p>}
            <ul className="mt-8 grid gap-3 rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-5 text-sm">
              <li className="flex items-center gap-3"><IconTruck size={18} className="shrink-0 text-[var(--color-primary)]" />{product.isDeliverable ? "Livraison au Sénégal — tarif calculé selon votre zone" : "Disponible uniquement en retrait en boutique"}</li>
              <li className="flex items-center gap-3"><IconWallet size={18} className="shrink-0 text-[var(--color-primary)]" />Paiement à la livraison, Wave ou Orange Money</li>
              <li className="flex items-center gap-3"><IconPhone size={18} className="shrink-0 text-[var(--color-primary)]" />Suivi de commande avec votre numéro de téléphone</li>
            </ul>
          </div>
        </div>
        {suggestions.length > 0 && (
          <section className="mt-20" aria-labelledby="suggestions">
            <h2 id="suggestions" className="font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight">Vous aimerez aussi</h2>
            <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
              {suggestions.map((p) => <li key={p.slug}><ProductCard product={p} /></li>)}
            </ul>
          </section>
        )}
      </div>
    </StoreShell>
  );
}
