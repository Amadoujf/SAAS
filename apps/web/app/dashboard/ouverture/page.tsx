import type { Metadata } from "next";
import { withTenant, getRestaurantSettings } from "@yamacommerce/database";
import { requireRestaurantPage } from "@/lib/restaurant/guard";
import { PageHeader } from "@/components/yc/panel";
import { RestaurantSettingsPanel } from "@/components/dashboard-restaurant/settings-panel";

export const metadata: Metadata = { title: "Horaires et règles — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function OpeningPage() {
  const membership = await requireRestaurantPage("listings.manage_availability");
  const s = await withTenant(membership.tenantId, (tx) => getRestaurantSettings(tx, membership.tenantId));
  return (
    <>
      <PageHeader eyebrow="Gestion" title="Horaires et règles" description="Quand vous servez, ce que le site accepte, et combien de couverts vous pouvez recevoir." />
      <RestaurantSettingsPanel
        initial={{
          openingHours: s.openingHours,
          acceptTakeaway: s.acceptTakeaway,
          acceptDelivery: s.acceptDelivery,
          acceptDineInQr: s.acceptDineInQr,
          acceptBookings: s.acceptBookings,
          deliveryFee: s.deliveryFee,
          minDeliveryOrder: s.minDeliveryOrder,
          prepMinutes: s.prepMinutes,
          maxCoversPerSlot: s.maxCoversPerSlot,
          bookingSlotMinutes: ([15, 30, 60].includes(s.bookingSlotMinutes) ? s.bookingSlotMinutes : 30) as 15 | 30 | 60,
          bookingDuration: s.bookingDuration,
          maxPartySize: s.maxPartySize,
        }}
      />
    </>
  );
}
