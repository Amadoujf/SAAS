import Link from "next/link";
import type { Metadata } from "next";
import { withTenant, listStays, utcToLocal } from "@yamacommerce/database";
import { requireHotelPage } from "@/lib/hotel/guard";
import { STAY_STATUS_LABELS, dateOnly, formatXof, guestsLabel, nightsLabel, shortDate } from "@/lib/hotel/labels";
import { PageHeader, Panel } from "@/components/yc/panel";
import { Pill } from "@/components/yc/status-pill";
import { EmptyState } from "@/components/yc/empty-state";
import { ButtonLink } from "@/components/yc/button";
import { IconPlus } from "@/components/yc/icons";

export const metadata: Metadata = { title: "Séjours — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const QUEUES = [
  { key: "", label: "À venir" },
  { key: "arrivees", label: "Arrivées du jour" },
  { key: "departs", label: "Départs du jour" },
  { key: "sur-place", label: "Clients sur place" },
  { key: "a-confirmer", label: "À confirmer" },
  { key: "historique", label: "Historique" },
] as const;

/** Séjours : arrivées et départs du jour, clients sur place, demandes, historique. */
export default async function StaysPage({ searchParams }: { searchParams: { file?: string; q?: string } }) {
  const membership = await requireHotelPage("reservations.view");
  const queue = QUEUES.find((q) => q.key === (searchParams.file ?? ""))?.key ?? "";
  const search = searchParams.q?.trim().slice(0, 60) || undefined;
  const { rows, counts } = await withTenant(membership.tenantId, async (tx) => {
    const tz = (await tx.tenant.findUnique({ where: { id: membership.tenantId }, select: { timezone: true } }))?.timezone || "Africa/Dakar";
    const today = utcToLocal(new Date(), tz).date;
    const active = ["requested", "confirmed"];
    const q =
      queue === "arrivees" ? { arrivalOn: today, status: active }
      : queue === "departs" ? { departureOn: today, status: ["confirmed", "completed"] }
      : queue === "sur-place" ? { inHouse: true, status: ["confirmed"] }
      : queue === "a-confirmer" ? { status: ["requested"] }
      : queue === "historique" ? { status: ["completed", "canceled", "no_show"], order: "desc" as const }
      : { arrivalFrom: today, status: active };
    const rows = await listStays(tx, membership.tenantId, { ...q, search, take: 300 });
    const count = async (f: Parameters<typeof listStays>[2]) => (await listStays(tx, membership.tenantId, { ...f, take: 500 })).length;
    return {
      rows,
      counts: { arrivees: await count({ arrivalOn: today, status: active }), departs: await count({ departureOn: today, status: ["confirmed"] }), "sur-place": await count({ inHouse: true, status: ["confirmed"] }), "a-confirmer": await count({ status: ["requested"] }) } as Record<string, number>,
    };
  });
  return (
    <>
      <PageHeader eyebrow="Pilotage" title="Séjours" description="Réservés en ligne, au téléphone ou à la réception. Un séjour n'est « réglé » qu'après encaissement enregistré." actions={<ButtonLink href="/dashboard/sejours/nouveau" variant="royal"><IconPlus size={18} /> Séjour</ButtonLink>} />
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Files de travail" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {QUEUES.map((q) => {
            const on = queue === q.key;
            const n = counts[q.key];
            return <Link key={q.key} href={q.key ? `/dashboard/sejours?file=${q.key}` : "/dashboard/sejours"} aria-current={on ? "page" : undefined} className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${on ? "bg-yc-night-900 text-white" : "bg-white text-yc-ink-soft ring-1 ring-yc-ink/10 hover:text-yc-ink"}`}>{q.label}{n ? <span className={`ml-1.5 rounded-full px-1.5 text-xs ${on ? "bg-white/20" : "bg-yc-warning/15 text-[rgb(146_84_0)]"}`}>{n}</span> : null}</Link>;
          })}
        </nav>
        <form action="/dashboard/sejours" className="flex gap-2">
          {queue && <input type="hidden" name="file" value={queue} />}
          <input name="q" defaultValue={search ?? ""} placeholder="Référence, nom, téléphone" aria-label="Rechercher un séjour" className="h-10 w-full min-w-0 rounded-lg bg-white px-3 text-sm ring-1 ring-inset ring-yc-ink/12 lg:w-64" />
          <button type="submit" className="h-10 shrink-0 rounded-lg bg-yc-night-900 px-4 text-sm font-semibold text-white">Chercher</button>
        </form>
      </div>
      {rows.length === 0 ? (
        <Panel><EmptyState title="Rien dans cette file" description={queue ? "Tout est à jour ici." : "Les réservations du site apparaissent ici dès leur envoi."} /></Panel>
      ) : (
        <Panel className="overflow-hidden">
          <ul className="divide-y divide-yc-ink/[0.06]">
            {rows.map((s) => {
              const st = s.stay?.checkedInAt && !s.stay.checkedOutAt ? { label: "Sur place", tone: "success" as const } : STAY_STATUS_LABELS[s.status] ?? STAY_STATUS_LABELS.requested!;
              const paid = s.payments.filter((p) => !p.voidedAt).reduce((t, p) => t + p.amount, 0);
              return (
                <li key={s.id}>
                  <Link href={`/dashboard/sejours/${s.id}`} className="flex flex-col gap-2 px-5 py-4 hover:bg-yc-ivory-50 sm:flex-row sm:items-center sm:gap-5">
                    <span className="w-52 shrink-0 text-sm">
                      <span className="block font-bold first-letter:uppercase">{s.stay ? shortDate(dateOnly(s.stay.arrival)) : "—"} → {s.stay ? shortDate(dateOnly(s.stay.departure)) : ""}</span>
                      <span className="block text-xs text-yc-ink-soft">{s.stay ? nightsLabel(s.stay.nights) : ""}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 font-semibold">{s.customer.firstName} {s.customer.lastName ?? ""}<Pill tone={st.tone}>{st.label}</Pill></span>
                      <span className="mt-0.5 block text-sm text-yc-ink-soft">{s.listing?.title} · ch. {s.stay?.room.number} · {s.stay ? guestsLabel(s.stay.adults, s.stay.children) : ""} · <span className="font-mono text-xs">{s.reference}</span></span>
                    </span>
                    <span className="yc-num whitespace-nowrap text-sm font-semibold sm:w-48 sm:text-right">{paid > 0 ? `${formatXof(paid)} / ` : ""}{formatXof(s.totalAmount)}</span>
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
