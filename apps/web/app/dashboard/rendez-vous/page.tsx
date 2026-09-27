import Link from "next/link";
import type { Metadata } from "next";
import { withTenant, listAppointments, addDays, localToUtc, utcToLocal } from "@yamacommerce/database";
import { requireSalonPage } from "@/lib/salon/guard";
import { APPOINTMENT_STATUS_LABELS, dayIn, formatXof, timeIn } from "@/lib/salon/labels";
import { PageHeader, Panel } from "@/components/yc/panel";
import { Pill } from "@/components/yc/status-pill";
import { EmptyState } from "@/components/yc/empty-state";
import { ButtonLink } from "@/components/yc/button";
import { IconPlus } from "@/components/yc/icons";

export const metadata: Metadata = { title: "Rendez-vous — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const QUEUES = [
  { key: "", label: "À venir" },
  { key: "aujourdhui", label: "Aujourd'hui" },
  { key: "a-confirmer", label: "À confirmer" },
  { key: "a-encaisser", label: "À encaisser" },
  { key: "historique", label: "Historique" },
] as const;

/** Rendez-vous : files de travail (à venir, aujourd'hui, à confirmer, à encaisser) et historique. */
export default async function AppointmentsPage({ searchParams }: { searchParams: { file?: string; q?: string } }) {
  const membership = await requireSalonPage("reservations.view");
  const queue = QUEUES.find((q) => q.key === (searchParams.file ?? ""))?.key ?? "";
  const search = searchParams.q?.trim().slice(0, 60) || undefined;
  const { tz, rows, counts } = await withTenant(membership.tenantId, async (tx) => {
    const tz = (await tx.tenant.findUnique({ where: { id: membership.tenantId }, select: { timezone: true } }))?.timezone || "Africa/Dakar";
    const today = utcToLocal(new Date(), tz).date;
    const dayStart = localToUtc(today, 0, tz);
    const dayEnd = localToUtc(addDays(today, 1), 0, tz);
    const now = new Date();
    const q =
      queue === "aujourdhui" ? { from: dayStart, to: dayEnd, status: ["requested", "confirmed", "completed", "no_show"] }
      : queue === "a-confirmer" ? { from: now, status: ["requested"] }
      : queue === "a-encaisser" ? { to: now, status: ["confirmed", "completed"], order: "desc" as const }
      : queue === "historique" ? { to: now, status: ["completed", "canceled", "no_show"], order: "desc" as const }
      : { from: now, status: ["requested", "confirmed"] };
    let rows = await listAppointments(tx, membership.tenantId, { ...q, search, take: 300 });
    if (queue === "a-encaisser") rows = rows.filter((r) => r.totalAmount != null && r.totalAmount > r.payments.filter((p) => !p.voidedAt).reduce((s, p) => s + p.amount, 0));
    const counts = {
      "a-confirmer": await tx.reservation.count({ where: { tenantId: membership.tenantId, moduleKey: "appointments", status: "requested", startAt: { gte: now } } }),
      aujourdhui: await tx.reservation.count({ where: { tenantId: membership.tenantId, moduleKey: "appointments", status: { in: ["requested", "confirmed"] }, startAt: { gte: dayStart, lt: dayEnd } } }),
    } as Record<string, number>;
    return { tz, rows, counts };
  });

  return (
    <>
      <PageHeader eyebrow="Pilotage" title="Rendez-vous" description="Pris en ligne, au téléphone ou au comptoir. Un rendez-vous n'est « réglé » qu'après encaissement enregistré." actions={<ButtonLink href="/dashboard/rendez-vous/nouveau" variant="royal"><IconPlus size={18} /> Rendez-vous</ButtonLink>} />
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Files de travail" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {QUEUES.map((q) => {
            const on = queue === q.key;
            const n = counts[q.key];
            return <Link key={q.key} href={q.key ? `/dashboard/rendez-vous?file=${q.key}` : "/dashboard/rendez-vous"} aria-current={on ? "page" : undefined} className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${on ? "bg-yc-night-900 text-white" : "bg-white text-yc-ink-soft ring-1 ring-yc-ink/10 hover:text-yc-ink"}`}>{q.label}{n ? <span className={`ml-1.5 rounded-full px-1.5 text-xs ${on ? "bg-white/20" : "bg-yc-warning/15 text-[rgb(146_84_0)]"}`}>{n}</span> : null}</Link>;
          })}
        </nav>
        <form action="/dashboard/rendez-vous" className="flex gap-2">
          {queue && <input type="hidden" name="file" value={queue} />}
          <input name="q" defaultValue={search ?? ""} placeholder="Référence, nom, téléphone" aria-label="Rechercher un rendez-vous" className="h-10 w-full min-w-0 rounded-lg bg-white px-3 text-sm ring-1 ring-inset ring-yc-ink/12 lg:w-64" />
          <button type="submit" className="h-10 shrink-0 rounded-lg bg-yc-night-900 px-4 text-sm font-semibold text-white">Chercher</button>
        </form>
      </div>
      {rows.length === 0 ? (
        <Panel><EmptyState title="Rien dans cette file" description={queue ? "Tout est à jour ici." : "Les rendez-vous pris en ligne apparaissent ici dès leur envoi."} /></Panel>
      ) : (
        <Panel className="overflow-hidden">
          <ul className="divide-y divide-yc-ink/[0.06]">
            {rows.map((a) => {
              const st = APPOINTMENT_STATUS_LABELS[a.status] ?? APPOINTMENT_STATUS_LABELS.requested!;
              const paid = a.payments.filter((p) => !p.voidedAt).reduce((s, p) => s + p.amount, 0);
              return (
                <li key={a.id}>
                  <Link href={`/dashboard/rendez-vous/${a.id}`} className="flex flex-col gap-2 px-5 py-4 hover:bg-yc-ivory-50 sm:flex-row sm:items-center sm:gap-5">
                    <span className="w-28 shrink-0">
                      <span className="block text-[17px] font-bold tabular-nums">{timeIn(a.startAt, tz)}</span>
                      <span className="block text-xs capitalize text-yc-ink-soft">{dayIn(a.startAt, tz, { weekday: "short", day: "numeric", month: "short" })}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 font-semibold">{a.customer.firstName} {a.customer.lastName ?? ""}<Pill tone={st.tone}>{st.label}</Pill></span>
                      <span className="mt-0.5 block text-sm text-yc-ink-soft">{a.listing?.title ?? "Prestation supprimée"} · avec {a.appointment?.staff.displayName ?? "—"} · <span className="font-mono text-xs">{a.reference}</span></span>
                    </span>
                    <span className="yc-num whitespace-nowrap text-sm font-semibold sm:w-44 sm:text-right">{paid > 0 ? `${formatXof(paid)} / ` : ""}{formatXof(a.totalAmount)}</span>
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
