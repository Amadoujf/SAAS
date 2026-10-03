import Link from "next/link";
import { withTenant, listTravelPackages, listUpcomingDepartures } from "@yamacommerce/database";
import type { TravelContext } from "@/lib/travel/travel-context";
import { destinationOf, fromPrice, toBoardRows, toTripCard } from "@/lib/travel/travel-cards";
import { formatDateRange, seatsLabel } from "@/lib/travel/labels";
import { IconCard, IconPhone, IconShield } from "@/components/yc/icons";
import { Reveal } from "@/components/store/reveal";
import { TravelShell } from "./travel-shell";
import { TravelHero, TravelSearch, type SlideTrip } from "./travel-hero";
import { TripCard } from "./trip-card";
import { DeparturesBoard } from "./departures-board";

const ICONS = { shield: IconShield, phone: IconPhone, card: IconCard } as const;
const monthLabel = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });

/** Voyages publiés, départs à venir, destinations et mois de départ réels de l'agence. */
export async function loadTravelCatalog(tenantId: string) {
  return withTenant(tenantId, async (tx) => {
    const trips = await listTravelPackages(tx, tenantId, { publishedOnly: true, take: 60 });
    const departures = (await listUpcomingDepartures(tx, tenantId, { to: new Date(Date.now() + 365 * 86_400_000) })).filter((d) => d.listing.status === "published");
    return { trips, departures };
  });
}

export function searchOptions(trips: { travel: { destinationCountry: string } | null }[], departures: { startAt: Date; status: string }[]) {
  const countries = [...new Set(trips.map((t) => t.travel?.destinationCountry).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b, "fr"));
  const months = [...new Set(departures.filter((d) => d.status === "open").map((d) => d.startAt.toISOString().slice(0, 7)))]
    .sort()
    .map((value) => ({ value, label: monthLabel.format(new Date(`${value}-01T00:00:00.000Z`)).replace(/^./, (c) => c.toUpperCase()) }));
  return { countries, months };
}

function SectionTitle({ eyebrow, title, href, label }: { eyebrow: string; title: string; href?: string; label?: string }) {
  return (
    <div className="mb-9 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-accent-primary)]">{eyebrow}</p>
        <h2 className="mt-3 font-[family-name:var(--font-heading)] text-[36px] leading-[1.04] tracking-[-0.015em] sm:text-[52px]">{title}</h2>
      </div>
      {href && <Link href={href} className="inline-flex w-fit items-center gap-2 border-b border-[var(--color-text-primary)] pb-1 text-[13px] font-semibold uppercase tracking-[0.16em]">{label} <span aria-hidden="true">→</span></Link>}
    </div>
  );
}

/** Accueil du site d'une agence de voyage (template « Horizons ») : grandes images et
 *  carte d'embarquement du prochain départ, recherche, voyages à la une, tableau des
 *  départs, univers de voyage, engagements. Tout vient des données de l'agence. */
