import Link from "next/link";
import type { Metadata } from "next";
import { requireHotelPage } from "@/lib/hotel/guard";
import { PageHeader } from "@/components/yc/panel";
import { IconArrowLeft } from "@/components/yc/icons";
import { RoomTypeEditor } from "@/components/dashboard-hotel/room-type-editor";

export const metadata: Metadata = { title: "Nouveau type de chambre — Y-COM", robots: { index: false, follow: false } };

export default async function NewRoomTypePage() {
  await requireHotelPage("listings.create");
  return (
    <>
      <Link href="/dashboard/chambres" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-yc-ink-soft hover:text-yc-ink"><IconArrowLeft size={16} /> Chambres</Link>
      <PageHeader title="Nouveau type de chambre" description="Créé en brouillon : ajoutez ensuite les chambres (numéros) et une photo, puis mettez-le en ligne." />
      <RoomTypeEditor listingId={null} status={null} canPublish={false} canDelete={false} initial={{ title: "", summary: "", description: "", nightlyPrice: "", maxAdults: 2, maxChildren: 0, bedSummary: "", sizeM2: "", amenities: ["wifi", "air_conditioning"], minNights: 1, checkIn: "14:00", checkOut: "12:00", depositPercent: 0, featured: false, media: [] }} />
    </>
  );
}
