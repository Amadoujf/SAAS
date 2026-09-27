import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { withTenant, getPublishedTravelBySlug, listTravelPackages } from "@yamacommerce/database";
import { resolveTravel } from "@/lib/travel/travel-context";
import { destinationOf, fromPrice, mediaOf, toTripCard } from "@/lib/travel/travel-cards";
import { DOCUMENT_LABELS, INCLUSION_LABELS, TRIP_TYPE_LABELS, durationLabel, formatDateRange, formatTripPrice, seatsLabel } from "@/lib/travel/labels";
import { TravelShell } from "@/components/travel/travel-shell";
import { TripCard } from "@/components/travel/trip-card";
import { BookingPanel, type DepartureOption } from "@/components/travel/booking-panel";
import { Reveal } from "@/components/store/reveal";
import { PublicSiteSuspended } from "@/components/public-site-suspended";
import { PublicSiteBillingSuspended } from "@/components/public-site-billing-suspended";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const r = await resolveTravel(`/voyages/${params.slug}`);
  if (r.status !== "ok") return {};
  const t = await withTenant(r.travel.tenantId, (tx) => getPublishedTravelBySlug(tx, r.travel.tenantId, params.slug));
  return t ? { title: `${t.title} — ${r.travel.tenantName}`, description: t.summary ?? undefined } : {};
}

/** Fiche publique d'un voyage PUBLIÉ : repères, programme, inclus, pièces à fournir,
 *  conditions de paiement, départs (places réelles) et réservation nominative. */
