import "server-only";
import { isModuleEnabled, withTenant } from "@yamacommerce/database";

/**
 * Garde d'activation du module « catalogue » — voir docs/11-secteurs-et-modules.md.
 * PREMIÈRE utilisation réelle de `isModuleEnabled` dans apps/web (jusqu'ici
 * seulement consommé par packages/database/src/seed.ts). Le catalogue est un module
 * ACTIVABLE, jamais une obligation pour tous les secteurs (immobilier/voyage gardent
 * leurs propres modèles "listings", non concernés ici) — voir la revue du 18
 * septembre 2026 : « Le catalogue est un module métier activable, pas une
 * obligation pour tous les secteurs. »
 *
 * Vérifie TOUJOURS via `TenantModule` (donc `sectorKey`), JAMAIS via
 * `Tenant.businessType` — ce dernier est un champ hérité conservé seulement pour
 * l'affichage (voir le commentaire sur `Tenant.businessType` dans schema.prisma).
 */
export async function isCatalogModuleEnabled(tenantId: string): Promise<boolean> {
  return withTenant(tenantId, (tx) => isModuleEnabled(tx, tenantId, "catalog"));
}
