import "server-only";
import { withTenant, listDeliveryZones } from "@yamacommerce/database";
import { zoneLabel } from "./labels";

/** Zones actives de la société : ce que le site public propose (tarif de base affiché). */
export async function loadZones(tenantId: string) {
  const zones = await withTenant(tenantId, (tx) => listDeliveryZones(tx, tenantId, { activeOnly: true }));
  return zones.map((z) => ({ id: z.id, label: zoneLabel(z), region: z.region, fee: z.fee, estimatedDays: z.estimatedDays }));
}
export type PublicZone = Awaited<ReturnType<typeof loadZones>>[number];
