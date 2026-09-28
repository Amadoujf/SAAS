import Link from "next/link";
import type { RestaurantContext } from "@/lib/restaurant/restaurant-context";
import { loadMenu, loadService } from "@/lib/restaurant/restaurant-data";
import { BADGE_LABELS, formatXof, hoursByDay } from "@/lib/restaurant/labels";
import { Reveal } from "@/components/store/reveal";
import { RestaurantShell } from "./restaurant-shell";
import { ServicePill } from "./service-pill";
import { RestaurantEssentials } from "./restaurant-essentials";

const isDefaultHero = (s: RestaurantContext["content"]["hero"]["slides"][number] | undefined) => !s || (s.id === "accueil" && s.ctaHref === "/catalogue");

/** Accueil d'un restaurant : braise, plats signature, ardoise de la carte, horaires. */
export async function RestaurantHome({ restaurant }: { restaurant: RestaurantContext }) {
  const [sections, service] = await Promise.all([loadMenu(restaurant.tenantId), loadService(restaurant.tenantId)]);
  const { rules } = restaurant;
  const slide = restaurant.content.hero.slides[0];
  const custom = !isDefaultHero(slide);
  const dishes = sections.flatMap((s) => s.dishes);
  const signature = [...dishes.filter((d) => d.badges.includes("signature")), ...dishes.filter((d) => !d.badges.includes("signature") && d.imageUrl)].filter((d) => d.imageUrl).slice(0, 3);
  const heroImg = (custom && slide?.imageUrl) || signature[0]?.imageUrl || null;
  const heroMobile = (custom && slide?.mobileImageUrl) || null;
  return (
    <RestaurantShell restaurant={restaurant} open={service.open}>
      <section className="relative overflow-hidden bg-[var(--color-primary)] text-white">
        <div className="mx-auto grid max-w-[var(--content-max-width,1240px)] lg:grid-cols-[1.05fr_1fr]">
          <div className="relative z-10 px-4 pb-12 pt-10 sm:px-8 lg:py-24">
            <ServicePill service={service} dark />
            <p className="mt-6 text-[13px] font-bold uppercase tracking-[0.2em] text-[var(--color-accent-primary)]">{(custom && slide?.eyebrow) || restaurant.contact.address || "Commande en direct"}</p>
            <h1 className="mt-3 break-words font-[family-name:var(--font-heading)] text-[52px] uppercase leading-[0.88] tracking-[-0.03em] sm:text-[88px] lg:text-[104px]">{(custom && slide?.title) || restaurant.tenantName}</h1>
            <p className="mt-6 max-w-md text-[17px] leading-relaxed text-white/75">{(custom && slide?.subtitle) || "Commandez en ligne à emporter ou en livraison, ou réservez votre table."}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/carte" className="inline-flex h-14 items-center rounded-full bg-[var(--color-accent-primary)] px-8 text-[16px] font-bold text-[var(--color-primary)] transition-transform hover:-translate-y-0.5">{service.open ? "Commander" : "Voir la carte"}</Link>
              {rules.acceptBookings && <Link href="/reserver-une-table" className="inline-flex h-14 items-center rounded-full bg-white/10 px-8 text-[16px] font-bold text-white ring-1 ring-inset ring-white/20 hover:bg-white/15">Réserver une table</Link>}
            </div>
          </div>
          {heroImg && (
            <div className="relative h-[300px] sm:h-[420px] lg:h-auto">
              <picture>
                {heroMobile && <source media="(max-width: 640px)" srcSet={heroMobile} />}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={heroImg} alt={(custom && slide?.imageAlt) || signature[0]?.name || restaurant.tenantName} className="absolute inset-0 h-full w-full object-cover" />
              </picture>
              <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(90deg,var(--color-primary)_0%,transparent_22%)] max-lg:bg-[linear-gradient(180deg,var(--color-primary)_0%,transparent_25%)]" />
              {((custom && slide?.demo) || (!custom && signature[0]?.imageDemo)) && <span className="absolute right-3 top-3 rounded-sm bg-black/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">Visuel de démonstration</span>}
              {(rules.acceptTakeaway || rules.acceptDelivery) && (
                <p className="absolute bottom-6 left-4 grid h-28 w-28 rotate-[-8deg] place-items-center rounded-full bg-[var(--color-accent-secondary)] text-center text-[13px] font-extrabold uppercase leading-tight text-white shadow-[var(--shadow-lg)] sm:bottom-10 sm:left-8 sm:h-32 sm:w-32 sm:text-[15px] lg:-left-10">
                  Prêt en<br /><span className="font-[family-name:var(--font-heading)] text-[34px] leading-none sm:text-[40px]">{rules.prepMinutes}</span><br />minutes
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {signature.length > 0 && (
        <section aria-labelledby="incontournables" className="mx-auto mt-24 max-w-[var(--content-max-width,1240px)] px-4 sm:px-8">
          <h2 id="incontournables" className="break-words font-[family-name:var(--font-heading)] text-[34px] uppercase leading-[0.9] tracking-[-0.02em] sm:text-[64px]">Les incontournables</h2>
          <Reveal as="ul" className="mt-8 grid gap-5 md:grid-cols-3">
            {signature.map((d, i) => (
              <li key={d.id} className={`overflow-hidden rounded-[var(--radius-lg)] bg-white ring-1 ring-[var(--color-border)] ${i === 1 ? "md:translate-y-8" : ""}`}>
                <div className="relative aspect-[4/3] bg-[var(--color-surface)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={d.imageUrl!} alt={d.name} loading="lazy" className="h-full w-full object-cover" />
                  {d.imageDemo && <span className="absolute right-2 top-2 rounded-sm bg-black/50 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-white">Illustration</span>}
                </div>
                <div className="p-5">
                  <div className="flex flex-wrap gap-1.5">{d.badges.map((b) => <span key={b} className="rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.08em]">{BADGE_LABELS[b] ?? b}</span>)}</div>
                  <h3 className="mt-2 text-[20px] font-bold">{d.name}</h3>
                  {d.description && <p className="mt-1 line-clamp-2 text-[14.5px] text-[var(--color-text-secondary)]">{d.description}</p>}
                  <p className="yc-num mt-3 text-[17px] font-bold">{formatXof(d.price)}</p>
                </div>
              </li>
            ))}
          </Reveal>
        </section>
      )}

      <RestaurantEssentials restaurant={restaurant} sections={sections} />
    </RestaurantShell>
  );
}
