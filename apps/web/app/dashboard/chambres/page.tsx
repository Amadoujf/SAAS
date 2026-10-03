import Link from "next/link";
import type { Metadata } from "next";
import { hasPermission } from "@yamacommerce/auth";
import { withTenant, listRoomTypes, getHotelSettings, utcToLocal } from "@yamacommerce/database";
import { requireHotelPage } from "@/lib/hotel/guard";
import { formatXof } from "@/lib/hotel/labels";
import { PageHeader, Panel } from "@/components/yc/panel";
import { Pill } from "@/components/yc/status-pill";
import { EmptyState } from "@/components/yc/empty-state";
import { ButtonLink } from "@/components/yc/button";
import { IconPlus } from "@/components/yc/icons";
import { AddRoomForm, HotelSettingsPanel, HousekeepingBoard } from "@/components/dashboard-hotel/rooms-panels";

export const metadata: Metadata = { title: "Chambres et ménage — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const plural = (n: number, w: string) => `${n} ${w}${n > 1 ? "s" : ""}`;

const STATUS: Record<string, { label: string; tone: "success" | "neutral" | "warning" }> = { published: { label: "En ligne", tone: "success" }, draft: { label: "Brouillon", tone: "neutral" }, unavailable: { label: "Retiré", tone: "warning" }, archived: { label: "Archivé", tone: "neutral" } };

/** Types de chambres, chambres physiques et état du ménage ; règles de réservation en ligne. */
export default async function RoomsPage() {
  const membership = await requireHotelPage("listings.view");
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(membership.permissions, p);
  const data = await withTenant(membership.tenantId, async (tx) => {
    const tz = (await tx.tenant.findUnique({ where: { id: membership.tenantId }, select: { timezone: true } }))?.timezone || "Africa/Dakar";
    const today = new Date(`${utcToLocal(new Date(), tz).date}T00:00:00Z`);
    return {
      types: await listRoomTypes(tx, membership.tenantId),
      settings: await getHotelSettings(tx, membership.tenantId),
      occupants: await tx.hotelStay.findMany({ where: { tenantId: membership.tenantId, active: true, arrival: { lte: today }, departure: { gt: today }, reservation: { status: { in: ["requested", "confirmed"] } } }, include: { reservation: { select: { customer: { select: { firstName: true, lastName: true } } } } } }),
    };
  });
  const occupantOf = (roomId: string) => {
    const s = data.occupants.find((o) => o.roomId === roomId);
    return s ? `${s.reservation.customer.firstName} ${s.reservation.customer.lastName ?? ""}`.trim() + (s.checkedInAt ? "" : " (attendu)") : null;
  };
  const dirty = data.types.flatMap((t) => t.roomType?.rooms ?? []).filter((r) => r.housekeeping === "dirty").length;
  return (
    <>
      <PageHeader eyebrow="Établissement" title="Chambres et ménage" description={dirty ? `${dirty} chambre${dirty > 1 ? "s" : ""} à nettoyer.` : "Toutes les chambres sont prêtes."} actions={can("listings.create") ? <ButtonLink href="/dashboard/chambres/nouveau" variant="royal"><IconPlus size={18} /> Type de chambre</ButtonLink> : undefined} />
      {data.types.length === 0 ? (
        <Panel><EmptyState title="Aucun type de chambre" description="Créez un type (capacité, prix, photos), puis ajoutez ses chambres par numéro." /></Panel>
      ) : (
        <div className="grid gap-5">
          {data.types.map((t) => {
            const st = STATUS[t.status] ?? STATUS.draft!;
            return (
              <Panel key={t.id} className="p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="flex flex-wrap items-center gap-2 text-[18px] font-bold"><Link href={`/dashboard/chambres/${t.id}`} className="hover:underline">{t.title}</Link><Pill tone={st.tone}>{st.label}</Pill></h2>
                    <p className="mt-0.5 text-sm text-yc-ink-soft">{formatXof(t.price)} / nuit · {plural(t.roomType?.maxAdults ?? 0, "adulte")} max · {plural(t.roomType?.rooms.length ?? 0, "chambre")}{t.roomType?.rates.length ? ` · ${plural(t.roomType.rates.length, "tarif")} de période` : ""}</p>
                  </div>
                  {can("listings.edit") && <Link href={`/dashboard/chambres/${t.id}`} className="text-sm font-semibold text-yc-electric hover:underline">Modifier le type et les tarifs</Link>}
                </div>
                <div className="mt-4">
                  <HousekeepingBoard canChange={can("reservations.update_status")} rooms={(t.roomType?.rooms ?? []).map((r) => ({ id: r.id, number: r.number, floor: r.floor, housekeeping: r.housekeeping, note: r.note, isActive: r.isActive, occupant: occupantOf(r.id) }))} />
                </div>
                {can("listings.manage_availability") && <AddRoomForm listingId={t.id} />}
              </Panel>
            );
          })}
        </div>
      )}
      {can("listings.manage_availability") && <div className="mt-6"><HotelSettingsPanel initial={{ autoConfirm: data.settings.autoConfirm, cancelFreeHours: data.settings.cancelFreeHours, maxAdvanceDays: data.settings.maxAdvanceDays, maxNights: data.settings.maxNights }} /></div>}
    </>
  );
}
