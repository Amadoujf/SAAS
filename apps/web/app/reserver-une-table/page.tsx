import type { Metadata } from "next";
import { resolveRestaurant } from "@/lib/restaurant/restaurant-context";
import { loadService } from "@/lib/restaurant/restaurant-data";
import { RestaurantShell } from "@/components/restaurant/restaurant-shell";
import { TableBooking } from "@/components/restaurant/table-booking";
import { PublicSiteSuspended } from "@/components/public-site-suspended";
import { PublicSiteBillingSuspended } from "@/components/public-site-billing-suspended";

export async function generateMetadata(): Promise<Metadata> {
  const r = await resolveRestaurant("/reserver-une-table");
  return r.status === "ok" ? { title: `Réserver une table — ${r.restaurant.tenantName}` } : {};
}
export const dynamic = "force-dynamic";

export default async function BookTablePage() {
  const r = await resolveRestaurant("/reserver-une-table");
  if (r.status === "suspended") return <PublicSiteSuspended tenantName={r.tenantName} />;
  if (r.status === "billing_suspended") return <PublicSiteBillingSuspended tenantName={r.tenantName} />;
  const { restaurant } = r;
  const service = await loadService(restaurant.tenantId);
  return (
    <RestaurantShell restaurant={restaurant} open={service.open}>
      <div className="mx-auto max-w-4xl px-4 pt-10 sm:px-8">
        <h1 className="font-[family-name:var(--font-heading)] text-[48px] uppercase leading-[0.92] tracking-[-0.02em] sm:text-[72px]">Réserver une table</h1>
        <p className="mt-3 max-w-xl text-[16px] text-[var(--color-text-secondary)]">Les heures proposées sont celles où il reste réellement de la place. Votre table est confirmée tout de suite, et vous gardez un lien pour l&apos;annuler.</p>
        <div className="mt-10">
          {restaurant.rules.acceptBookings ? (
            <TableBooking today={service.today} maxParty={restaurant.rules.maxPartySize} phone={restaurant.contact.phone} />
          ) : (
            <p className="rounded-[var(--radius-md)] bg-[var(--color-surface)] px-4 py-3 text-[15px]">Les réservations en ligne sont fermées pour le moment{restaurant.contact.phone ? ` : appelez-nous au ${restaurant.contact.phone}` : ""}.</p>
          )}
        </div>
      </div>
    </RestaurantShell>
  );
}
