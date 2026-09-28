import type { Metadata } from "next";
import { resolveRestaurant } from "@/lib/restaurant/restaurant-context";
import { loadMenu, loadService } from "@/lib/restaurant/restaurant-data";
import { RestaurantShell } from "@/components/restaurant/restaurant-shell";
import { MenuOrder } from "@/components/restaurant/menu-order";
import { ServicePill } from "@/components/restaurant/service-pill";
import { PublicSiteSuspended } from "@/components/public-site-suspended";
import { PublicSiteBillingSuspended } from "@/components/public-site-billing-suspended";

export async function generateMetadata(): Promise<Metadata> {
  const r = await resolveRestaurant("/carte");
  return r.status === "ok" ? { title: `La carte — ${r.restaurant.tenantName}` } : {};
}
export const dynamic = "force-dynamic";

/** Carte et commande à emporter / en livraison. */
export default async function MenuPage() {
  const r = await resolveRestaurant("/carte");
  if (r.status === "suspended") return <PublicSiteSuspended tenantName={r.tenantName} />;
  if (r.status === "billing_suspended") return <PublicSiteBillingSuspended tenantName={r.tenantName} />;
  const { restaurant } = r;
  const [sections, service] = await Promise.all([loadMenu(restaurant.tenantId), loadService(restaurant.tenantId)]);
  const modes = [restaurant.rules.acceptTakeaway && "à emporter", restaurant.rules.acceptDelivery && "en livraison"].filter(Boolean).join(" ou ");
  return (
    <RestaurantShell restaurant={restaurant} open={service.open} bare>
      <div className="bg-[var(--color-primary)] text-white">
        <div className="mx-auto max-w-[var(--content-max-width,1240px)] px-4 pb-8 pt-10 sm:px-8">
          <ServicePill service={service} dark />
          <h1 className="mt-4 font-[family-name:var(--font-heading)] text-[52px] uppercase leading-[0.9] tracking-[-0.02em] sm:text-[80px]">La carte</h1>
          <p className="mt-3 max-w-xl text-[16px] text-white/70">{modes ? `Commandez ${modes} : prêt en ${restaurant.rules.prepMinutes} min environ. Vous réglez au retrait ou à la livraison.` : "Consultez nos plats."}</p>
        </div>
      </div>
      {sections.length === 0 ? (
        <p className="mx-auto max-w-[var(--content-max-width,1240px)] px-4 py-16 text-[16px] text-[var(--color-text-secondary)] sm:px-8">La carte arrive bientôt.</p>
      ) : (
        <MenuOrder storageKey={`resto-panier:${restaurant.tenantId}`} sections={sections} service={service} rules={restaurant.rules} table={null} payWays={restaurant.payWays} />
      )}
    </RestaurantShell>
  );
}
