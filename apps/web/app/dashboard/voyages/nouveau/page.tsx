import type { Metadata } from "next";
import Link from "next/link";
import { hasPermission } from "@yamacommerce/auth";
import { requireTravelPage } from "@/lib/travel/guard";
import { PageHeader } from "@/components/yc/panel";
import { IconArrowLeft } from "@/components/yc/icons";
import { TripEditor } from "@/components/dashboard-travel/trip-editor";

export const metadata: Metadata = { title: "Nouveau voyage — Y-COM", robots: { index: false, follow: false } };

export default async function NewTripPage() {
  const membership = await requireTravelPage("listings.create");
  return (
    <>
      <Link href="/dashboard/voyages" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-yc-ink-soft hover:text-yc-ink"><IconArrowLeft size={16} /> Voyages</Link>
      <PageHeader title="Nouveau voyage" description="Créé en brouillon : ajoutez des photos et des dates de départ, puis mettez-le en ligne." />
      <TripEditor
        listingId={null}
        status={null}
        can={{ edit: true, publish: hasPermission(membership.permissions, "listings.publish"), remove: false }}
        initial={{ title: "", summary: "", description: "", pricePerPerson: null, tripType: "circuit", destinationCountry: "Sénégal", destinationCity: "", durationDays: 3, durationNights: 2, included: [], excludedNote: "", depositPercent: 30, requiredDocuments: ["id_card"], meetingPoint: "", featured: false, media: [], itinerary: [] }}
      />
    </>
  );
}
