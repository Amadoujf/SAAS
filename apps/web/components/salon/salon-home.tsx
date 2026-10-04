import Link from "next/link";
import type { SalonContext } from "@/lib/salon/salon-context";
import { loadSalonCatalog, nextFreeSlot, type MenuItem, type TeamMember } from "@/lib/salon/salon-data";
import { WEEKDAYS, WEEK_ORDER, dayIn, durationLabel, minuteLabel, priceLabel, timeIn } from "@/lib/salon/labels";
import { utcToLocal } from "@yamacommerce/database";
import { Reveal } from "@/components/store/reveal";
import { SalonShell } from "./salon-shell";

const TEAM_COLS: Record<number, string> = { 1: "lg:grid-cols-3", 2: "lg:grid-cols-3", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5" };

const isDefaultHero = (s: SalonContext["content"]["hero"]["slides"][number] | undefined) => !s || (s.id === "accueil" && s.ctaHref === "/catalogue");

/** Image en arche — signature du template Écrin. */
function Arch({ src, alt, demo, className = "", sizes, monogram, demoAt = "bottom" }: { src: string | null; alt: string; demo?: boolean; className?: string; sizes?: string; monogram?: string; demoAt?: "bottom" | "top-right" }) {
  return (
    <span className={`relative block overflow-hidden rounded-t-[999px] rounded-b-[var(--radius-lg)] bg-[var(--color-surface-muted,var(--color-surface))] ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} sizes={sizes} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span aria-hidden="true" className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_30%,var(--color-champagne,#F2E3CF),var(--color-surface))]">
          {monogram && <span className="translate-y-[8%] font-[family-name:var(--font-heading)] text-[min(9rem,40vw)] italic leading-none text-[var(--color-accent-primary)] opacity-80">{monogram}</span>}
        </span>
      )}
      {demo && <span className={`absolute whitespace-nowrap rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white ${demoAt === "top-right" ? "right-4 top-[18%]" : "bottom-3 left-1/2 -translate-x-1/2"}`}>Visuel de démonstration</span>}
    </span>
  );
}

function MenuRow({ item }: { item: MenuItem }) {
  return (
    <li className="group grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1 border-b border-[var(--color-border)] py-5">
      <span className="flex min-w-0 items-baseline gap-3">
        <span className="font-[family-name:var(--font-heading)] text-[22px] leading-snug sm:text-[24px]">{item.title}</span>
        <span aria-hidden="true" className="hidden flex-1 translate-y-[-4px] border-b border-dotted border-[color-mix(in_srgb,var(--color-text-muted)_50%,transparent)] sm:block" />
      </span>
      <span className="text-right text-[15px] font-semibold tabular-nums">{priceLabel(item.price, item.priceFrom)}</span>
      <span className="text-[14px] leading-relaxed text-[var(--color-text-secondary)]">
        <span className="mr-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent-secondary)]">{durationLabel(item.durationMinutes)}</span>
        {item.summary}
      </span>
      <span className="text-right">
        {item.onlineBooking && item.staffIds.length > 0 ? (
          <Link href={`/reserver?prestation=${item.slug}`} className="inline-flex h-9 items-center rounded-[var(--radius-full)] px-4 text-[13px] font-semibold text-[var(--color-accent-primary)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--color-accent-primary)_40%,transparent)] transition-colors hover:bg-[var(--color-accent-primary)] hover:text-white" aria-label={`Réserver : ${item.title}`}>
            Réserver
          </Link>
        ) : (
          <span className="text-[12.5px] text-[var(--color-text-muted)]">Par téléphone</span>
        )}
      </span>
    </li>
  );
}

function TeamCard({ member, menu }: { member: TeamMember; menu: MenuItem[] }) {
  const specialties = menu.filter((m) => member.serviceIds.includes(m.id)).map((m) => m.category);
  const unique = [...new Set(specialties)];
  return (
    <article className="flex flex-col">
      <Arch src={member.photoUrl} alt={member.photoUrl ? `Portrait de ${member.name}` : ""} monogram={member.name.slice(0, 1)} className="aspect-[3/4] w-full" demo={member.photoUrl?.includes("/demo-templates/")} />
      <h3 className="mt-5 font-[family-name:var(--font-heading)] text-[28px] italic leading-none">{member.name}</h3>
      {member.title && <p className="mt-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-secondary)]">{member.title}</p>}
      {member.bio && <p className="mt-3 text-[14.5px] leading-relaxed text-[var(--color-text-secondary)]">{member.bio}</p>}
      {unique.length > 0 && <p className="mt-2 text-[13px] text-[var(--color-text-muted)]">{unique.join(" · ")}</p>}
      <Link href={`/reserver?avec=${member.id}`} className="mt-4 inline-flex w-fit items-center gap-1.5 text-[14px] font-semibold text-[var(--color-accent-primary)] underline-offset-4 hover:underline">
        Réserver avec {member.name}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </Link>
    </article>
  );
}

/** Accueil d'un salon : promesse + prochain horaire libre réel, la carte des soins,
 *  l'équipe, horaires d'ouverture et infos pratiques. */
export async function SalonHome({ salon }: { salon: SalonContext }) {
  const { menu, team, categories, hours } = await loadSalonCatalog(salon.tenantId);
  const next = await nextFreeSlot(salon.tenantId, salon.timezone, menu);
  const slide = salon.content.hero.slides[0];
  const custom = !isDefaultHero(slide);
  const heroImage = (custom && slide?.imageUrl) || menu.find((m) => m.image)?.image?.url || null;
  const heroDemo = custom ? slide?.demo : menu.find((m) => m.image)?.image?.demo;
  const today = utcToLocal(new Date(), salon.timezone);
  const todayRanges = hours[today.weekday] ?? [];
  const openNow = todayRanges.some((r) => today.minute >= r.startMinute && today.minute < r.endMinute);
  const closesAt = todayRanges.find((r) => today.minute < r.endMinute)?.endMinute;
  const nextLabel = next ? `${next.dayOffset === 0 ? "Aujourd'hui" : next.dayOffset === 1 ? "Demain" : dayIn(next.startAt, salon.timezone, { weekday: "long", day: "numeric" })} à ${timeIn(next.startAt, salon.timezone)}` : null;

  return (
    <SalonShell salon={salon}>
      <section className="mx-auto grid max-w-[var(--content-max-width,1280px)] items-center gap-10 px-5 pb-16 pt-10 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pb-24 lg:pt-16">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.28em] text-[var(--color-accent-secondary)]">{(custom && slide?.eyebrow) || categories.slice(0, 3).join(" · ") || "Salon"}</p>
          <h1 className="mt-5 font-[family-name:var(--font-heading)] text-[52px] leading-[0.95] tracking-[-0.02em] sm:text-[84px]">
            {custom && slide?.title ? slide.title : (
              <>Prenez le temps, <em className="text-[var(--color-accent-primary)]">on garde l&apos;heure.</em></>
            )}
          </h1>
          <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-[var(--color-text-secondary)]">
            {custom && slide?.subtitle ? slide.subtitle : `Choisissez votre soin, la personne qui vous accueille et l'horaire qui vous va : ${salon.tenantName} vous confirme aussitôt.`}
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/reserver" className="inline-flex h-14 items-center rounded-[var(--radius-full)] bg-[var(--color-accent-primary)] px-8 text-[15px] font-semibold text-white shadow-[var(--shadow-md)] transition-transform hover:-translate-y-0.5">Prendre rendez-vous</Link>
            <Link href="/#carte" className="inline-flex h-14 items-center rounded-[var(--radius-full)] px-6 text-[15px] font-semibold ring-1 ring-inset ring-[var(--color-border)] hover:ring-[var(--color-text-muted)]">Voir la carte</Link>
          </div>
          <dl className="mt-10 grid max-w-lg grid-cols-2 gap-6 border-t border-[var(--color-border)] pt-6 text-[14px]">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Aujourd&apos;hui</dt>
              <dd className="mt-1 font-semibold">{todayRanges.length === 0 ? "Fermé" : openNow && closesAt ? `Ouvert jusqu'à ${minuteLabel(closesAt)}` : `${todayRanges.map((r) => `${minuteLabel(r.startMinute)} – ${minuteLabel(r.endMinute)}`).join(", ")}`}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Règlement</dt>
              <dd className="mt-1 font-semibold">Au salon · {salon.payWays.join(", ")}</dd>
            </div>
          </dl>
        </div>
        <div className="relative mx-auto w-full max-w-[480px]">
          <Arch src={heroImage} alt={(custom && slide?.imageAlt) || salon.tenantName} demo={heroDemo} demoAt="top-right" className="aspect-[4/5] w-full shadow-[var(--shadow-lg)]" />
          {nextLabel && (
            <Link href="/reserver" className="absolute -bottom-6 left-1/2 w-[86%] -translate-x-1/2 rounded-[var(--radius-md)] bg-white px-5 py-4 shadow-[var(--shadow-lg)] ring-1 ring-[var(--color-border)] transition-transform hover:-translate-y-0.5 sm:-left-8 sm:w-auto sm:translate-x-0">
              <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-success)]">
                <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-success)] opacity-60 motion-reduce:animate-none" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-success)]" /></span>
                Prochain horaire libre
              </span>
              <span className="mt-1 block font-[family-name:var(--font-heading)] text-[24px] italic leading-tight">{nextLabel}</span>
            </Link>
          )}
        </div>
      </section>

      <section id="carte" aria-labelledby="carte-titre" className="scroll-mt-24 bg-[var(--color-surface)] py-20 sm:py-28">
        <div className="mx-auto max-w-[var(--content-max-width,1280px)] px-5 sm:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <h2 id="carte-titre" className="font-[family-name:var(--font-heading)] text-[48px] italic leading-none sm:text-[72px]">La carte</h2>
            <p className="max-w-md text-[15px] text-[var(--color-text-secondary)]">Durées réelles, prix fixés par le salon. « À partir de » : le prix final dépend de la longueur ou de la technique, confirmé avec vous avant de commencer.</p>
          </div>
          {categories.length > 1 && (
            <nav aria-label="Rubriques de la carte" className="-mx-5 mt-10 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0">
              {categories.map((c) => (
                <a key={c} href={`#carte-${encodeURIComponent(c)}`} className="shrink-0 rounded-[var(--radius-full)] bg-[var(--color-background)] px-4 py-2 text-[13px] font-semibold ring-1 ring-inset ring-[var(--color-border)] hover:ring-[var(--color-text-muted)]">{c}</a>
              ))}
            </nav>
          )}
          {menu.length === 0 ? (
            <p className="mt-12 text-[16px] text-[var(--color-text-secondary)]">La carte arrive bientôt. En attendant, appelez le salon pour prendre rendez-vous.</p>
          ) : (
            <div className="mt-12 grid gap-16">
              {categories.map((c, i) => {
                const items = menu.filter((m) => m.category === c);
                const visual = items.find((m) => m.image)?.image ?? null;
                return (
                  <Reveal key={c} as="section" className={`grid scroll-mt-28 gap-8 lg:gap-16 ${i % 2 ? "lg:grid-cols-[1fr_320px]" : "lg:grid-cols-[320px_1fr]"}`}>
                    <div id={`carte-${encodeURIComponent(c)}`} className={`scroll-mt-28 ${i % 2 ? "lg:order-2" : ""}`}>
                      <h3 className="font-[family-name:var(--font-heading)] text-[34px] leading-none">{c}</h3>
                      <p className="mt-2 text-[13px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">{items.length} prestation{items.length > 1 ? "s" : ""}</p>
                      {visual && <Arch src={visual.url} alt={visual.alt} demo={visual.demo} className="mt-6 hidden aspect-[3/4] w-full lg:block" />}
                    </div>
                    <ul className={i % 2 ? "lg:order-1" : ""}>{items.map((m) => <MenuRow key={m.id} item={m} />)}</ul>
                  </Reveal>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {team.length > 0 && (
        <section id="equipe" aria-labelledby="equipe-titre" className="mx-auto max-w-[var(--content-max-width,1280px)] scroll-mt-24 px-5 py-20 sm:px-8 sm:py-28">
          <h2 id="equipe-titre" className="font-[family-name:var(--font-heading)] text-[48px] italic leading-none sm:text-[72px]">L&apos;équipe</h2>
          <p className="mt-4 max-w-xl text-[16px] text-[var(--color-text-secondary)]">Choisissez la personne qui vous accueille, ou laissez le salon vous proposer la première disponible.</p>
          <Reveal as="div" className={`mt-12 grid grid-cols-2 gap-x-5 gap-y-12 sm:gap-x-8 ${TEAM_COLS[Math.min(team.length, 5)] ?? "lg:grid-cols-4"}`}>
            {team.map((m) => <TeamCard key={m.id} member={m} menu={menu} />)}
          </Reveal>
        </section>
      )}

      <section id="infos" aria-labelledby="infos-titre" className="scroll-mt-24 bg-[var(--color-primary)] text-white">
        <div className="mx-auto grid max-w-[var(--content-max-width,1280px)] gap-12 px-5 py-20 sm:px-8 lg:grid-cols-3">
          <div>
            <h2 id="infos-titre" className="font-[family-name:var(--font-heading)] text-[40px] italic leading-none">Horaires</h2>
            <dl className="mt-8 grid gap-2.5 text-[15px]">
              {WEEK_ORDER.map((d) => (
                <div key={d} className={`flex justify-between gap-4 border-b border-white/10 pb-2.5 ${d === today.weekday ? "font-semibold text-white" : "text-white/75"}`}>
                  <dt>{WEEKDAYS[d]}{d === today.weekday ? " · aujourd'hui" : ""}</dt>
                  <dd className="text-right tabular-nums">{(hours[d] ?? []).length ? hours[d]!.map((r) => `${minuteLabel(r.startMinute)} – ${minuteLabel(r.endMinute)}`).join(", ") : "Fermé"}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <h2 className="font-[family-name:var(--font-heading)] text-[40px] italic leading-none">Venir</h2>
            <div className="mt-8 grid gap-3 text-[15px] text-white/85">
              {salon.contact.address && <p>{salon.contact.address}</p>}
              {salon.contact.address && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${salon.tenantName} ${salon.contact.address}`)}`} target="_blank" rel="noreferrer" className="w-fit font-semibold text-white underline underline-offset-4">Itinéraire</a>}
              {salon.contact.phone && <a href={`tel:${salon.contact.phone.replace(/\s/g, "")}`} className="w-fit hover:text-white">{salon.contact.phone}</a>}
            </div>
          </div>
          <div>
            <h2 className="font-[family-name:var(--font-heading)] text-[40px] italic leading-none">Bon à savoir</h2>
            <ul className="mt-8 grid gap-3 text-[15px] leading-relaxed text-white/80">
              <li>Rendez-vous {salon.rules.autoConfirm ? "confirmé immédiatement" : "confirmé par le salon"} ; rien n&apos;est payé en ligne.</li>
              <li>Règlement au salon : {salon.payWays.join(", ")}.</li>
              <li>{salon.rules.cancelCutoffHours > 0 ? `Annulation ou changement d'horaire en ligne jusqu'à ${salon.rules.cancelCutoffHours} h avant.` : "Annulation ou changement d'horaire en ligne jusqu'à l'heure du rendez-vous."}</li>
            </ul>
          </div>
        </div>
      </section>
    </SalonShell>
  );
}
