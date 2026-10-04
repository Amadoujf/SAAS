import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasPermission } from "@yamacommerce/auth";
import { withTenant, getRoomType } from "@yamacommerce/database";
import { requireHotelPage } from "@/lib/hotel/guard";
import { dateOnly, formatXof, shortDate } from "@/lib/hotel/labels";
import { PageHeader } from "@/components/yc/panel";
import { IconArrowLeft } from "@/components/yc/icons";
import { RoomTypeEditor } from "@/components/dashboard-hotel/room-type-editor";
import { RatesPanel } from "@/components/dashboard-hotel/rooms-panels";

export const metadata: Metadata = { title: "Type de chambre — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export default async function RoomTypePage({ params }: { params: { id: string } }) {
  const membership = await requireHotelPage("listings.edit");
  const t = await withTenant(membership.tenantId, (tx) => getRoomType(tx, membership.tenantId, params.id).catch(() => null));
  if (!t?.roomType) notFound();
  const rt = t.roomType;
  const media = (Array.isArray(t.media) ? t.media : []) as { url: string; alt?: string; demo?: boolean }[];
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(membership.permissions, p);
  return (
    <>
      <Link href="/dashboard/chambres" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-yc-ink-soft hover:text-yc-ink"><IconArrowLeft size={16} /> Chambres</Link>
      <PageHeader title={t.title} description={`${rt.rooms.length} chambre${rt.rooms.length > 1 ? "s" : ""} : ${rt.rooms.map((r) => r.number).join(", ") || "aucune"}`} />
      <div className="mb-5">
        <RatesPanel listingId={t.id} basePrice={formatXof(t.price)} rates={rt.rates.map((r) => ({ id: r.id, label: r.label ?? "Période", period: `du ${shortDate(dateOnly(r.startDate))} au ${shortDate(dateOnly(r.endDate))}`, price: `${formatXof(r.nightlyPrice)} / nuit` }))} />
      </div>
      <RoomTypeEditor
        listingId={t.id}
        status={t.status}
        canPublish={can("listings.publish")}
        canDelete={can("listings.delete")}
        initial={{
          title: t.title,
          summary: t.summary ?? "",
          description: t.description ?? "",
          nightlyPrice: t.price == null ? "" : String(t.price),
          maxAdults: rt.maxAdults,
          maxChildren: rt.maxChildren,
          bedSummary: rt.bedSummary,
          sizeM2: rt.sizeM2 == null ? "" : String(rt.sizeM2),
          amenities: rt.amenities,
          minNights: rt.minNights,
          checkIn: hhmm(rt.checkInMinute),
          checkOut: hhmm(rt.checkOutMinute),
          depositPercent: rt.depositPercent,
          featured: t.featured,
          media: media.map((m) => ({ url: m.url, alt: m.alt ?? "", demo: m.demo })),
        }}
      />
    </>
  );
}
