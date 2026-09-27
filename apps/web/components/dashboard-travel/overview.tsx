import Link from "next/link";
import { withTenant, travelOverview, listUpcomingDepartures, DEPARTURES_MODULE } from "@yamacommerce/database";
import { hasPermission, type Permission } from "@yamacommerce/auth";
import { formatDateRange, formatShortDate, formatXof, seatsLabel } from "@/lib/travel/labels";
import { Panel, PanelHeader } from "@/components/yc/panel";
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

/** Vue d'ensemble d'une agence de voyage : départs à venir, remplissage, demandes, encaissements, pièces. */
export async function TravelOverview({ tenantId, permissions, greeting }: { tenantId: string; permissions: string[]; greeting: React.ReactNode }) {
  const can = (p: Permission) => hasPermission(permissions, p);
  const now = new Date();
  const data = await withTenant(tenantId, async (tx) => ({
    kpi: await travelOverview(tx, tenantId, now),
    departures: (await listUpcomingDepartures(tx, tenantId, { from: now })).slice(0, 5),
    requests: await tx.reservation.findMany({
      where: { tenantId, moduleKey: DEPARTURES_MODULE, status: "requested" },
      include: { listing: { select: { title: true } }, customer: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  }));
  const { kpi } = data;
  const fill = kpi.seats ? Math.round((kpi.seatsSold / kpi.seats) * 100) : null;

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>{greeting}<p className="mt-1 text-yc-ink-soft">Votre agence aujourd&apos;hui.</p></div>
        {can("listings.create") && <ButtonLink href="/dashboard/voyages/nouveau" variant="royal"><IconPlus size={18} /> Nouveau voyage</ButtonLink>}
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi href="/dashboard/reservations?file=a-confirmer" label="Demandes à confirmer" value={String(kpi.pendingRequests)} foot="Site et téléphone" tone={kpi.pendingRequests ? "orange" : "blue"} />
        <Kpi href="/dashboard/departs" label="Départs sous 60 jours" value={String(kpi.upcomingDepartures)} foot={fill === null ? "Aucun départ programmé" : `${kpi.seatsSold}/${kpi.seats} places vendues · ${fill} %`} />
        <Kpi href="/dashboard/reservations" label="Encaissé ce mois" value={formatXof(kpi.collectedThisMonth)} foot={`Reste à encaisser : ${formatXof(kpi.balanceDue)}`} tone="green" />
        <Kpi href="/dashboard/reservations?file=pieces" label="Pièces manquantes" value={String(kpi.missingDocuments)} foot="Voyageurs des prochains départs" tone={kpi.missingDocuments ? "orange" : "blue"} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel className="overflow-hidden">
          <PanelHeader title="Prochains départs" action={<Link href="/dashboard/departs" className="text-sm font-semibold text-yc-electric hover:underline">Tout voir</Link>} />
          {data.departures.length === 0 ? (
            <EmptyState title="Aucun départ programmé" description="Ajoutez des dates à vos voyages pour ouvrir les réservations." />
          ) : (
            <ul className="divide-y divide-yc-ink/[0.06]">
              {data.departures.map((d) => {
                const seats = seatsLabel(d.capacity, d.reservedCount, d.status);
                const pct = d.capacity ? Math.round((d.reservedCount / d.capacity) * 100) : 0;
                return (
                  <li key={d.id}>
                    <Link href={`/dashboard/departs/${d.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-yc-ivory-50">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{d.listing.title}</span>
                        <span className="block text-sm text-yc-ink-soft">{formatDateRange(d.startAt, d.endAt)} · {seats.text}</span>
                      </span>
                      <span className="w-24 shrink-0" aria-label={`${d.reservedCount} places réservées sur ${d.capacity}`}>
                        <span className="block h-1.5 overflow-hidden rounded-full bg-yc-ink/[0.07]"><span className="block h-full rounded-full bg-yc-electric" style={{ width: `${pct}%` }} /></span>
                        <span className="yc-num mt-1 block text-right text-xs text-yc-ink-soft">{d.reservedCount}/{d.capacity}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <Panel className="overflow-hidden">
          <PanelHeader title="Dernières demandes" action={<Link href="/dashboard/reservations?file=a-confirmer" className="text-sm font-semibold text-yc-electric hover:underline">Tout voir</Link>} />
          {data.requests.length === 0 ? (
            <EmptyState title="Aucune demande en attente" description="Les réservations envoyées depuis votre site apparaîtront ici." />
          ) : (
            <ul className="divide-y divide-yc-ink/[0.06]">
              {data.requests.map((r) => (
                <li key={r.id}>
                  <Link href={`/dashboard/reservations/${r.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-yc-ivory-50">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{r.customer.firstName} {r.customer.lastName ?? ""} · {r.listing?.title ?? "Voyage supprimé"}</span>
                      <span className="block text-sm text-yc-ink-soft">Départ le {formatShortDate(r.startAt)} · {r.quantity} voyageur{r.quantity > 1 ? "s" : ""}</span>
                    </span>
                    <span className="yc-num shrink-0 font-semibold">{formatXof(r.totalAmount)}</span>
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
