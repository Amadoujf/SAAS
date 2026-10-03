import type { Metadata } from "next";
import { withTenant, getCourierSettings, listDeliveryZones, SENEGAL_REGIONS } from "@yamacommerce/database";
import { requireCourierPage } from "@/lib/courier/guard";
import { PageHeader, Panel, PanelHeader } from "@/components/yc/panel";
import { CourierSettingsForm, ZoneEditor } from "@/components/dashboard-courier/courier-panels";

export const metadata: Metadata = { title: "Zones et règles — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Zones tarifaires et règles (suppléments de format, plafond d'encaissement, tentatives). */
export default async function RatesPage() {
  const membership = await requireCourierPage("delivery.manage_zones");
  const tenantId = membership.tenantId;
  const data = await withTenant(tenantId, async (tx) => ({ zones: await listDeliveryZones(tx, tenantId), settings: await getCourierSettings(tx, tenantId) }));
  return (
    <>
      <PageHeader eyebrow="Gestion" title="Zones et règles" description="Le tarif d'une course = tarif de la zone + supplément de format. Il est toujours calculé par le serveur, sur le site comme au bureau." />
      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <Panel className="p-5"><PanelHeader title="Zones tarifaires" /><ZoneEditor zones={data.zones.map((z) => ({ id: z.id, name: z.name, region: z.region, commune: z.commune, fee: z.fee, estimatedDays: z.estimatedDays, isActive: z.isActive }))} regions={[...SENEGAL_REGIONS]} /></Panel>
        <Panel className="p-5"><PanelHeader title="Règles" /><CourierSettingsForm initial={data.settings} /></Panel>
      </div>
    </>
  );
}
