import Link from "next/link";
import { withTenant, getStorefrontCustomization } from "@yamacommerce/database";
import type { StoreContext } from "@/lib/storefront/store-context";
import { loadProductCards } from "@/lib/storefront/catalog-view";
import { parseHomeContent, type HomeContent } from "@/lib/storefront/home-content";
import { IconBox, IconCard, IconPhone, IconShield, IconTruck } from "@/components/yc/icons";
import { StoreShell } from "./store-shell";
import { ProductCard, type StoreProductCard } from "./product-card";
import { EditorialHero, MarketHero, type SlideProduct } from "./hero-carousel";
import { FeaturedProducts } from "./featured-products";
import { Reveal } from "./reveal";

const ICONS = {
  truck: IconTruck, box: IconBox, card: IconCard, phone: IconPhone, shield: IconShield,
  leaf: (p: { size?: number }) => (
    <svg width={p.size ?? 20} height={p.size ?? 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14" /><path d="M5 19 13 11" /></svg>
  ),
} as const;

function Arrow() {
  return <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>;
}

async function loadHome(store: StoreContext) {
  const [custom, products] = await Promise.all([
    withTenant(store.tenantId, (tx) => getStorefrontCustomization(tx, store.tenantId)),
    loadProductCards(store.tenantId, { limit: 200 }),
  ]);
  const content = parseHomeContent(custom.content, store.tenantName);
  const byId = new Map(products.map((p) => [p.id, p]));
  const featured = content.featuredProductIds.length
    ? content.featuredProductIds.map((id) => byId.get(id)).filter((p): p is StoreProductCard => !!p)
    : products.slice(0, 10);
  const catById = new Map(store.categories.map((c) => [c.id, c]));
  const categories = (content.featuredCategoryIds.length
    ? content.featuredCategoryIds.map((id) => catById.get(id)).filter((c): c is StoreContext["categories"][number] => !!c)
    : store.categories.slice(0, 5)
  ).map((c) => ({ ...c, imageUrl: c.imageUrl ?? products.find((p) => p.category === c.name)?.imageUrl ?? null }));
  const slideProducts: Record<string, SlideProduct> = {};
  for (const slide of content.hero.slides) {
    const p = slide.productId ? byId.get(slide.productId) : undefined;
    if (p && p.id) slideProducts[p.id] = { slug: p.slug, name: p.name, price: p.price, category: p.category ?? null };
  }
  return { content, featured, categories, slideProducts };
}

function Reassurance({ items, editorial }: { items: HomeContent["reassurance"]; editorial: boolean }) {
  if (!items.length) return null;
  return (
    <section aria-label="Nos engagements" className={editorial ? "border-y border-[var(--color-border)]" : "border-b border-[var(--color-border)] bg-[var(--color-background)]"}>
      <ul className="mx-auto grid max-w-[var(--content-max-width,1280px)] grid-cols-2 gap-x-6 gap-y-5 px-5 py-6 sm:px-10 lg:grid-cols-4">
        {items.map((r) => {
          const Icon = ICONS[r.icon];
          return (
            <li key={r.title} className="flex items-center gap-3">
              <span className="shrink-0 text-[var(--color-text-primary)]"><Icon size={24} /></span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold leading-tight">{r.title}</span>
                {r.text && <span className="block text-[12px] text-[var(--color-text-muted)]">{r.text}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SectionHead({ title, href, label = "Voir tout" }: { title: string; href: string; label?: string }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <h2 className="font-[family-name:var(--font-heading)] text-[28px] leading-tight tracking-[-0.01em] sm:text-[34px]">{title}</h2>
      <Link href={href} className="inline-flex shrink-0 items-center gap-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]">{label} <Arrow /></Link>
    </div>
  );
}

function MarketHome({ content, featured, categories, slideProducts }: { store: StoreContext } & Awaited<ReturnType<typeof loadHome>>) {
  return (
    <>
      <MarketHero slides={content.hero.slides} autoplaySeconds={content.hero.autoplaySeconds} products={slideProducts} />
      <Reassurance items={content.reassurance} editorial={false} />
      {categories.length > 0 && (
        <section className="mx-auto max-w-[var(--content-max-width,1280px)] px-5 pt-14 sm:px-10">
          <SectionHead title="Nos univers" href="/catalogue" />
          <Reveal as="ul" className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-5">
            {categories.map((c) => (
              <li key={c.id} className="w-[62vw] max-w-[260px] shrink-0 snap-start sm:w-auto sm:max-w-none">
                <Link href={`/catalogue?categorie=${c.slug}`} className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-4">
                  <span className="block aspect-[4/3] overflow-hidden bg-[var(--color-surface)]">
                    {c.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.05]" />
                    )}
                  </span>
                  <span className="mt-3 block text-[15px] font-medium">{c.name}</span>
                  <span className="mt-0.5 inline-flex items-center gap-1.5 text-[13px] text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)]">Découvrir <Arrow /></span>
                </Link>
              </li>
            ))}
          </Reveal>
        </section>
      )}
      {featured.length > 0 && (
        <section className="mx-auto max-w-[var(--content-max-width,1280px)] px-5 pt-14 sm:px-10">
          <SectionHead title="Une sélection pour vous" href="/catalogue" label="Voir toute la sélection" />
          <FeaturedProducts products={featured} columns={5} />
        </section>
      )}
      {content.collections.length > 0 && (
        <section className="mx-auto grid max-w-[var(--content-max-width,1280px)] gap-4 px-5 pt-14 sm:grid-cols-2 sm:px-10">
          {content.collections.map((col) => (
            <Link key={col.id} href={col.href || "/catalogue"} className="group relative block aspect-[16/10] overflow-hidden bg-[var(--color-primary)] text-white">
              {col.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={col.imageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-90 transition-transform duration-700 group-hover:scale-[1.04]" />
              )}
              <span className="absolute inset-0 bg-[linear-gradient(0deg,rgba(0,0,0,0.55),transparent_60%)]" />
              <span className="absolute inset-x-0 bottom-0 p-6">
                {col.eyebrow && <span className="block text-[11px] uppercase tracking-[0.24em] text-white/80">{col.eyebrow}</span>}
                <span className="mt-1 block font-[family-name:var(--font-heading)] text-[28px] leading-tight">{col.title}</span>
                {col.subtitle && <span className="mt-1 block text-sm text-white/85">{col.subtitle}</span>}
              </span>
            </Link>
          ))}
        </section>
      )}
    </>
  );
}

function EditorialHome({ store, content, featured, slideProducts }: { store: StoreContext } & Awaited<ReturnType<typeof loadHome>>) {
  const col = content.collections[0];
  const side = col?.imageUrl ? { url: col.imageUrl, alt: "", caption: col.eyebrow || col.title } : null;
  const [first, second] = content.collections;
  return (
    <>
      <EditorialHero slides={content.hero.slides} autoplaySeconds={content.hero.autoplaySeconds} tenantName={store.tenantName} sideImage={side} products={slideProducts} />
      {first && (
        <section className="mx-auto mt-16 grid max-w-[var(--content-max-width,1400px)] gap-4 px-4 sm:px-6 lg:grid-cols-[1fr_1fr_1fr]">
          <Link href={first.href || "/catalogue"} className="group relative block aspect-[4/3] overflow-hidden bg-[var(--color-muted-surface)] text-white lg:aspect-auto lg:min-h-[340px]">
            {first.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={first.imageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover grayscale-[35%] transition-transform duration-1000 group-hover:scale-[1.04]" />
            )}
            <span className="absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,0.5),transparent)] p-6 text-[11px] uppercase leading-relaxed tracking-[0.3em]">{first.eyebrow || first.title}</span>
          </Link>
          <div className="flex flex-col justify-center bg-[var(--color-surface)] px-8 py-12">
            <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--color-text-muted)]">{second?.eyebrow || "Nouvelle collection"}</p>
            <h2 className="mt-4 font-[family-name:var(--font-heading)] text-[40px] leading-[1.02] tracking-[-0.01em] sm:text-[48px]">{second?.title ?? first.title}</h2>
            <span className="mt-5 block h-px w-10 bg-[var(--color-text-primary)]" aria-hidden="true" />
            {(second?.subtitle || first.subtitle) && <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-[var(--color-text-secondary)]">{second?.subtitle || first.subtitle}</p>}
            <Link href={second?.href || first.href || "/catalogue"} className="mt-7 inline-flex w-fit items-center gap-3 border-b border-[var(--color-text-primary)] pb-1 text-[12px] uppercase tracking-[0.2em]">Découvrir <Arrow /></Link>
          </div>
          {second?.imageUrl ? (
            <Link href={second.href || "/catalogue"} className="group relative block aspect-[4/3] overflow-hidden lg:aspect-auto lg:min-h-[340px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={second.imageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 group-hover:scale-[1.04]" />
            </Link>
          ) : <div className="hidden lg:block" />}
        </section>
      )}
      {featured.length > 0 && (
        <section className="mx-auto mt-20 max-w-[var(--content-max-width,1400px)] px-4 sm:px-6">
          <SectionHead title="Pièces choisies" href="/catalogue" label="Toute la collection" />
          <FeaturedProducts products={featured.slice(0, 8)} columns={4} />
        </section>
      )}
      <div className="mt-20"><Reassurance items={content.reassurance} editorial /></div>
    </>
  );
}

/** Accueil d'une boutique sans site publié depuis l'éditeur : la composition du
 *  template choisi, alimentée par les contenus mis en avant de l'entreprise. */
export async function StoreHome({ store }: { store: StoreContext }) {
  const data = await loadHome(store);
  return (
    <StoreShell store={store}>
      {store.layout === "editorial" ? <EditorialHome store={store} {...data} /> : <MarketHome store={store} {...data} />}
    </StoreShell>
  );
}
