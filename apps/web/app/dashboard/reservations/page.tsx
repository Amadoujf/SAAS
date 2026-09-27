import Link from "next/link";
import type { Metadata } from "next";
import { withTenant, listTravelBookings, summarizePayments } from "@yamacommerce/database";
import { requireTravelPage } from "@/lib/travel/guard";
import { BOOKING_STATUS_LABELS, PAYMENT_STATE_LABELS, formatShortDate, formatXof } from "@/lib/travel/labels";
import { PageHeader, Panel } from "@/components/yc/panel";
import { Pill } from "@/components/yc/status-pill";
import { EmptyState } from "@/components/yc/empty-state";

export const metadata: Metadata = { title: "Réservations — Y-COM", robots: { index: false, follow: false } };

const QUEUES = [
  { key: "", label: "En cours" },
  { key: "a-confirmer", label: "À confirmer" },
  { key: "acompte", label: "Acompte attendu" },
  { key: "solde", label: "Solde attendu" },
  { key: "pieces", label: "Pièces à obtenir" },
  { key: "historique", label: "Historique" },
] as const;

/** Réservations de voyage : files de travail (à confirmer, acompte, solde, pièces) et historique. */
export default async function BookingsPage({ searchParams }: { searchParams: { file?: string; q?: string } }) {
  const membership = await requireTravelPage("reservations.view");
  const queue = QUEUES.find((q) => q.key === (searchParams.file ?? ""))?.key ?? "";
  const search = searchParams.q?.trim().slice(0, 60) || undefined;
  const all = await withTenant(membership.tenantId, (tx) => listTravelBookings(tx, membership.tenantId, { search, take: 400 }));
  const now = new Date();
  const rows = all.map((b) => ({ b, pay: summarizePayments(b.totalAmount, b.listing?.travel?.depositPercent ?? 0, b.payments), missing: b.travelers.flatMap((t) => t.documents).filter((d) => d.status === "missing" || d.status === "refused").length }));
  const active = rows.filter((r) => r.b.status === "requested" || r.b.status === "confirmed");
  const filtered =
    queue === "a-confirmer" ? active.filter((r) => r.b.status === "requested")
    : queue === "acompte" ? active.filter((r) => r.pay.depositDue != null && r.pay.depositDue > 0 && r.pay.paid < r.pay.depositDue)
    : queue === "solde" ? active.filter((r) => r.pay.remaining != null && r.pay.remaining > 0 && r.pay.paid >= (r.pay.depositDue ?? 0))
    : queue === "pieces" ? active.filter((r) => r.missing > 0 && r.b.startAt >= now)
    : queue === "historique" ? rows.filter((r) => !["requested", "confirmed"].includes(r.b.status)).reverse()
    : active;
  const count = (k: string) => (k === "a-confirmer" ? active.filter((r) => r.b.status === "requested").length : k === "acompte" ? active.filter((r) => r.pay.depositDue != null && r.pay.depositDue > 0 && r.pay.paid < r.pay.depositDue).length : k === "pieces" ? active.filter((r) => r.missing > 0 && r.b.startAt >= now).length : null);

  return (
    <>
      <PageHeader eyebrow="Pilotage" title="Réservations" description="Réservations reçues du site ou prises par téléphone. « Réglé » n'apparaît qu'après encaissement enregistré." />
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Files de travail" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {QUEUES.map((q) => {
            const on = queue === q.key;
            const n = count(q.key);
            return <Link key={q.key} href={q.key ? `/dashboard/reservations?file=${q.key}` : "/dashboard/reservations"} aria-current={on ? "page" : undefined} className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${on ? "bg-yc-night-900 text-white" : "bg-white text-yc-ink-soft ring-1 ring-yc-ink/10 hover:text-yc-ink"}`}>{q.label}{n ? <span className={`ml-1.5 rounded-full px-1.5 text-xs ${on ? "bg-white/20" : "bg-yc-warning/15 text-[rgb(146_84_0)]"}`}>{n}</span> : null}</Link>;
          })}
        </nav>
        <form action="/dashboard/reservations" className="flex gap-2">
          {queue && <input type="hidden" name="file" value={queue} />}
          <input name="q" defaultValue={search ?? ""} placeholder="Référence, nom, téléphone" aria-label="Rechercher une réservation" className="h-10 w-full min-w-0 rounded-lg bg-white px-3 text-sm ring-1 ring-inset ring-yc-ink/12 lg:w-64" />
          <button type="submit" className="h-10 shrink-0 rounded-lg bg-yc-night-900 px-4 text-sm font-semibold text-white">Chercher</button>
        </form>
      </div>
      {filtered.length === 0 ? (
        <Panel><EmptyState title="Rien dans cette file" description={queue ? "Tout est à jour ici." : "Les réservations du site apparaissent ici dès leur envoi."} /></Panel>
      ) : (
        <Panel className="overflow-hidden">
          <ul className="divide-y divide-yc-ink/[0.06]">
            {filtered.map(({ b, pay, missing }) => {
              const status = BOOKING_STATUS_LABELS[b.status] ?? BOOKING_STATUS_LABELS.requested!;
              const payMeta = PAYMENT_STATE_LABELS[pay.state]!;
              return (
                <li key={b.id}>
                  <Link href={`/dashboard/reservations/${b.id}`} className="flex flex-col gap-2 px-5 py-4 hover:bg-yc-ivory-50 sm:flex-row sm:items-center sm:gap-5">
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 font-semibold">{b.customer.firstName} {b.customer.lastName ?? ""}<Pill tone={status.tone}>{status.label}</Pill></span>
                      <span className="mt-0.5 block text-sm text-yc-ink-soft">{b.listing?.title ?? "Voyage supprimé"} · départ le {formatShortDate(b.startAt)} · {b.quantity} voyageur{b.quantity > 1 ? "s" : ""} · <span className="font-mono text-xs">{b.reference}</span></span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-sm">
                      {missing > 0 && <span className="rounded-full bg-yc-danger/10 px-2.5 py-1 text-xs font-semibold text-yc-danger">{missing} pièce{missing > 1 ? "s" : ""}</span>}
                      <Pill tone={payMeta.tone}>{payMeta.label}</Pill>
                      <span className="yc-num whitespace-nowrap font-semibold sm:w-48 sm:text-right">{formatXof(pay.paid)} / {formatXof(pay.total)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </>
  );
}
