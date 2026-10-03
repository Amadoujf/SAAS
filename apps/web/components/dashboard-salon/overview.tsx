import Link from "next/link";
import { withTenant, salonOverview, listAppointments, addDays, localToUtc } from "@yamacommerce/database";
import { hasPermission, type Permission } from "@yamacommerce/auth";
import { APPOINTMENT_STATUS_LABELS, dayIn, formatXof, timeIn } from "@/lib/salon/labels";
import { Panel, PanelHeader } from "@/components/yc/panel";
import { Pill } from "@/components/yc/status-pill";
import { ButtonLink } from "@/components/yc/button";
import { EmptyState } from "@/components/yc/empty-state";
import { IconChevronRight, IconPlus } from "@/components/yc/icons";

function Kpi({ href, label, value, foot, tone = "blue" }: { href: string; label: string; value: string; foot: string; tone?: "blue" | "orange" | "green" }) {
  const color = tone === "orange" ? "text-[#C2410C]" : tone === "green" ? "text-[rgb(4_120_87)]" : "text-yc-ink";
  return (
    <Link href={href} className="yc-focus group rounded-xl bg-white p-4 shadow-[0_1px_2px_rgb(12_22_48/0.04),0_8px_24px_-16px_rgb(12_22_48/0.12)] ring-1 ring-yc-ink/[0.07] transition-shadow hover:shadow-[0_12px_30px_-14px_rgb(12_22_48/0.25)] sm:p-5">
      <span className="flex items-center justify-between text-[13px] text-yc-ink-soft sm:text-[15px]">{label}<IconChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" /></span>
      <span className={`yc-num mt-1 block text-[20px] font-bold tracking-[-0.02em] sm:text-[26px] ${color}`}>{value}</span>
      <span className="mt-0.5 block text-xs text-yc-ink-soft sm:text-sm">{foot}</span>
    </Link>
  );
}

/** Vue d'ensemble d'un salon : la journée (rendez-vous, attendu, encaissé), demandes à confirmer. */
export async function SalonOverview({ tenantId, permissions, greeting }: { tenantId: string; permissions: string[]; greeting: React.ReactNode }) {
  const can = (p: Permission) => hasPermission(permissions, p);
  const data = await withTenant(tenantId, async (tx) => {
    const kpi = await salonOverview(tx, tenantId);
    const from = localToUtc(kpi.today, 0, kpi.timezone);
    const to = localToUtc(addDays(kpi.today, 1), 0, kpi.timezone);
    return {
      kpi,
      todayList: await listAppointments(tx, tenantId, { from, to, status: ["requested", "confirmed", "completed", "no_show"] }),
      requests: await listAppointments(tx, tenantId, { from: new Date(), status: ["requested"], take: 6 }),
      upcoming: (await listAppointments(tx, tenantId, { from: to, status: ["requested", "confirmed"], take: 6 })),
    };
  });
  const { kpi } = data;
  const tz = kpi.timezone;
  const now = new Date();
  const nextOne = data.todayList.find((a) => a.startAt >= now && (a.status === "confirmed" || a.status === "requested"));

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>{greeting}<p className="mt-1 text-yc-ink-soft">Votre salon aujourd&apos;hui{nextOne ? ` · prochain rendez-vous à ${timeIn(nextOne.startAt, tz)}` : ""}.</p></div>
        {can("reservations.update_status") && <ButtonLink href="/dashboard/rendez-vous/nouveau" variant="royal"><IconPlus size={18} /> Rendez-vous</ButtonLink>}
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi href="/dashboard/agenda" label="Rendez-vous aujourd'hui" value={String(kpi.todayCount)} foot={`${kpi.weekCount} sur les 7 prochains jours`} />
        <Kpi href="/dashboard/rendez-vous?file=a-confirmer" label="À confirmer" value={String(kpi.pendingRequests)} foot="Demandes reçues en ligne" tone={kpi.pendingRequests ? "orange" : "blue"} />
        <Kpi href="/dashboard/agenda" label="Attendu aujourd'hui" value={formatXof(kpi.todayExpected)} foot="Selon les prix de la carte" />
        <Kpi href="/dashboard/rendez-vous?file=a-encaisser" label="Encaissé aujourd'hui" value={formatXof(kpi.collectedToday)} foot={`${kpi.activeStaff} personne${kpi.activeStaff > 1 ? "s" : ""} dans l'équipe`} tone="green" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Panel className="overflow-hidden">
          <PanelHeader title="La journée" action={<Link href="/dashboard/agenda" className="text-sm font-semibold text-yc-electric hover:underline">Ouvrir l&apos;agenda</Link>} />
          {data.todayList.length === 0 ? (
            <EmptyState title="Aucun rendez-vous aujourd'hui" description={data.upcoming[0] ? `Prochain : ${dayIn(data.upcoming[0].startAt, tz, { weekday: "long", day: "numeric" })} à ${timeIn(data.upcoming[0].startAt, tz)}.` : "Les rendez-vous pris en ligne apparaîtront ici."} />
          ) : (
            <ol className="divide-y divide-yc-ink/[0.06]">
              {data.todayList.map((a) => {
                const st = APPOINTMENT_STATUS_LABELS[a.status]!;
                const past = (a.endAt ?? a.startAt) < now;
                return (
                  <li key={a.id}>
                    <Link href={`/dashboard/rendez-vous/${a.id}`} className={`flex items-center gap-4 px-5 py-3 hover:bg-yc-ivory-50 ${past && a.status !== "confirmed" ? "opacity-70" : ""}`}>
                      <span className="w-14 shrink-0 text-[15px] font-bold tabular-nums">{timeIn(a.startAt, tz)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{a.customer.firstName} {a.customer.lastName ?? ""} · {a.listing?.title}</span>
                        <span className="block text-sm text-yc-ink-soft">avec {a.appointment?.staff.displayName}</span>
                      </span>
                      <Pill tone={st.tone}>{st.label}</Pill>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>
        <Panel className="overflow-hidden">
          <PanelHeader title={data.requests.length ? "À confirmer" : "Prochains jours"} action={<Link href="/dashboard/rendez-vous" className="text-sm font-semibold text-yc-electric hover:underline">Tout voir</Link>} />
          {(data.requests.length ? data.requests : data.upcoming).length === 0 ? (
            <EmptyState title="Rien de prévu" description="Partagez le lien de votre site pour recevoir des rendez-vous." />
          ) : (
            <ul className="divide-y divide-yc-ink/[0.06]">
              {(data.requests.length ? data.requests : data.upcoming).map((a) => (
                <li key={a.id}>
                  <Link href={`/dashboard/rendez-vous/${a.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-yc-ivory-50">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{a.customer.firstName} {a.customer.lastName ?? ""} · {a.listing?.title}</span>
                      <span className="block text-sm capitalize text-yc-ink-soft">{dayIn(a.startAt, tz, { weekday: "short", day: "numeric", month: "short" })} · {timeIn(a.startAt, tz)} · {a.appointment?.staff.displayName}</span>
                    </span>
                    <span className="yc-num shrink-0 text-sm font-semibold">{formatXof(a.totalAmount)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
