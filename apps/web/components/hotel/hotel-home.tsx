import Link from "next/link";
import type { HotelContext } from "@/lib/hotel/hotel-context";
import { loadRoomTypes } from "@/lib/hotel/hotel-data";
import { AMENITY_LABELS, addDaysIso } from "@/lib/hotel/labels";
import { utcToLocal } from "@yamacommerce/database";
import { Reveal } from "@/components/store/reveal";
import { HotelShell } from "./hotel-shell";
import { DateBar } from "./date-bar";
import { RoomCard } from "./room-card";

const isDefaultHero = (s: HotelContext["content"]["hero"]["slides"][number] | undefined) => !s || (s.id === "accueil" && s.ctaHref === "/catalogue");

/** Accueil d'un établissement : grande image, barre de dates, chambres, séjour, infos. */
export async function HotelHome({ hotel }: { hotel: HotelContext }) {
  const rooms = await loadRoomTypes(hotel.tenantId);
  const today = utcToLocal(new Date(), hotel.timezone).date;
  const slide = hotel.content.hero.slides[0];
  const custom = !isDefaultHero(slide);
  const heroImg = (custom && slide?.imageUrl) || rooms.find((r) => r.images[0])?.images[0]?.url || null;
  const heroMobile = (custom && slide?.mobileImageUrl) || null;
  const amenities = [...new Set(rooms.flatMap((r) => r.amenities))];
  const fromPrice = rooms.map((r) => r.price).filter((p): p is number => p != null).sort((a, b) => a - b)[0];
  return (
    <HotelShell hotel={hotel}>
      <section className="relative">
        <div className="relative h-[72svh] min-h-[480px] overflow-hidden bg-[var(--color-primary)]">
          {heroImg && (
            <picture>
              {heroMobile && <source media="(max-width: 640px)" srcSet={heroMobile} />}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={heroImg} alt={(custom && slide?.imageAlt) || hotel.tenantName} className="absolute inset-0 h-full w-full object-cover" />
            </picture>
          )}
          <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,28,21,0.15)_0%,rgba(15,28,21,0.1)_45%,rgba(15,28,21,0.72)_100%)]" />
          {custom && slide?.demo && <span className="absolute right-4 top-4 rounded-sm bg-black/45 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">Visuel de démonstration</span>}
          <div className="relative mx-auto flex h-full max-w-[var(--content-max-width,1320px)] flex-col justify-end px-5 pb-28 text-white sm:px-8 sm:pb-32">
            <p className="text-[12px] font-semibold uppercase tracking-[0.3em] text-white/80">{(custom && slide?.eyebrow) || hotel.contact.address || "Réservation en direct"}</p>
            <h1 className="mt-4 max-w-4xl font-[family-name:var(--font-heading)] text-[48px] leading-[1] tracking-[-0.02em] sm:text-[80px]">{(custom && slide?.title) || hotel.tenantName}</h1>
            {((custom && slide?.subtitle) || fromPrice != null) && <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-white/85">{(custom && slide?.subtitle) || `Chambres à partir de ${new Intl.NumberFormat("fr-FR").format(fromPrice!)} FCFA la nuit, réservées en direct.`}</p>}
          </div>
        </div>
        <div className="relative z-10 mx-auto -mt-16 max-w-[1080px] px-5 sm:px-8">
          <DateBar today={today} maxDate={addDaysIso(today, hotel.rules.maxAdvanceDays)} />
        </div>
      </section>

      <section aria-labelledby="chambres" className="mx-auto mt-24 max-w-[var(--content-max-width,1320px)] px-5 sm:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 id="chambres" className="font-[family-name:var(--font-heading)] text-[44px] leading-none sm:text-[60px]">Nos chambres</h2>
          <Link href="/chambres" className="text-[15px] font-semibold text-[var(--color-accent-primary)] underline-offset-4 hover:underline">Voir toutes les disponibilités</Link>
        </div>
        {rooms.length === 0 ? (
          <p className="mt-8 text-[16px] text-[var(--color-text-secondary)]">Les chambres arrivent bientôt. Appelez-nous pour réserver.</p>
        ) : (
          <Reveal as="div" className="mt-10 grid gap-8">
            {rooms.map((r, i) => <RoomCard key={r.id} room={r} priority={i === 0} />)}
          </Reveal>
        )}
      </section>

      <section id="sejour" aria-labelledby="sejour-titre" className="mx-auto mt-28 max-w-[var(--content-max-width,1320px)] scroll-mt-24 px-5 sm:px-8">
        <div className="grid gap-12 rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-8 sm:p-12 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 id="sejour-titre" className="font-[family-name:var(--font-heading)] text-[40px] leading-tight sm:text-[52px]">Le séjour</h2>
            <p className="mt-4 max-w-md text-[16px] leading-relaxed text-[var(--color-text-secondary)]">Réservez en direct : la chambre vous est attribuée dès la confirmation, le prix est celui de l&apos;établissement, et vous gardez un lien pour suivre ou annuler votre séjour.</p>
          </div>
          {amenities.length > 0 && (
            <ul className="grid grid-cols-2 gap-x-8 gap-y-4 self-center text-[15px] sm:grid-cols-3">
              {amenities.map((a) => <li key={a} className="border-b border-[var(--color-border)] pb-3">{AMENITY_LABELS[a] ?? a}</li>)}
            </ul>
          )}
        </div>
      </section>

      <section id="infos" aria-labelledby="infos-titre" className="mx-auto mt-24 max-w-[var(--content-max-width,1320px)] scroll-mt-24 px-5 sm:px-8">
        <h2 id="infos-titre" className="font-[family-name:var(--font-heading)] text-[40px] leading-none">Infos pratiques</h2>
        <dl className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Arrivée et départ", "Les chambres sont prêtes l'après-midi et se libèrent en fin de matinée : les heures précises figurent sur chaque chambre."],
            ["Règlement", `Rien n'est débité en ligne. ${hotel.payWays.join(", ")}.`],
            ["Annulation", hotel.rules.cancelFreeHours > 0 ? `En ligne jusqu'à ${hotel.rules.cancelFreeHours} h avant l'arrivée, depuis le lien reçu à la réservation.` : "En ligne jusqu'à l'arrivée, depuis le lien reçu à la réservation."],
            ["Nous trouver", [hotel.contact.address, hotel.contact.phone].filter(Boolean).join(" · ") || "Coordonnées à venir."],
          ].map(([k, v]) => (
            <div key={k} className="border-t-2 border-[var(--color-primary)] pt-4">
              <dt className="text-[13px] font-semibold uppercase tracking-[0.16em]">{k}</dt>
              <dd className="mt-2 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </HotelShell>
  );
}