export async function TravelHome({ travel }: { travel: TravelContext }) {
  const { tenantId, content } = travel;
  const { trips, departures } = await loadTravelCatalog(tenantId);
  const byId = new Map(trips.map((t) => [t.id, t]));
  const bySlug = new Map(trips.map((t) => [t.slug, t]));
  const { countries, months } = searchOptions(trips, departures);

  const slideTrips: Record<string, SlideTrip> = {};
  for (const s of content.hero.slides) {
    const t = s.productId ? byId.get(s.productId) : undefined;
    if (!t) continue;
    const next = departures.find((d) => d.listing.id === t.id && d.status === "open" && d.reservedCount < d.capacity);
    slideTrips[t.id] = {
      slug: t.slug,
      title: t.title,
      from: "Dakar",
      to: t.travel?.destinationCity?.split(",")[0]?.split(" et ")[0] ?? t.travel?.destinationCountry ?? t.title,
      dates: next ? formatDateRange(next.startAt, next.endAt) : null,
      seats: next ? seatsLabel(next.capacity, next.reservedCount, next.status).text : null,
      price: fromPrice(t),
    };
  }
  const featured = (content.featuredProductIds.length ? content.featuredProductIds.map((id) => byId.get(id)).filter((t): t is (typeof trips)[number] => !!t) : trips).slice(0, 6);
  const board = toBoardRows(departures.filter((d) => d.status === "open").slice(0, 8), bySlug);
  const withImages = content.hero.slides.some((s) => s.imageUrl);
  const whatsapp = travel.contact.whatsapp?.replace(/[^\d]/g, "");

  return (
    <TravelShell travel={travel}>
      {withImages ? (
        <TravelHero slides={content.hero.slides} autoplaySeconds={content.hero.autoplaySeconds} trips={slideTrips} countries={countries} months={months} />
      ) : (
        <section className="bg-[var(--color-surface)] px-5 pb-16 pt-20 sm:px-8">
          <div className="mx-auto max-w-[var(--content-max-width,1320px)]">
            <h1 className="max-w-3xl font-[family-name:var(--font-heading)] text-[46px] leading-[1.02] sm:text-[72px]">{content.hero.slides[0]?.title ?? travel.tenantName}</h1>
            {content.hero.slides[0]?.subtitle && <p className="mt-5 max-w-xl text-lg text-[var(--color-text-secondary)]">{content.hero.slides[0].subtitle}</p>}
            <TravelSearch countries={countries} months={months} className="mt-10" />
          </div>
        </section>
      )}

      {featured.length > 0 && (
        <section className="mx-auto mt-24 max-w-[var(--content-max-width,1320px)] px-5 sm:px-8">
          <SectionTitle eyebrow="Sélection de l'agence" title="Nos voyages du moment" href="/voyages" label="Tous les voyages" />
          <Reveal as="ul" className="-mx-5 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-x-7 sm:gap-y-12 sm:overflow-visible sm:px-0 lg:grid-cols-3 [scrollbar-width:none]">
            {featured.map((t, i) => (
              <li key={t.id} className="w-[78%] shrink-0 snap-start sm:w-auto">
                <TripCard trip={toTripCard(t)} priority={i < 3} />
              </li>
            ))}
          </Reveal>
        </section>
      )}

      <div className="mt-24">
        <DeparturesBoard rows={board} />
      </div>

      {content.collections.length > 0 && (
        <section className="mx-auto mt-24 max-w-[var(--content-max-width,1320px)] px-5 sm:px-8">
          <SectionTitle eyebrow="Vos envies" title="Choisir sa façon de partir" />
          <div className="grid gap-4 md:grid-cols-3">
            {content.collections.slice(0, 3).map((c, i) => (
              <Link key={c.id} href={c.href ?? "/voyages"} className={`group relative flex items-end overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-primary)] p-7 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-4 ${i === 0 ? "aspect-[4/5] md:row-span-1" : "aspect-[4/5]"}`}>
                {c.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.imageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] group-hover:scale-[1.06]" />
                )}
                <span className="absolute inset-0 bg-[linear-gradient(0deg,rgba(10,16,32,0.82),rgba(10,16,32,0.05)_65%)]" aria-hidden="true" />
                <span className="relative">
                  <span className="block font-[family-name:var(--font-heading)] text-[40px] italic leading-none">{c.title}</span>
                  {c.subtitle && <span className="mt-3 block max-w-xs text-[15px] text-white/85">{c.subtitle}</span>}
                  <span className="mt-5 inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.16em]">Voir les voyages <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span></span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {content.reassurance.length > 0 && (
        <section aria-label="Nos engagements" className="mx-auto mt-24 max-w-[var(--content-max-width,1320px)] px-5 sm:px-8">
          <Reveal as="ul" className="grid gap-8 border-y border-[var(--color-border)] py-12 sm:grid-cols-2 lg:grid-cols-4">
            {content.reassurance.map((r) => {
              const Icon = ICONS[r.icon as keyof typeof ICONS] ?? IconShield;
              return (
                <li key={r.title} className="flex gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--color-surface)] text-[var(--color-accent-primary)]"><Icon size={22} /></span>
                  <span>
                    <span className="block font-[family-name:var(--font-heading)] text-[20px]">{r.title}</span>
                    {r.text && <span className="mt-1 block text-sm text-[var(--color-text-secondary)]">{r.text}</span>}
                  </span>
                </li>
              );
            })}
          </Reveal>
        </section>
      )}

      {(travel.contact.phone || whatsapp) && (
        <section className="mx-auto mt-24 max-w-[var(--content-max-width,1320px)] px-5 sm:px-8">
          <div className="flex flex-col items-start gap-6 rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-8 sm:flex-row sm:items-center sm:justify-between sm:p-12">
            <div>
              <h2 className="font-[family-name:var(--font-heading)] text-[32px] leading-tight sm:text-[40px]">Un voyage sur mesure ?</h2>
              <p className="mt-2 max-w-lg text-[15px] text-[var(--color-text-secondary)]">Groupe, famille, dates particulières : un conseiller prépare votre devis.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {whatsapp && <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="inline-flex h-12 items-center rounded-[var(--radius-full)] bg-[var(--color-primary)] px-6 text-[14px] font-semibold text-white">Écrire sur WhatsApp</a>}
              {travel.contact.phone && <a href={`tel:${travel.contact.phone.replace(/\s/g, "")}`} className="inline-flex h-12 items-center rounded-[var(--radius-full)] px-6 text-[14px] font-semibold ring-1 ring-inset ring-[var(--color-text-primary)]">Appeler {travel.contact.phone}</a>}
            </div>
          </div>
        </section>
      )}
    </TravelShell>
  );
}

export { destinationOf };
