import Link from "next/link";
import type { Metadata } from "next";
import { hasPermission } from "@yamacommerce/auth";
import { withTenant, hotelPlanning, isIsoDate, utcToLocal } from "@yamacommerce/database";
import { requireHotelPage } from "@/lib/hotel/guard";
import { HOUSEKEEPING_LABELS, addDaysIso, dateOnly, shortDate } from "@/lib/hotel/labels";
import { PageHeader } from "@/components/yc/panel";
import { ButtonLink } from "@/components/yc/button";
import { EmptyState } from "@/components/yc/empty-state";
import { IconArrowLeft, IconArrowRight, IconPlus } from "@/components/yc/icons";

export const metadata: Metadata = { title: "Planning — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const DAYS = 14;
const CELL = 64;
const BAR: Record<string, string> = {
  requested: "bg-[#FFF3DC] ring-[#EBA93A] text-[#6B4300]",
  confirmed: "bg-[#E6EDFF] ring-[#5B7FE0] text-[#15296B]",
  inhouse: "bg-[#DFF3E8] ring-[#3FA176] text-[#0F4D31]",
  completed: "bg-yc-ink/[0.05] ring-yc-ink/15 text-yc-ink-soft",
};
const HK_DOT: Record<string, string> = { clean: "bg-[#3FA176]", dirty: "bg-[#E59A2B]", inspected: "bg-[#5B7FE0]", out_of_service: "bg-[#D65A5A]" };

/**
 * Planning chambres × jours : chaque séjour est une barre de l'après-midi d'arrivée au
 * matin de départ (couleur = à confirmer, confirmé, client arrivé, terminé), chaque
 * chambre affiche son état de ménage. Une barre ouvre la fiche du séjour.
 */
export default async function PlanningPage({ searchParams }: { searchParams: { du?: string } }) {
  const membership = await requireHotelPage("reservations.view");
  const canBook = hasPermission(membership.permissions, "reservations.update_status");
  const data = await withTenant(membership.tenantId, async (tx) => {
    const tz = (await tx.tenant.findUnique({ where: { id: membership.tenantId }, select: { timezone: true } }))?.timezone || "Africa/Dakar";
    const today = utcToLocal(new Date(), tz).date;
    const from = searchParams.du && isIsoDate(searchParams.du) ? searchParams.du : addDaysIso(today, -1);
    return { today, ...(await hotelPlanning(tx, membership.tenantId, from, DAYS)) };
  });
  const { today, from, rooms, stays } = data;
  const days = Array.from({ length: DAYS }, (_, i) => addDaysIso(from, i));
  const dayIndex = (iso: string) => Math.round((new Date(`${iso}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000);
  const groups = [...new Map(rooms.map((r) => [r.roomType.listing.id, r.roomType.listing.title])).entries()];
  const occupied = (d: string) => stays.filter((s) => dateOnly(s.arrival) <= d && d < dateOnly(s.departure)).length;

  return (
    <>
      <PageHeader eyebrow="Pilotage" title="Planning" description="Deux semaines de chambres : touchez un séjour pour l'ouvrir." actions={canBook ? <ButtonLink href="/dashboard/sejours/nouveau" variant="royal"><IconPlus size={18} /> Séjour</ButtonLink> : undefined} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={`/dashboard/planning?du=${addDaysIso(from, -7)}`} aria-label="Semaine précédente" className="grid h-10 w-10 place-items-center rounded-lg bg-white ring-1 ring-yc-ink/10 hover:bg-yc-ivory-50"><IconArrowLeft size={18} /></Link>
        <Link href="/dashboard/planning" className="h-10 rounded-lg bg-white px-4 text-sm font-semibold leading-10 ring-1 ring-yc-ink/10 hover:bg-yc-ivory-50">Aujourd&apos;hui</Link>
        <Link href={`/dashboard/planning?du=${addDaysIso(from, 7)}`} aria-label="Semaine suivante" className="grid h-10 w-10 place-items-center rounded-lg bg-white ring-1 ring-yc-ink/10 hover:bg-yc-ivory-50"><IconArrowRight size={18} /></Link>
        <form action="/dashboard/planning" className="flex items-center gap-2">
          <input type="date" name="du" defaultValue={from} aria-label="À partir du" className="h-10 rounded-lg bg-white px-3 text-sm ring-1 ring-inset ring-yc-ink/12" />
          <button type="submit" className="h-10 rounded-lg bg-white px-3 text-sm font-semibold ring-1 ring-yc-ink/10 hover:bg-yc-ivory-50">Aller</button>
        </form>
      </div>
      {rooms.length === 0 ? (
        <div className="rounded-xl bg-white ring-1 ring-yc-ink/[0.07]"><EmptyState title="Aucune chambre" description="Créez vos types de chambres puis ajoutez les chambres (numéros) pour ouvrir le planning." /></div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-white shadow-[0_1px_2px_rgb(12_22_48/0.04),0_8px_24px_-16px_rgb(12_22_48/0.12)] ring-1 ring-yc-ink/[0.07]">
          <div className="overflow-x-auto">
            <div className="min-w-max">
              <div className="flex border-b border-yc-ink/[0.08]">
                <div className="sticky left-0 z-20 w-40 shrink-0 border-r border-yc-ink/[0.08] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-yc-ink-soft">Chambre</div>
                {days.map((d) => (
                  <div key={d} className={`shrink-0 border-r border-yc-ink/[0.05] py-2 text-center ${d === today ? "bg-[#EEF3FF]" : ""}`} style={{ width: CELL }}>
                    <span className="block text-[11px] uppercase text-yc-ink-soft">{shortDate(d, { weekday: "short" }).replace(".", "")}</span>
                    <span className={`block text-sm font-bold ${d === today ? "text-yc-royal" : ""}`}>{Number(d.slice(8))}</span>
                    <span className="block text-[10px] text-yc-ink-soft">{occupied(d)}/{rooms.length}</span>
                  </div>
                ))}
              </div>
              {groups.map(([typeId, title]) => (
                <div key={typeId}>
                  <div className="sticky left-0 border-b border-yc-ink/[0.06] bg-yc-ivory-50 px-3 py-1.5 text-xs font-semibold text-yc-ink-soft">{title}</div>
                  {rooms.filter((r) => r.roomType.listing.id === typeId).map((room) => {
                    const hk = HOUSEKEEPING_LABELS[room.housekeeping]!;
                    return (
                      <div key={room.id} className="relative flex h-12 border-b border-yc-ink/[0.05]">
                        <div className="sticky left-0 z-20 flex w-40 shrink-0 items-center gap-2 border-r border-yc-ink/[0.08] bg-white px-3">
                          <span className="text-sm font-bold">{room.number}</span>
                          <span className="flex min-w-0 items-center gap-1 text-[11px] text-yc-ink-soft" title={room.note ?? undefined}><span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${HK_DOT[room.housekeeping]}`} /><span className="truncate">{hk.label}</span></span>
                        </div>
                        {days.map((d) => <div key={d} className={`shrink-0 border-r border-yc-ink/[0.04] ${d === today ? "bg-[#F5F8FF]" : ""} ${room.housekeeping === "out_of_service" ? "bg-[repeating-linear-gradient(135deg,rgb(214_90_90/0.08)_0_6px,transparent_6px_12px)]" : ""}`} style={{ width: CELL }} />)}
                        {stays.filter((s) => s.roomId === room.id).map((s) => {
                          const a = dayIndex(dateOnly(s.arrival));
                          const b = dayIndex(dateOnly(s.departure));
                          const left = Math.max(a * CELL + CELL / 2, 0);
                          const right = Math.min(b * CELL + CELL / 2, DAYS * CELL);
                          if (right <= 0 || left >= DAYS * CELL) return null;
                          const state = s.checkedOutAt ? "completed" : s.checkedInAt ? "inhouse" : s.reservation.status;
                          return (
                            <Link
                              key={s.reservationId}
                              href={`/dashboard/sejours/${s.reservationId}`}
                              title={`${s.reservation.customer.firstName} ${s.reservation.customer.lastName ?? ""} · ${s.nights} nuit${s.nights > 1 ? "s" : ""}`}
                              className={`absolute top-1.5 z-10 flex h-9 items-center overflow-hidden rounded-md px-2 text-xs font-semibold ring-1 ring-inset hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yc-royal ${BAR[state] ?? BAR.confirmed}`}
                              style={{ left: 160 + left, width: Math.max(right - left - 2, 24) }}
                            >
                              <span className="truncate">{s.reservation.customer.firstName} {s.reservation.customer.lastName ?? ""}</span>
                            </Link>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-yc-ink/[0.07] px-4 py-2.5 text-xs text-yc-ink-soft">
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#FFF3DC] ring-1 ring-[#EBA93A]" />À confirmer</span>
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#E6EDFF] ring-1 ring-[#5B7FE0]" />Confirmé</span>
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#DFF3E8] ring-1 ring-[#3FA176]" />Client arrivé</span>
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-yc-ink/[0.05] ring-1 ring-yc-ink/15" />Terminé</span>
            <span>Ménage : <span className="mx-1 inline-block h-2 w-2 rounded-full bg-[#3FA176]" />propre <span className="mx-1 inline-block h-2 w-2 rounded-full bg-[#E59A2B]" />à nettoyer <span className="mx-1 inline-block h-2 w-2 rounded-full bg-[#5B7FE0]" />vérifiée <span className="mx-1 inline-block h-2 w-2 rounded-full bg-[#D65A5A]" />hors service</span>
          </p>
        </div>
      )}
    </>
  );
}
