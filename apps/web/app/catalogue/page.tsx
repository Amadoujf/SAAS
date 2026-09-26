import Link from "next/link";
import type { Metadata } from "next";
import { resolveStore } from "@/lib/storefront/store-context";
import { loadProductCards } from "@/lib/storefront/catalog-view";
import { withTenant, listCategories } from "@yamacommerce/database";
import { StoreShell } from "@/components/store/store-shell";
import { ProductCard } from "@/components/store/product-card";
import { PublicSiteSuspended } from "@/components/public-site-suspended";
import { PublicSiteBillingSuspended } from "@/components/public-site-billing-suspended";

export const metadata: Metadata = { title: "Catalogue" };

/** Catalogue public RÉEL — mêmes protections domaine/tenant suspendu que le reste du
 *  site (voir `resolveStore`), design tokens de l'entreprise. */
export default async function CataloguePage({ searchParams }: { searchParams: { categorie?: string } }) {
  const resolution = await resolveStore(`/catalogue`);
  if (resolution.status === "suspended") return <PublicSiteSuspended tenantName={resolution.tenantName} />;
  if (resolution.status === "billing_suspended") return <PublicSiteBillingSuspended tenantName={resolution.tenantName} />;
  const { store } = resolution;
  const categories = await withTenant(store.tenantId, (tx) => listCategories(tx, store.tenantId));
  const category = searchParams.categorie ? categories.find((c) => c.slug === searchParams.categorie) : undefined;
  const products = await loadProductCards(store.tenantId, { categoryId: category?.id });

  return (
    <StoreShell store={store}>
      <section className="mx-auto max-w-[var(--content-max-width,1280px)] px-4 pb-6 pt-10 sm:px-6 sm:pt-14">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">{store.tenantName}</p>
        <h1 className="mt-2 font-[family-name:var(--font-heading)] text-[length:var(--text-heading-xl,2.5rem)] font-semibold leading-[1.05] tracking-tight">
          {category ? category.name : "Toute la collection"}
        </h1>
        <p className="mt-2 text-[var(--color-text-muted)]">{products.length} pièce{products.length > 1 ? "s" : ""}</p>
        {categories.length > 0 && (
          <nav aria-label="Catégories" className="-mx-4 mt-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <ul className="flex w-max gap-2">
              {[{ slug: "", name: "Tout" }, ...categories].map((c) => {
                const active = (c.slug || undefined) === searchParams.categorie;
                return (
                  <li key={c.slug || "tout"}>
                    <Link href={c.slug ? `/catalogue?categorie=${encodeURIComponent(c.slug)}` : "/catalogue"} aria-current={active ? "page" : undefined}
                      className={`block rounded-[var(--radius-full)] px-4 py-2 text-sm font-semibold ring-1 ring-inset transition ${active ? "bg-[var(--color-text-primary)] text-[var(--color-background)] ring-[var(--color-text-primary)]" : "ring-[var(--color-border)] hover:ring-[var(--color-text-primary)]"}`}>
                      {c.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </section>
      <section className="mx-auto max-w-[var(--content-max-width,1280px)] px-4 sm:px-6">
        {products.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] px-6 py-20 text-center">
            <p className="font-[family-name:var(--font-heading)] text-xl font-semibold">Aucun produit ici pour le moment</p>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">Revenez bientôt, ou explorez les autres catégories.</p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 xl:grid-cols-4">
            {products.map((p, i) => (
              <li key={p.slug}><ProductCard product={p} priority={i < 4} /></li>
            ))}
          </ul>
        )}
      </section>
    </StoreShell>
  );
}
