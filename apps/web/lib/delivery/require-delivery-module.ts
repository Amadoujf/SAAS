import "server-only";
import { isModuleEnabled, withTenant } from "@yamacommerce/database";

/**
 * Garde d'activation pour zones de livraison ET roster de livreurs/assignation —
 * étape 2. Réutilise `"delivery_zones"`, déjà scopé à
 * `["ecommerce", "fashion", "restaurant", "delivery"]` (voir `seed.ts`, `MODULES`) —
 * les modules `"dispatch"`/`"deliverer_tracking"` sont scopés `["delivery"]`
 * SEULEMENT (le secteur "société de courses" pur) : un tenant ecommerce/fashion/
 * restaurant n'y aurait jamais accès, alors qu'il doit pouvoir gérer ses propres
 * livreurs internes. `Deliverer`/`Delivery` n'ont aucune restriction de secteur dans
 * le schéma — ce choix de gate est purement applicatif, pas une contrainte DB.
 */
export async function isDeliveryModuleEnabled(tenantId: string): Promise<boolean> {
  return withTenant(tenantId, (tx) => isModuleEnabled(tx, tenantId, "delivery_zones"));
}
