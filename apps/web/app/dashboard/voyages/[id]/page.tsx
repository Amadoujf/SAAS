import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasPermission } from "@yamacommerce/auth";
import { withTenant, getTravelPackage, listAvailabilities } from "@yamacommerce/database";
import { requireTravelPage } from "@/lib/travel/guard";
import { formatDateRange, formatTripPrice } from "@/lib/travel/labels";
import { LISTING_STATUS_LABELS } from "@/lib/real-estate/labels";
import { PageHeader } from "@/components/yc/panel";
import { Pill } from "@/components/yc/status-pill";
import { IconArrowLeft } from "@/components/yc/icons";
import { TripEditor, type TripDraft } from "@/components/dashboard-travel/trip-editor";
import { DeparturesManager } from "@/components/dashboard-travel/departures-manager";

export const metadata: Metadata = { title: "Voyage — Y-COM", robots: { index: false, follow: false } };

export default async function TripDashboardPage({ params }: { params: { id: string } }) {
  const membership = await requireTravelPage("listings.view");
  const data = await withTenant(membership.tenantId, async (tx) => {
    const trip = await getTravelPackage(tx, membership.tenantId, params.id).catch(() => null);
    if (!trip?.travel) return null;
    const departures = await listAvailabilities(tx, membership.tenantId, trip.id, { from: new Date(Date.now() - 60 * 86_400_000) });
    const bookings = await tx.reservation.count({ where: { tenantId: membership.tenantId, listingId: trip.id, moduleKey: "departures", status: { in: ["requested", "confirmed"] } } });
    return { trip, departures, bookings };
  });
  if (!data) notFound();
  const { trip, departures, bookings } = data;
  const d = trip.travel!;
  const meta = LISTING_STATUS_LABELS[trip.status] ?? LISTING_STATUS_LABELS.draft!;
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(membership.permissions, p);
  const now = new Date();
  const initial: TripDraft = {
    title: trip.title,
    summary: trip.summary ?? "",
    description: trip.description ?? "",
    pricePerPerson: trip.price,
    tripType: d.tripType,
    destinationCountry: d.destinationCountry,
    destinationCity: d.destinationCity ?? "",
    durationDays: d.durationDays,
    durationNights: d.durationNights,
    included: d.included,
    excludedNote: d.excludedNote ?? "",
    depositPercent: d.depositPercent,
    requiredDocuments: d.requiredDocuments,
    meetingPoint: d.meetingPoint ?? "",
    featured: trip.featured,
    media: (Array.isArray(trip.media) ? trip.media : []) as TripDraft["media"],
    itinerary: d.itinerary.map((i) => ({ dayNumber: i.dayNumber, title: i.title, description: i.description ?? "" })),
  };
  return (
    <>
      <Link href="/dashboard/voyages" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-yc-ink-soft hover:text-yc-ink"><IconArrowLeft size={16} /> Voyages</Link>
      <PageHeader
        title={trip.title}
        description={<span className="flex flex-wrap items-center gap-2"><Pill tone={meta.tone}>{meta.label}</Pill><span>{bookings} réservation{bookings > 1 ? "s" : ""} en cours</span>{trip.status === "published" && <span className="font-mono text-xs">/voyages/{trip.slug}</span>}</span>}
      />
      <div className="flex flex-col gap-5">
        <DeparturesManager
          listingId={trip.id}
          canManage={can("listings.manage_availability")}
          rows={departures.map((a) => ({ id: a.id, dates: formatDateRange(a.startAt, a.endAt), label: a.label, capacity: a.capacity, reserved: a.reservedCount, status: a.status, price: formatTripPrice(a.priceOverride ?? trip.price, trip.priceUnit), past: a.startAt < now }))}
        />
        <TripEditor listingId={trip.id} status={trip.status} initial={initial} can={{ edit: can("listings.edit"), publish: can("listings.publish"), remove: can("listings.delete") }} />
      </div>
    </>
  );
}
