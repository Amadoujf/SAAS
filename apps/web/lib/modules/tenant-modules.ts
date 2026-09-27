import "server-only";
import { withTenant, getEnabledModules } from "@yamacommerce/database";

/** Modules actifs de l'entreprise (selon son secteur et sa formule) : le dashboard
 *  n'affiche que les sections dont le module est activé. */
export async function getTenantModuleKeys(tenantId: string): Promise<Set<string>> {
  const modules = await withTenant(tenantId, (tx) => getEnabledModules(tx, tenantId));
  return new Set(modules.map((m) => m.moduleKey));
}

/** Immobilier : les biens (module "listings") avec au moins un module propre au secteur. */
export function isRealEstate(modules: Set<string>) {
  return modules.has("listings") && (modules.has("leases") || modules.has("visit_requests"));
}

/** Voyage : les voyages (module "listings") et le calendrier des départs. */
export function isTravel(modules: Set<string>) {
  return modules.has("listings") && modules.has("departures");
}

/** Salon / prestataire : carte des prestations et rendez-vous. */
export function isSalon(modules: Set<string>) {
  return modules.has("service_catalog") && modules.has("appointments");
}

/** Hôtel / location : types de chambres et calendrier de disponibilité. */
export function isHotel(modules: Set<string>) {
  return modules.has("listings") && modules.has("availability_calendar");
}
