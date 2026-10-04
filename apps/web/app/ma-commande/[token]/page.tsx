import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveRestaurant } from "@/lib/restaurant/restaurant-context";
import { getOrderForGuest } from "@/lib/restaurant/public-pipeline";
import { loadService } from "@/lib/restaurant/restaurant-data";
import { KITCHEN_LABELS, MODE_LABELS, formatXof, optionsText, readyGuestLabel, timeIn } from "@/lib/restaurant/labels";
import { RestaurantShell } from "@/components/restaurant/restaurant-shell";
import { AutoRefresh, GuestCancelButton } from "@/components/restaurant/guest-actions";
import { PublicSiteSuspended } from "@/components/public-site-suspended";
import { PublicSiteBillingSuspended } from "@/components/public-site-billing-suspended";

export const metadata: Metadata = { title: "Ma commande", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const STEPS = ["new", "accepted", "preparing", "ready", "completed"] as const;

/** Suivi d'une commande par son jeton : le client ne voit que LA SIENNE. */
export default async function OrderTrackingPage({ params }: { params: { token: string } }) {
  const r = await resolveRestaurant(`/ma-commande/${params.token}`);
  if (r.status === "suspended") return <PublicSiteSuspended tenantName={r.tenantName} />;
  if (r.status === "billing_suspended") return <PublicSiteBillingSuspended tenantName={r.tenantName} />;
  const { restaurant } = r;
  const [o, service] = await Promise.all([getOrderForGuest(restaurant.tenantId, params.token), loadService(restaurant.tenantId)]);
  if (!o) notFound();
  const tz = restaurant.timezone;
  const canceled = o.status === "canceled";
  const live = !canceled && o.status !== "completed";
  const reached = STEPS.indexOf(o.status as (typeof STEPS)[number]);
  const paid = o.payments.filter((p) => !p.voidedAt).reduce((s, p) => s + p.amount, 0);
  const at = (s: string) => o.events.find((e) => e.toStatus === s)?.createdAt;
  const guestLine = o.status === "ready" ? readyGuestLabel(o.mode) : KITCHEN_LABELS[o.status]?.guest;
  return (
    <RestaurantShell restaurant={restaurant} open={service.open}>
      {live && <AutoRefresh />}
      <div className="mx-auto max-w-2xl px-4 pt-10 sm:px-8">
        <p className="text-[13px] font-bold uppercase tracking-[0.16em] text-[var(--color-accent-secondary)]">{MODE_LABELS[o.mode]?.label}{o.table ? ` · table ${o.table.label}` : ""}</p>
        <h1 className="mt-2 font-[family-name:var(--font-heading)] text-[44px] uppercase leading-[0.95] tracking-[-0.02em] sm:text-[60px]">Commande n° {o.number.split("-")[1]}</h1>
        <p className="mt-3 text-[17px] font-medium" aria-live="polite">{guestLine}</p>
        {o.requestedFor && !canceled && <p className="mt-1 text-[15px] text-[var(--color-text-secondary)]">{o.mode === "delivery" ? "Livraison souhaitée" : "Retrait prévu"} à {timeIn(o.requestedFor, tz)}.</p>}

        {!canceled ? (
          <ol aria-label="Avancement" className="mt-8 grid grid-cols-5 gap-1.5">
            {STEPS.map((s, i) => {
              const done = i <= reached;
              const t = at(s);
              return (
                <li key={s} className="min-w-0">
                  <span aria-hidden="true" className={`block h-2 rounded-full ${done ? (i === reached && live ? "animate-pulse bg-[var(--color-accent-primary)]" : "bg-[var(--color-primary)]") : "bg-[var(--color-surface-muted)]"}`} />
                  <span className={`mt-2 block truncate text-[12px] font-semibold sm:text-[13px] ${done ? "" : "text-[var(--color-text-muted)]"}`}>{s === "new" ? "Envoyée" : KITCHEN_LABELS[s]?.label}</span>
                  {t && done && <span className="yc-num block text-[11.5px] text-[var(--color-text-muted)]">{timeIn(t, tz)}</span>}
                  <span className="sr-only">{done ? "étape atteinte" : "à venir"}</span>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="mt-6 rounded-[var(--radius-md)] bg-[var(--color-surface)] px-4 py-3 text-[15px]">Commande annulée{o.events.at(-1)?.note ? ` : ${o.events.at(-1)!.note}` : ""}.</p>
        )}

        <article className="mt-10 rounded-[var(--radius-lg)] bg-white p-5 ring-1 ring-[var(--color-border)] sm:p-6">
          <ul className="divide-y divide-[var(--color-border)]">
            {o.items.map((it) => (
              <li key={it.id} className="flex justify-between gap-4 py-3 first:pt-0">
                <div className="min-w-0">
                  <p className="font-bold"><span className="yc-num">{it.quantity} ×</span> {it.nameSnapshot}</p>
                  {(optionsText(it.options) || it.note) && <p className="mt-0.5 text-[13px] text-[var(--color-text-secondary)]">{[optionsText(it.options), it.note && `« ${it.note} »`].filter(Boolean).join(" · ")}</p>}
                </div>
                <p className="yc-num shrink-0 font-semibold">{formatXof(it.total)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-3 grid gap-1 border-t border-[var(--color-border)] pt-3 text-[15px]">
            {o.deliveryFee > 0 && <div className="flex justify-between"><dt>Livraison</dt><dd className="yc-num">{formatXof(o.deliveryFee)}</dd></div>}
            <div className="flex justify-between text-[18px] font-bold"><dt>Total</dt><dd className="yc-num">{formatXof(o.total)}</dd></div>
            <div className="flex justify-between text-[14px]">
              <dt>Règlement</dt>
              <dd className="font-semibold">{paid >= o.total ? "Réglé" : paid > 0 ? `${formatXof(paid)} réglés · reste ${formatXof(o.total - paid)}` : `À régler ${o.mode === "dine_in" ? "à table" : o.mode === "delivery" ? "à la livraison" : "au retrait"}`}</dd>
            </div>
          </dl>
          {o.deliveryAddress && <p className="mt-4 text-[14px] text-[var(--color-text-secondary)]"><strong className="text-[var(--color-text-primary)]">Adresse :</strong> {o.deliveryAddress}</p>}
        </article>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {o.status === "new" && <GuestCancelButton token={o.accessToken} kind="order" />}
          {restaurant.contact.phone && <a href={`tel:${restaurant.contact.phone.replace(/\s/g, "")}`} className="inline-flex h-12 items-center rounded-full bg-[var(--color-primary)] px-6 text-[14px] font-bold text-white">Appeler le restaurant</a>}
          <Link href="/carte" className="inline-flex h-12 items-center rounded-full px-5 text-[14px] font-bold underline-offset-4 hover:underline">Retour à la carte</Link>
        </div>
        <p className="mt-6 text-[13px] text-[var(--color-text-muted)]">Gardez ce lien : il vous permet de suivre votre commande. Il est personnel.</p>
      </div>
    </RestaurantShell>
  );
}
