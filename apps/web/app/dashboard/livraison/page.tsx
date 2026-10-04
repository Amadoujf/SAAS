import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { withTenant, listDeliveryZones, getCommerceSettings, listDeliverers, listCategories, SENEGAL_REGIONS } from "@yamacommerce/database";
import { resolveDashboardTenant } from "@/lib/orders/dashboard-pipeline";
import { PageHeader, Panel, PanelHeader } from "@/components/yc/panel";
import { DeliverersManager, StoreSettingsForm, ZonesManager } from "@/components/dashboard-settings/delivery-settings";

export const metadata: Metadata = { title: "Livraison — Y-COM", robots: { index: false, follow: false } };

export default async function DeliverySettingsPage() {
  const ctx = await resolveDashboardTenant("delivery.view");
  if (!ctx) redirect("/dashboard");
  const { zones, settings, deliverers, categories } = await withTenant(ctx.tenantId, async (tx) => ({
    zones: await listDeliveryZones(tx, ctx.tenantId),
    settings: await getCommerceSettings(tx, ctx.tenantId),
    deliverers: await listDeliverers(tx, ctx.tenantId),
    categories: await listCategories(tx, ctx.tenantId),
  }));

  return (
    <>
      <PageHeader eyebrow="Ventes" title="Livraison & retrait" description="Vos zones, tarifs et délais. Le prix de livraison est toujours recalculé côté serveur : le navigateur ne peut jamais l'imposer." />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Panel>
          <PanelHeader title="Zones de livraison" description="Une zone utilisée par des commandes est désactivée plutôt que supprimée." />
          <ZonesManager
            zones={zones.map((z) => ({ id: z.id, name: z.name, region: z.region, commune: z.commune, fee: z.fee, freeThreshold: z.freeThreshold, bulkySurcharge: z.bulkySurcharge, estimatedDays: z.estimatedDays, isActive: z.isActive, excludedCategoryIds: z.excludedCategoryIds }))}
            regions={[...SENEGAL_REGIONS]}
            categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          />
        </Panel>
        <div className="flex flex-col gap-5">
          <Panel>
            <PanelHeader title="Réglages de vente" />
            <StoreSettingsForm initial={settings} />
          </Panel>
          <Panel>
            <PanelHeader title="Livreurs" description="Affectez-les depuis le détail d'une commande." />
            <DeliverersManager deliverers={deliverers.map((d) => ({ id: d.id, phone: d.phone, vehicleType: d.vehicleType, isActive: d.isActive }))} />
          </Panel>
        </div>
      </div>
    </>
  );
}
