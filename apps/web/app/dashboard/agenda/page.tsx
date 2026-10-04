import Link from "next/link";
import type { Metadata } from "next";
import { hasPermission } from "@yamacommerce/auth";
import { withTenant, listStaff, listAppointments, addDays, isIsoDate, localToUtc, utcToLocal } from "@yamacommerce/database";
import { requireSalonPage } from "@/lib/salon/guard";
import { STATUS_STYLE, WEEKDAYS, clockLabel, formatXof, timeIn } from "@/lib/salon/labels";
import { PageHeader } from "@/components/yc/panel";
import { ButtonLink } from "@/components/yc/button";
import { EmptyState } from "@/components/yc/empty-state";
import { IconArrowLeft, IconArrowRight, IconPlus } from "@/components/yc/icons";

export const metadata: Metadata = { title: "Agenda — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const PX_PER_MIN = 1.3;

/**
 * Agenda du jour, une colonne par personne : heures de travail (le reste hachuré),
 * absences, rendez-vous positionnés à la minute (couleur = statut), ligne de l'heure
 * actuelle. Chaque rendez-vous ouvre sa fiche ; « + » ouvre une prise de rendez-vous.
 */
export default async function AgendaPage({ searchParams }: { searchParams: { jour?: string } }) {
  const membership = await requireSalonPage("reservations.view");
  const canBook = hasPermission(membership.permissions, "reservations.update_status");
  const data = await withTenant(membership.tenantId, async (tx) => {
    const tz = (await tx.tenant.findUnique({ where: { id: membership.tenantId }, select: { timezone: true } }))?.timezone || "Africa/Dakar";
    const today = utcToLocal(new Date(), tz).date;
    const day = searchParams.jour && isIsoDate(searchParams.jour) ? searchParams.jour : today;
    const from = localToUtc(day, 0, tz);
    const to = localToUtc(addDays(day, 1), 0, tz);
    const [staff, appts] = await Promise.all([
      listStaff(tx, membership.tenantId, { activeOnly: true }),
      listAppointments(tx, membership.tenantId, { from, to, status: ["requested", "confirmed", "completed", "no_show"] }),
    ]);
    const timeOff = await tx.staffTimeOff.findMany({ where: { tenantId: membership.tenantId, startAt: { lt: to }, endAt: { gt: from } } });
    return { tz, today, day, from, staff, appts, timeOff };
  });
  const { tz, today, day, staff, appts, timeOff } = data;
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  const hoursOf = (id: string) => staff.find((s) => s.id === id)!.hours.filter((h) => h.weekday === weekday);
  const allHours = staff.flatMap((s) => hoursOf(s.id));
  const apptMinutes = appts.map((a) => utcToLocal(a.startAt, tz).minute);
  const startMin = Math.floor(Math.min(8 * 60, ...allHours.map((h) => h.startMinute), ...apptMinutes) / 60) * 60;
  const endMin = Math.ceil(Math.max(20 * 60, ...allHours.map((h) => h.endMinute), ...appts.map((a) => (a.endAt ? utcToLocal(a.endAt, tz).minute || 1440 : 0))) / 60) * 60;
  const height = (endMin - startMin) * PX_PER_MIN;
  const y = (m: number) => (m - startMin) * PX_PER_MIN;
  const now = utcToLocal(new Date(), tz);
  const expected = appts.filter((a) => a.status !== "no_show").reduce((s, a) => s + (a.totalAmount ?? 0), 0);
  const collected = appts.flatMap((a) => a.payments).filter((p) => !p.voidedAt).reduce((s, p) => s + p.amount, 0);
  const title = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
  const minuteOfInstant = (d: Date) => {
    const l = utcToLocal(d, tz);
    return l.date < day ? 0 : l.date > day ? 1440 : l.minute;
  };

  return (
    <>
      <PageHeader
        eyebrow="Pilotage"
        title="Agenda"
        description={<span className="first-letter:uppercase">{day === today ? "Aujourd'hui, " : ""}{title}</span>}
        actions={canBook ? <ButtonLink href={`/dashboard/rendez-vous/nouveau?jour=${day}`} variant="royal"><IconPlus size={18} /> Rendez-vous</ButtonLink> : undefined}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={`/dashboard/agenda?jour=${addDays(day, -1)}`} aria-label="Jour précédent" className="grid h-10 w-10 place-items-center rounded-lg bg-white ring-1 ring-yc-ink/10 hover:bg-yc-ivory-50"><IconArrowLeft size={18} /></Link>
        <Link href="/dashboard/agenda" className={`h-10 rounded-lg px-4 text-sm font-semibold leading-10 ring-1 ${day === today ? "bg-yc-night-900 text-white ring-yc-night-900" : "bg-white ring-yc-ink/10 hover:bg-yc-ivory-50"}`}>Aujourd&apos;hui</Link>
        <Link href={`/dashboard/agenda?jour=${addDays(day, 1)}`} aria-label="Jour suivant" className="grid h-10 w-10 place-items-center rounded-lg bg-white ring-1 ring-yc-ink/10 hover:bg-yc-ivory-50"><IconArrowRight size={18} /></Link>
        <form action="/dashboard/agenda" className="flex items-center gap-2">
          <input type="date" name="jour" defaultValue={day} aria-label="Aller au jour" className="h-10 rounded-lg bg-white px-3 text-sm ring-1 ring-inset ring-yc-ink/12" />
          <button type="submit" className="h-10 rounded-lg bg-white px-3 text-sm font-semibold ring-1 ring-yc-ink/10 hover:bg-yc-ivory-50">Aller</button>
        </form>
        <p className="ml-auto flex flex-wrap gap-x-5 gap-y-1 text-sm text-yc-ink-soft">
          <span><strong className="yc-num text-yc-ink">{appts.length}</strong> rendez-vous</span>
          <span>Attendu <strong className="yc-num text-yc-ink">{formatXof(expected)}</strong></span>
          <span>Encaissé <strong className="yc-num text-[rgb(4_120_87)]">{formatXof(collected)}</strong></span>
        </p>
      </div>

      {staff.length === 0 ? (
        <div className="rounded-xl bg-white ring-1 ring-yc-ink/[0.07]"><EmptyState title="Aucun membre de l'équipe" description="Ajoutez les personnes qui réalisent les prestations et leurs horaires pour ouvrir l'agenda." /></div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-white shadow-[0_1px_2px_rgb(12_22_48/0.04),0_8px_24px_-16px_rgb(12_22_48/0.12)] ring-1 ring-yc-ink/[0.07]">
          <div className="overflow-x-auto">
            <div className="grid min-w-max" style={{ gridTemplateColumns: `56px repeat(${staff.length}, minmax(190px, 1fr))` }}>
              <div className="sticky left-0 z-20 border-b border-r border-yc-ink/[0.07] bg-white" />
              {staff.map((s) => {
                const count = appts.filter((a) => a.appointment?.staffId === s.id).length;
                const off = hoursOf(s.id).length === 0;
                return (
                  <div key={s.id} className="flex items-center justify-between gap-2 border-b border-r border-yc-ink/[0.07] px-3 py-2.5 last:border-r-0">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#F4E7EA] text-sm font-bold text-[#8E3A52]" aria-hidden="true">{s.displayName.slice(0, 1)}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{s.displayName}</span>
                        <span className="block text-xs text-yc-ink-soft">{off ? `Repos le ${WEEKDAYS[weekday]!.toLowerCase()}` : `${count} rendez-vous`}</span>
                      </span>
                    </span>
                    {canBook && !off && <Link href={`/dashboard/rendez-vous/nouveau?jour=${day}&avec=${s.id}`} aria-label={`Nouveau rendez-vous avec ${s.displayName}`} className="grid h-8 w-8 place-items-center rounded-lg text-yc-ink-soft hover:bg-yc-ink/5 hover:text-yc-ink"><IconPlus size={16} /></Link>}
                  </div>
                );
              })}

              <div className="sticky left-0 z-10 border-r border-yc-ink/[0.07] bg-white" style={{ height }}>
                {Array.from({ length: (endMin - startMin) / 60 + 1 }, (_, i) => startMin + i * 60).map((m) => (
                  <span key={m} className={`absolute right-2 text-[11px] font-medium tabular-nums text-yc-ink-soft ${m === startMin ? "translate-y-0.5" : m === endMin ? "-translate-y-full" : "-translate-y-1/2"}`} style={{ top: y(m) }}>{m < 1440 ? clockLabel(m) : ""}</span>
                ))}
              </div>
              {staff.map((s) => {
                const ranges = hoursOf(s.id);
                return (
                  <div key={s.id} className="relative border-r border-yc-ink/[0.07] last:border-r-0" style={{ height, backgroundImage: "repeating-linear-gradient(135deg, rgb(12 22 48 / 0.035) 0 6px, transparent 6px 12px)" }}>
                    {ranges.map((r) => <span key={r.id} className="absolute inset-x-0 bg-white" style={{ top: y(r.startMinute), height: (r.endMinute - r.startMinute) * PX_PER_MIN }} />)}
                    {Array.from({ length: (endMin - startMin) / 60 }, (_, i) => startMin + i * 60).map((m) => <span key={m} className="absolute inset-x-0 border-t border-yc-ink/[0.06]" style={{ top: y(m) }} />)}
                    {timeOff.filter((t) => t.staffId === s.id).map((t) => {
                      const a = Math.max(startMin, minuteOfInstant(t.startAt));
                      const b = Math.min(endMin, minuteOfInstant(t.endAt));
                      return <span key={t.id} className="absolute inset-x-1 grid place-items-center rounded-md bg-yc-ink/[0.06] text-xs font-semibold text-yc-ink-soft" style={{ top: y(a), height: (b - a) * PX_PER_MIN }}>{t.reason ?? "Absence"}</span>;
                    })}
                    {appts.filter((a) => a.appointment?.staffId === s.id).map((a) => {
                      const m0 = utcToLocal(a.startAt, tz).minute;
                      const m1 = a.appointment ? minuteOfInstant(a.appointment.endAt) : m0 + 30;
                      const buffer = a.appointment ? minuteOfInstant(a.appointment.blockedUntil) - m1 : 0;
                      const hgt = Math.max(28, (m1 - m0) * PX_PER_MIN - 2);
                      return (
                        <Link
                          key={a.id}
                          href={`/dashboard/rendez-vous/${a.id}`}
                          className={`absolute inset-x-1 overflow-hidden rounded-md px-2 py-1 text-xs ring-1 ring-inset transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yc-royal ${STATUS_STYLE[a.status] ?? ""}`}
                          style={{ top: y(m0) + 1, height: hgt }}
                        >
                          <span className="block font-bold tabular-nums">{timeIn(a.startAt, tz)}{a.status === "requested" ? " · à confirmer" : a.status === "completed" ? " · réalisé" : a.status === "no_show" ? " · manqué" : ""}</span>
                          <span className="block truncate font-semibold">{a.customer.firstName} {a.customer.lastName ?? ""}</span>
                          {hgt > 46 && <span className="block truncate opacity-80">{a.listing?.title}</span>}
                          {buffer > 0 && <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px] bg-current opacity-20" />}
                        </Link>
                      );
                    })}
                    {day === today && now.minute >= startMin && now.minute <= endMin && <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-[#E0457B]" style={{ top: y(now.minute) }} />}
                  </div>
                );
              })}
            </div>
          </div>
          <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-yc-ink/[0.07] px-4 py-2.5 text-xs text-yc-ink-soft">
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#FFF6E5] ring-1 ring-[#F0B44C]" />À confirmer</span>
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#EAF0FF] ring-1 ring-[#5B7FE0]" />Confirmé</span>
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#E8F6EF] ring-1 ring-[#3FA176]" />Réalisé</span>
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#FDECEC] ring-1 ring-[#D65A5A]" />Manqué</span>
            <span>Zones hachurées : hors horaires de travail</span>
          </p>
        </div>
      )}
    </>
  );
}
