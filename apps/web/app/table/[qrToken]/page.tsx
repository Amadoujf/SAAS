import type { Metadata } from "next";
import { resolveRestaurant } from "@/lib/restaurant/restaurant-context";
import { loadMenu, loadService } from "@/lib/restaurant/restaurant-data";
import { tableForQr } from "@/lib/restaurant/public-pipeline";
import { RestaurantShell } from "@/components/restaurant/restaurant-shell";
import { MenuOrder } from "@/components/restaurant/menu-order";
import { PublicSiteSuspended } from "@/components/public-site-suspended";
import { PublicSiteBillingSuspended } from "@/components/public-site-billing-suspended";

export const metadata: Metadata = { title: "Commander à table", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Carte ouverte par le QR code posé sur une table : la commande part en cuisine pour CETTE table. */
export default async function TableOrderPage({ params }: { params: { qrToken: string } }) {
  const r = await resolveRestaurant(`/table/${params.qrToken}`);
  if (r.status === "suspended") return <PublicSiteSuspended tenantName={r.tenantName} />;
  if (r.status === "billing_suspended") return <PublicSiteBillingSuspended tenantName={r.tenantName} />;
  const { restaurant } = r;
  const [table, sections, service] = await Promise.all([tableForQr(restaurant.tenantId, params.qrToken), loadMenu(restaurant.tenantId), loadService(restaurant.tenantId)]);
  return (
    <RestaurantShell restaurant={restaurant} open={service.open} bare>
      <div className="bg-[var(--color-accent-primary)] text-[var(--color-primary)]">
        <div className="mx-auto flex max-w-[var(--content-max-width,1240px)] flex-wrap items-end justify-between gap-4 px-4 pb-7 pt-8 sm:px-8">
          <div>
            <p className="text-[13px] font-bold uppercase tracking-[0.16em]">Bienvenue chez {restaurant.tenantName}</p>
            <h1 className="mt-2 font-[family-name:var(--font-heading)] text-[56px] uppercase leading-[0.9] tracking-[-0.02em] sm:text-[80px]">{table ? `Table ${table.label}` : "QR code inconnu"}</h1>
          </div>
          <p className="max-w-sm text-[15px] font-medium">{table ? (service.open ? "Choisissez vos plats : la commande part directement en cuisine. Vous réglez à table." : "Le restaurant est fermé pour le moment.") : "Ce QR code n'est plus valable : demandez au personnel de vous servir ou scannez celui posé sur votre table."}</p>
        </div>
      </div>
      {table && sections.length > 0 && (
        <MenuOrder storageKey={`resto-panier:${restaurant.tenantId}:table:${table.qrToken}`} sections={sections} service={{ ...service, pickup: [] }} rules={restaurant.rules} table={{ label: table.label, qrToken: table.qrToken }} payWays={restaurant.payWays} />
      )}
    </RestaurantShell>
  );
}
