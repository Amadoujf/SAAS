import Link from "next/link";
import type { RestaurantContext } from "@/lib/restaurant/restaurant-context";
import { loadMenu, type MenuSectionData } from "@/lib/restaurant/restaurant-data";
import { formatXof, hoursByDay } from "@/lib/restaurant/labels";

/**
 * Les blocs UTILES d'un restaurant (services, ardoise de la carte, horaires et accès) :
 * sous l'accueil standard comme sous une page composée dans l'éditeur (scène
 * immersive…), pour que commander ou réserver reste toujours à portée.
 */
export async function RestaurantEssentials({ restaurant, sections: given }: { restaurant: RestaurantContext; sections?: MenuSectionData[] }) {
  const sections = given ?? (await loadMenu(restaurant.tenantId));
  const { rules } = restaurant;
  return (
    <>
      <section aria-label="Nos services" className="mx-auto mt-12 grid max-w-[var(--content-max-width,1240px)] gap-3 px-4 sm:grid-cols-3 sm:px-8">
        {[
          rules.acceptTakeaway && { t: "À emporter", d: `Choisissez l'heure : c'est prêt quand vous arrivez. Environ ${rules.prepMinutes} min.`, href: "/carte", cta: "Commander" },
          rules.acceptDelivery && { t: "Livraison", d: `${formatXof(rules.deliveryFee)} de frais, à partir de ${formatXof(rules.minDeliveryOrder)} de commande. Réglez à la livraison.`, href: "/carte", cta: "Se faire livrer" },
          { t: "Sur place", d: rules.acceptDineInQr ? "Scannez le QR code de votre table : la commande part directement en cuisine." : "Installez-vous, on s'occupe de vous.", href: rules.acceptBookings ? "/reserver-une-table" : "/#infos", cta: rules.acceptBookings ? "Réserver" : "Nous trouver" },
        ]
          .filter((x): x is { t: string; d: string; href: string; cta: string } => !!x)
          .map((s, i) => (
            <Link key={s.t} href={s.href} className={`group flex flex-col rounded-[var(--radius-lg)] p-6 transition-transform hover:-translate-y-1 ${i === 0 ? "bg-[var(--color-accent-primary)] text-[var(--color-primary)]" : "bg-[var(--color-surface)]"}`}>
              <h2 className="font-[family-name:var(--font-heading)] text-[30px] uppercase leading-none">{s.t}</h2>
              <p className="mt-3 flex-1 text-[15px] leading-relaxed opacity-80">{s.d}</p>
              <span className="mt-5 text-[14px] font-bold underline-offset-4 group-hover:underline">{s.cta} →</span>
            </Link>
          ))}
      </section>

      {sections.length > 0 && (
        <section aria-labelledby="ardoise" className="mx-auto mt-28 max-w-[var(--content-max-width,1240px)] px-4 sm:px-8">
          <div className="rounded-[var(--radius-lg)] bg-[var(--color-primary)] px-5 py-10 text-white sm:px-10 sm:py-14">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 id="ardoise" className="font-[family-name:var(--font-heading)] text-[44px] uppercase leading-[0.9] tracking-[-0.02em] sm:text-[64px]">L&apos;ardoise</h2>
              <Link href="/carte" className="text-[15px] font-bold text-[var(--color-accent-primary)] underline-offset-4 hover:underline">Toute la carte →</Link>
            </div>
            <div className="mt-10 grid gap-x-14 gap-y-10 md:grid-cols-2">
              {sections.slice(0, 4).map((s) => (
                <div key={s.id}>
                  <h3 className="text-[13px] font-bold uppercase tracking-[0.2em] text-[var(--color-accent-primary)]">{s.name}</h3>
                  <ul className="mt-4 grid gap-3">
                    {s.dishes.slice(0, 4).map((d) => (
                      <li key={d.id} className={`flex items-baseline gap-3 text-[16px] ${d.isAvailable ? "" : "text-white/40 line-through"}`}>
                        <span className="font-semibold">{d.name}</span>
                        <span aria-hidden="true" className="mb-1 flex-1 border-b border-dotted border-white/25" />
                        <span className="yc-num shrink-0">{formatXof(d.price)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section id="infos" aria-labelledby="infos-titre" className="mx-auto mt-24 max-w-[var(--content-max-width,1240px)] scroll-mt-24 px-4 sm:px-8">
        <h2 id="infos-titre" className="font-[family-name:var(--font-heading)] text-[40px] uppercase leading-none">Horaires et accès</h2>
        <div className="mt-8 grid gap-10 md:grid-cols-[1fr_1fr]">
          <dl className="grid gap-2 text-[15px]">
            {hoursByDay(rules.openingHours).map((h) => (
              <div key={h.day} className="flex justify-between gap-4 border-b border-[var(--color-border)] pb-2">
                <dt className="font-semibold">{h.day}</dt>
                <dd className={h.text === "Fermé" ? "text-[var(--color-text-muted)]" : ""}>{h.text}</dd>
              </div>
            ))}
          </dl>
          <div className="grid content-start gap-6 text-[15px]">
            {restaurant.contact.address && <div><p className="text-[13px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Adresse</p><p className="mt-1">{restaurant.contact.address}</p></div>}
            {restaurant.contact.phone && <div><p className="text-[13px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Téléphone</p><a href={`tel:${restaurant.contact.phone.replace(/\s/g, "")}`} className="mt-1 block font-semibold">{restaurant.contact.phone}</a></div>}
            <div><p className="text-[13px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">Règlement</p><p className="mt-1">Rien n&apos;est débité en ligne. {restaurant.payWays.join(", ")}.</p></div>
          </div>
        </div>
      </section>
    </>
  );
}