export default async function TripPage({ params, searchParams }: { params: { slug: string }; searchParams: { depart?: string } }) {
  const r = await resolveTravel(`/voyages/${params.slug}`);
  if (r.status === "suspended") return <PublicSiteSuspended tenantName={r.tenantName} />;
  if (r.status === "billing_suspended") return <PublicSiteBillingSuspended tenantName={r.tenantName} />;
  const { travel } = r;
  const data = await withTenant(travel.tenantId, async (tx) => {
    const trip = await getPublishedTravelBySlug(tx, travel.tenantId, params.slug);
    if (!trip?.travel) return null;
    const similar = (await listTravelPackages(tx, travel.tenantId, { publishedOnly: true, take: 12 })).filter((t) => t.id !== trip.id).slice(0, 3);
    return { trip, similar };
  });
  if (!data) notFound();
  const { trip, similar } = data;
  const d = trip.travel!;
  const media = mediaOf(trip.media);
  const hero = media[0];
  const departures: DepartureOption[] = trip.availabilities.map((a) => {
    const seats = seatsLabel(a.capacity, a.reservedCount, a.status);
    const price = a.priceOverride ?? trip.price;
    return { id: a.id, dates: formatDateRange(a.startAt, a.endAt), seatsText: seats.text, left: seats.left, open: a.status === "open", price, priceLabel: formatTripPrice(price, trip.priceUnit), label: a.label };
  });
  const next = trip.availabilities.find((a) => a.status === "open" && a.reservedCount < a.capacity);
  const facts = [
    { k: "Durée", v: durationLabel(d.durationDays, d.durationNights) },
    { k: "Destination", v: destinationOf(d) },
    { k: "Type", v: TRIP_TYPE_LABELS[d.tripType] ?? "Voyage" },
    { k: "Prochain départ", v: next ? formatDateRange(next.startAt, next.endAt) : "Sur demande" },
  ];
  const payWays = [...travel.paymentChannels.map((c) => c.label), "Espèces ou carte à l'agence", "Virement"];

  return (
    <TravelShell travel={travel}>
      <section className="relative isolate overflow-hidden bg-[var(--color-primary)] text-white">
        {hero && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hero.url} alt={hero.alt || trip.title} className="absolute inset-0 -z-10 h-full w-full object-cover" />
        )}
        <span className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(10,16,32,0.35)_0%,rgba(10,16,32,0.15)_40%,rgba(10,16,32,0.8)_100%)]" aria-hidden="true" />
        <div className="mx-auto flex min-h-[62svh] max-w-[var(--content-max-width,1320px)] flex-col justify-end px-5 pb-12 pt-24 sm:px-8 sm:pb-16">
          <nav aria-label="Fil d'Ariane" className="text-[13px] text-white/75">
            <Link href="/" className="hover:text-white">Accueil</Link> <span aria-hidden="true">/</span>{" "}
            <Link href={`/voyages?type=${d.tripType}`} className="hover:text-white">{TRIP_TYPE_LABELS[d.tripType] ?? "Voyages"}</Link>
          </nav>
          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.32em] text-white/80">{destinationOf(d)}</p>
          <h1 className="mt-3 max-w-4xl font-[family-name:var(--font-heading)] text-[44px] leading-[0.98] tracking-[-0.02em] sm:text-[72px]">{trip.title}</h1>
          {trip.summary && <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-white/85">{trip.summary}</p>}
          <p className="mt-6 font-[family-name:var(--font-heading)] text-[26px]">{fromPrice(trip)}</p>
        </div>
      </section>

      <dl className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto grid max-w-[var(--content-max-width,1320px)] grid-cols-2 gap-px px-5 sm:px-8 lg:grid-cols-4">
          {facts.map((f) => (
            <div key={f.k} className="py-5 pr-4">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">{f.k}</dt>
              <dd className="mt-1 text-[15px] font-semibold">{f.v}</dd>
            </div>
          ))}
        </div>
      </dl>

      <div className="mx-auto grid max-w-[var(--content-max-width,1320px)] gap-12 px-5 pt-12 sm:px-8 lg:grid-cols-[1fr_440px]">
        <div className="min-w-0">
          {trip.description && (
            <section aria-labelledby="apropos">
              <h2 id="apropos" className="font-[family-name:var(--font-heading)] text-[34px]">Le voyage</h2>
              <div className="mt-4 grid gap-4 text-[16.5px] leading-relaxed text-[var(--color-text-secondary)]">
                {trip.description.split(/\n{2,}/).map((p) => <p key={p}>{p}</p>)}
              </div>
            </section>
          )}

          {media.length > 1 && (
            <div className="mt-10 grid grid-cols-2 gap-3">
              {media.slice(1, 5).map((m) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={m.url} src={m.url} alt={m.alt || trip.title} loading="lazy" className="aspect-[4/3] w-full rounded-[var(--radius-lg)] object-cover" />
              ))}
            </div>
          )}

          {d.itinerary.length > 0 && (
            <section aria-labelledby="programme" className="mt-14">
              <h2 id="programme" className="font-[family-name:var(--font-heading)] text-[34px]">Programme</h2>
              <Reveal as="ul" className="relative mt-6 grid gap-0 before:absolute before:bottom-3 before:left-[27px] before:top-3 before:w-px before:bg-[var(--color-border)]">
                {d.itinerary.map((day) => (
                  <li key={day.id} className="relative grid grid-cols-[56px_1fr] gap-5 pb-7">
                    <span className="relative z-10 grid h-14 w-14 place-items-center rounded-full bg-[var(--color-background)] font-[family-name:var(--font-heading)] text-[13px] leading-tight ring-1 ring-[var(--color-border)]">
                      <span className="text-center"><span className="block text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Jour</span><span className="block text-[20px]">{day.dayNumber}</span></span>
                    </span>
                    <span className="pt-2">
                      <span className="block font-[family-name:var(--font-heading)] text-[22px] leading-snug">{day.title}</span>
                      {day.description && <span className="mt-1.5 block text-[15.5px] leading-relaxed text-[var(--color-text-secondary)]">{day.description}</span>}
                    </span>
                  </li>
                ))}
              </Reveal>
            </section>
          )}

          <section aria-labelledby="inclus" className="mt-10 grid gap-8 sm:grid-cols-2">
            {d.included.length > 0 && (
              <div>
                <h2 id="inclus" className="font-[family-name:var(--font-heading)] text-[26px]">Compris dans le prix</h2>
                <ul className="mt-4 grid gap-2.5 text-[15px]">
                  {d.included.map((i) => (
                    <li key={i} className="flex items-start gap-2.5"><svg width="18" height="18" viewBox="0 0 24 24" className="mt-0.5 shrink-0 text-[var(--color-success)]" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>{INCLUSION_LABELS[i] ?? i}</li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              {d.excludedNote && (
                <>
                  <h2 className="font-[family-name:var(--font-heading)] text-[26px]">Non compris</h2>
                  <p className="mt-4 text-[15px] text-[var(--color-text-secondary)]">{d.excludedNote}</p>
                </>
              )}
              {d.requiredDocuments.length > 0 && (
                <>
                  <h2 className={`font-[family-name:var(--font-heading)] text-[26px] ${d.excludedNote ? "mt-8" : ""}`}>À fournir par voyageur</h2>
                  <ul className="mt-4 grid gap-2 text-[15px]">{d.requiredDocuments.map((doc) => <li key={doc}>· {DOCUMENT_LABELS[doc] ?? doc}</li>)}</ul>
                </>
              )}
            </div>
          </section>

          <section aria-labelledby="paiement" className="mt-12 rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-6 sm:p-8">
            <h2 id="paiement" className="font-[family-name:var(--font-heading)] text-[26px]">Réserver et régler</h2>
            <ol className="mt-4 grid gap-3 text-[15px] text-[var(--color-text-secondary)]">
              <li><strong className="text-[var(--color-text-primary)]">1.</strong> Vous envoyez votre demande : les places sont retenues, rien n&apos;est débité.</li>
              <li><strong className="text-[var(--color-text-primary)]">2.</strong> L&apos;agence vous rappelle pour confirmer{d.depositPercent > 0 ? ` et vous demande un acompte de ${d.depositPercent} %` : ""}.</li>
              <li><strong className="text-[var(--color-text-primary)]">3.</strong> Le solde se règle avant le départ. Chaque paiement vous est confirmé par un reçu numéroté.</li>
            </ol>
            <p className="mt-4 text-[14px] text-[var(--color-text-secondary)]">Moyens acceptés : {payWays.join(", ")}.</p>
            {d.meetingPoint && <p className="mt-2 text-[14px] text-[var(--color-text-secondary)]">Rendez-vous : {d.meetingPoint}.</p>}
          </section>
        </div>

        <aside className="lg:sticky lg:top-[96px] lg:self-start">
          <BookingPanel slug={trip.slug} departures={departures} initialDepartureId={searchParams.depart ?? null} depositPercent={d.depositPercent} needsPassport={d.requiredDocuments.includes("passport")} />
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="mx-auto mt-24 max-w-[var(--content-max-width,1320px)] px-5 sm:px-8">
          <h2 className="mb-8 font-[family-name:var(--font-heading)] text-[34px] sm:text-[44px]">D&apos;autres envies</h2>
          <ul className="grid gap-x-7 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((t) => <li key={t.id}><TripCard trip={toTripCard(t)} /></li>)}
          </ul>
        </section>
      )}
    </TravelShell>
  );
}
