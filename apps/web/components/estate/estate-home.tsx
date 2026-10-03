import Link from "next/link";
import { withTenant, listProperties } from "@yamacommerce/database";
import type { EstateContext } from "@/lib/real-estate/estate-context";
import { toEstateCard, placeOf } from "@/lib/real-estate/estate-cards";
import { DEAL_TYPE_LABELS, formatPropertyPrice, propertyFacts } from "@/lib/real-estate/labels";
import { IconCard, IconPhone, IconShield } from "@/components/yc/icons";
import { Reveal } from "@/components/store/reveal";
import { EstateShell } from "./estate-shell";
import { EstateHero, EstateSearch, type SlideProperty } from "./estate-hero";
import { PropertyCard } from "./property-card";

const ICONS = {
  shield: IconShield,
  phone: IconPhone,
  card: IconCard,
} as const;

function SectionTitle({ eyebrow, title, href, label }: { eyebrow: string; title: string; href?: string; label?: string }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--color-accent-primary)]">{eyebrow}</p>
        <h2 className="mt-3 font-[family-name:var(--font-heading)] text-[34px] leading-[1.05] tracking-[-0.01em] sm:text-[46px]">{title}</h2>
      </div>
      {href && <Link href={href} className="inline-flex w-fit items-center gap-2 border-b border-[var(--color-text-primary)] pb-1 text-[13px] font-semibold uppercase tracking-[0.16em]">{label} <span aria-hidden="true">→</span></Link>}
    </div>
  );
}

/** Accueil du site d'une agence immobilière (template « Résidences ») : carrousel
 *  avec recherche, biens à la une, repères vente / location, engagements. */
export async function EstateHome({ estate }: { estate: EstateContext }) {
  const { tenantId, content } = estate;
  const { published } = await withTenant(tenantId, async (tx) => ({ published: await listProperties(tx, tenantId, { publishedOnly: true, take: 60 }) }));
  const byId = new Map(published.map((l) => [l.id, l]));
  const slideProperties: Record<string, SlideProperty> = {};
  for (const s of content.hero.slides) {
    const l = s.productId ? byId.get(s.productId) : undefined;
    if (l) {
      slideProperties[l.id] = {
        slug: l.slug,
        title: l.title,
        price: formatPropertyPrice(l.price, l.priceUnit),
        facts: l.property ? propertyFacts(l.property) : "",
        place: placeOf(l.location),
        deal: DEAL_TYPE_LABELS[l.property?.dealType ?? "sale"] ?? "",
      };
    }
  }
  const featured = (content.featuredProductIds.length ? content.featuredProductIds.map((id) => byId.get(id)).filter((l): l is (typeof published)[number] => !!l) : published).slice(0, 6);
  const sale = published.filter((l) => l.property?.dealType === "sale").length;
  const rent = published.filter((l) => l.property?.dealType === "rent").length;
  const withImages = content.hero.slides.some((s) => s.imageUrl);
  const firstCollection = content.collections[0];
  const secondCollection = content.collections[1];

  return (
    <EstateShell estate={estate}>
      {withImages ? (
        <EstateHero slides={content.hero.slides} autoplaySeconds={content.hero.autoplaySeconds} properties={slideProperties} />
      ) : (
        <section className="bg-[var(--color-surface)] px-5 pb-16 pt-20 sm:px-8">
          <div className="mx-auto max-w-[var(--content-max-width,1320px)]">
            <h1 className="max-w-3xl font-[family-name:var(--font-heading)] text-[44px] leading-[1.03] sm:text-[68px]">{content.hero.slides[0]?.title ?? estate.tenantName}</h1>
            {content.hero.slides[0]?.subtitle && <p className="mt-5 max-w-xl text-lg text-[var(--color-text-secondary)]">{content.hero.slides[0].subtitle}</p>}
            <EstateSearch className="mt-10" />
          </div>
        </section>
      )}

      {featured.length > 0 && (
        <section className="mx-auto mt-24 max-w-[var(--content-max-width,1320px)] px-5 sm:px-8">
          <SectionTitle eyebrow="Sélection de l'agence" title="Biens à la une" href="/biens" label="Tous nos biens" />
          <Reveal as="ul" className="grid gap-x-7 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((l, i) => <li key={l.id}><PropertyCard card={toEstateCard(l)} priority={i < 3} /></li>)}
          </Reveal>
        </section>
      )}

      <section className="mx-auto mt-24 grid max-w-[var(--content-max-width,1320px)] gap-4 px-5 sm:px-8 md:grid-cols-2">
        {[
          { href: "/biens?transaction=sale", eyebrow: DEAL_TYPE_LABELS.sale, title: firstCollection?.title ?? "Acheter", text: firstCollection?.subtitle || `${sale} bien${sale > 1 ? "s" : ""} à vendre : villas, appartements, terrains.`, image: firstCollection?.imageUrl ?? null },
          { href: "/biens?transaction=rent", eyebrow: DEAL_TYPE_LABELS.rent, title: secondCollection?.title ?? "Louer", text: secondCollection?.subtitle || `${rent} bien${rent > 1 ? "s" : ""} à louer, meublés ou vides.`, image: secondCollection?.imageUrl ?? null },
        ].map((b) => (
          <Link key={b.href} href={b.href} className="group relative flex aspect-[16/10] items-end overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-primary)] p-7 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-4 sm:p-9">
            {b.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-80 transition-transform duration-[1200ms] group-hover:scale-[1.05]" />
            )}
            <span className="absolute inset-0 bg-[linear-gradient(0deg,rgba(8,16,34,0.8),rgba(8,16,34,0.1)_70%)]" aria-hidden="true" />
            <span className="relative">
              <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/75">{b.eyebrow}</span>
              <span className="mt-2 block font-[family-name:var(--font-heading)] text-[38px] leading-none sm:text-[48px]">{b.title}</span>
              <span className="mt-3 block max-w-sm text-[15px] text-white/85">{b.text}</span>
              <span className="mt-5 inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.16em]">Voir les biens <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span></span>
            </span>
          </Link>
        ))}
      </section>

      {content.reassurance.length > 0 && (
        <section aria-label="Nos engagements" className="mx-auto mt-24 max-w-[var(--content-max-width,1320px)] px-5 sm:px-8">
          <Reveal as="ul" className="grid gap-8 border-y border-[var(--color-border)] py-12 sm:grid-cols-2 lg:grid-cols-4">
            {content.reassurance.map((r) => {
              const Icon = ICONS[r.icon as keyof typeof ICONS] ?? IconShield;
              return (
                <li key={r.title} className="flex gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--color-surface)] text-[var(--color-primary)]"><Icon size={22} /></span>
                  <span>
                    <span className="block font-[family-name:var(--font-heading)] text-[19px]">{r.title}</span>
                    {r.text && <span className="mt-1 block text-sm text-[var(--color-text-secondary)]">{r.text}</span>}
                  </span>
                </li>
              );
            })}
          </Reveal>
        </section>
      )}
    </EstateShell>
  );
}
