import "server-only";
import { isModuleEnabled, withTenant } from "@yamacommerce/database";

/**
 * Garde d'activation pour panier/checkout/commandes — étape 2 (clients/panier/
 * commandes/livraison, 19 septembre 2026). Panier et commandes référencent
 * `ProductVariant` : ils réutilisent donc le module `"catalog"` déjà scopé aux
 * secteurs ecommerce/fashion/restaurant (voir `packages/database/src/seed.ts`,
 * `MODULES`) — aucun nouveau module `"orders"` n'existe dans le registre (ce mot
 * n'apparaît que dans les tableaux marketing `Plan.features`, jamais comme
 * `Module.key`). Même raisonnement que `require-catalog-module.ts`.
 */
export async function isOrdersModuleEnabled(tenantId: string): Promise<boolean> {
  return withTenant(tenantId, (tx) => isModuleEnabled(tx, tenantId, "catalog"));
}
