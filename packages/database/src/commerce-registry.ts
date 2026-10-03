import type { CommerceSettings, DeliveryZone, Prisma } from "@prisma/client";
import { isValidSenegalRegion } from "./senegal-reference";

/**
 * Réglages de vente et zones de livraison d'un tenant — parcours e-commerce
 * opérationnel (1er octobre 2026). Le calcul des frais de livraison vit ICI et nulle
 * part ailleurs : `convertCartToOrder` (création réelle de la commande) et
 * `quoteDeliveryForCart` (affichage des options au checkout) appellent la même
 * fonction `computeZoneShipping`, pour qu'un client ne voie jamais un tarif différent
 * de celui qui sera réellement facturé. Le navigateur ne transmet jamais un montant :
 * uniquement l'identifiant de la zone choisie.
 */

export const DEFAULT_COMMERCE_SETTINGS: Omit<CommerceSettings, "id" | "tenantId" | "updatedAt"> = {
  pickupEnabled: true,
  pickupAddress: null,
  pickupInstructions: null,
  deliveryInstructions: null,
  guestCheckoutEnabled: true,
  manualPaymentWindowHours: 24,
};

export type EffectiveCommerceSettings = typeof DEFAULT_COMMERCE_SETTINGS;

export async function getCommerceSettings(tx: Prisma.TransactionClient, tenantId: string): Promise<EffectiveCommerceSettings> {
  const row = await tx.commerceSettings.findUnique({ where: { tenantId } });
  if (!row) return { ...DEFAULT_COMMERCE_SETTINGS };
  return {
    pickupEnabled: row.pickupEnabled,
    pickupAddress: row.pickupAddress,
    pickupInstructions: row.pickupInstructions,
    deliveryInstructions: row.deliveryInstructions,
    guestCheckoutEnabled: row.guestCheckoutEnabled,
    manualPaymentWindowHours: row.manualPaymentWindowHours,
  };
}

export async function updateCommerceSettings(
  tx: Prisma.TransactionClient,
  tenantId: string,
  input: Partial<EffectiveCommerceSettings>,
) {
  if (input.manualPaymentWindowHours !== undefined) {
    const hours = input.manualPaymentWindowHours;
    if (!Number.isInteger(hours) || hours < 1 || hours > 168) {
      throw new Error("La fenêtre de paiement manuel doit être comprise entre 1 et 168 heures.");
    }
  }
  return tx.commerceSettings.upsert({
    where: { tenantId },
    create: { tenantId, ...DEFAULT_COMMERCE_SETTINGS, ...input },
    update: input,
  });
}

export interface DeliveryZoneInput {
  name?: string | null;
  region: string;
  department?: string | null;
  commune?: string | null;
  neighborhood?: string | null;
  fee: number;
  freeThreshold?: number | null;
  bulkySurcharge?: number;
  estimatedDays?: number | null;
  isActive?: boolean;
  excludedCategoryIds?: string[];
}

function assertZoneInput(input: Partial<DeliveryZoneInput>) {
  if (input.region !== undefined && !isValidSenegalRegion(input.region)) {
    throw new Error(`Région "${input.region}" invalide.`);
  }
  for (const [key, value] of [
    ["fee", input.fee],
    ["freeThreshold", input.freeThreshold],
    ["bulkySurcharge", input.bulkySurcharge],
    ["estimatedDays", input.estimatedDays],
  ] as const) {
    if (value !== undefined && value !== null && (!Number.isInteger(value) || value < 0)) {
      throw new Error(`Valeur "${key}" invalide : un entier positif ou nul est attendu.`);
    }
  }
}

async function assertCategoriesBelongToTenant(tx: Prisma.TransactionClient, tenantId: string, ids: string[] | undefined) {
  if (!ids || ids.length === 0) return;
  const found = await tx.category.count({ where: { tenantId, id: { in: ids } } });
  if (found !== new Set(ids).size) throw new Error("Une des catégories exclues n'appartient pas à cette entreprise.");
}

export async function listDeliveryZones(tx: Prisma.TransactionClient, tenantId: string, options: { activeOnly?: boolean } = {}) {
  return tx.deliveryZone.findMany({
    where: { tenantId, ...(options.activeOnly ? { isActive: true } : {}) },
    orderBy: [{ region: "asc" }, { fee: "asc" }],
  });
}

export async function createDeliveryZone(tx: Prisma.TransactionClient, tenantId: string, input: DeliveryZoneInput) {
  assertZoneInput(input);
  await assertCategoriesBelongToTenant(tx, tenantId, input.excludedCategoryIds);
  return tx.deliveryZone.create({
    data: {
      tenantId,
      name: input.name ?? null,
      region: input.region,
      department: input.department ?? null,
      commune: input.commune ?? null,
      neighborhood: input.neighborhood ?? null,
      fee: input.fee,
      freeThreshold: input.freeThreshold ?? null,
      bulkySurcharge: input.bulkySurcharge ?? 0,
      estimatedDays: input.estimatedDays ?? null,
      isActive: input.isActive ?? true,
      excludedCategoryIds: input.excludedCategoryIds ?? [],
    },
  });
}

export async function updateDeliveryZone(
  tx: Prisma.TransactionClient,
  tenantId: string,
  zoneId: string,
  input: Partial<DeliveryZoneInput>,
) {
  assertZoneInput(input);
  await assertCategoriesBelongToTenant(tx, tenantId, input.excludedCategoryIds);
  const { count } = await tx.deliveryZone.updateMany({ where: { id: zoneId, tenantId }, data: input });
  if (count === 0) throw new Error("Zone de livraison introuvable pour cette entreprise.");
  return tx.deliveryZone.findFirstOrThrow({ where: { id: zoneId, tenantId } });
}

/** Une zone déjà référencée par des commandes n'est jamais supprimée physiquement
 *  (l'historique doit rester lisible) : elle est désactivée. */
export async function deleteDeliveryZone(tx: Prisma.TransactionClient, tenantId: string, zoneId: string) {
  const used = await tx.order.count({ where: { tenantId, deliveryZoneId: zoneId } });
  if (used > 0) {
    await tx.deliveryZone.updateMany({ where: { id: zoneId, tenantId }, data: { isActive: false } });
    return { deleted: false, deactivated: true };
  }
  const { count } = await tx.deliveryZone.deleteMany({ where: { id: zoneId, tenantId } });
  if (count === 0) throw new Error("Zone de livraison introuvable pour cette entreprise.");
  return { deleted: true, deactivated: false };
}

export function describeDeliveryZone(zone: Pick<DeliveryZone, "name" | "region" | "commune" | "neighborhood">): string {
  if (zone.name) return zone.name;
  return [zone.neighborhood, zone.commune, zone.region].filter(Boolean).join(", ");
}

/** Résumé du panier nécessaire au calcul de livraison — toujours issu de la base. */
export interface ShippingCartSummary {
  subtotal: number;
  hasBulky: boolean;
  hasNonDeliverable: boolean;
  categoryIds: string[];
}

export type ZoneShippingResult =
  | { available: true; fee: number; freeShippingApplied: boolean; bulkySurchargeApplied: boolean }
  | { available: false; reason: "inactive" | "non_deliverable_item" | "excluded_category" };

/** SEULE fonction de calcul des frais de livraison d'une zone. */
export function computeZoneShipping(zone: DeliveryZone, cart: ShippingCartSummary): ZoneShippingResult {
  if (!zone.isActive) return { available: false, reason: "inactive" };
  if (cart.hasNonDeliverable) return { available: false, reason: "non_deliverable_item" };
  if (zone.excludedCategoryIds.some((id) => cart.categoryIds.includes(id))) {
    return { available: false, reason: "excluded_category" };
  }
  const freeShippingApplied = zone.freeThreshold !== null && cart.subtotal >= zone.freeThreshold;
  let fee = freeShippingApplied ? 0 : zone.fee;
  const bulkySurchargeApplied = cart.hasBulky && zone.bulkySurcharge > 0;
  if (bulkySurchargeApplied) fee += zone.bulkySurcharge;
  return { available: true, fee, freeShippingApplied, bulkySurchargeApplied };
}

export async function summarizeCartForShipping(
  tx: Prisma.TransactionClient,
  tenantId: string,
  cartId: string,
): Promise<ShippingCartSummary & { lineCount: number }> {
  const items = await tx.cartItem.findMany({
    where: { cartId, tenantId },
    include: { variant: { include: { product: true } } },
  });
  const purchasable = items.filter((i) => i.variant.product.status === "PUBLISHED" && !i.variant.product.deletedAt);
  return {
    subtotal: purchasable.reduce((sum, i) => sum + i.variant.price * i.quantity, 0),
    hasBulky: purchasable.some((i) => i.variant.product.isBulky),
    hasNonDeliverable: purchasable.some((i) => !i.variant.product.isDeliverable),
    categoryIds: [...new Set(purchasable.map((i) => i.variant.product.categoryId).filter((id): id is string => !!id))],
    lineCount: purchasable.length,
  };
}

export interface DeliveryQuoteZone {
  id: string;
  label: string;
  region: string;
  commune: string | null;
  estimatedDays: number | null;
  freeThreshold: number | null;
  fee: number | null;
  available: boolean;
  unavailableReason: string | null;
  freeShippingApplied: boolean;
}

export interface DeliveryQuote {
  subtotal: number;
  pickup: { enabled: boolean; address: string | null; instructions: string | null };
  deliveryAllowed: boolean;
  deliveryBlockedReason: string | null;
  deliveryInstructions: string | null;
  zones: DeliveryQuoteZone[];
}

const UNAVAILABLE_LABELS: Record<string, string> = {
  inactive: "Zone indisponible",
  non_deliverable_item: "Un article est disponible uniquement en retrait",
  excluded_category: "Un article de votre panier n'est pas livré dans cette zone",
};

/** Options de livraison affichées au checkout — mêmes règles que la commande réelle. */
export async function quoteDeliveryForCart(
  tx: Prisma.TransactionClient,
  tenantId: string,
  cartId: string,
  region?: string | null,
): Promise<DeliveryQuote> {
  const [settings, summary, zones] = await Promise.all([
    getCommerceSettings(tx, tenantId),
    summarizeCartForShipping(tx, tenantId, cartId),
    listDeliveryZones(tx, tenantId, { activeOnly: true }),
  ]);
  const filtered = region ? zones.filter((z) => z.region === region) : zones;
  return {
    subtotal: summary.subtotal,
    pickup: { enabled: settings.pickupEnabled, address: settings.pickupAddress, instructions: settings.pickupInstructions },
    deliveryAllowed: !summary.hasNonDeliverable,
    deliveryBlockedReason: summary.hasNonDeliverable ? UNAVAILABLE_LABELS.non_deliverable_item! : null,
    deliveryInstructions: settings.deliveryInstructions,
    zones: filtered.map((zone) => {
      const result = computeZoneShipping(zone, summary);
      return {
        id: zone.id,
        label: describeDeliveryZone(zone),
        region: zone.region,
        commune: zone.commune,
        estimatedDays: zone.estimatedDays,
        freeThreshold: zone.freeThreshold,
        fee: result.available ? result.fee : null,
        available: result.available,
        unavailableReason: result.available ? null : UNAVAILABLE_LABELS[result.reason]!,
        freeShippingApplied: result.available && result.freeShippingApplied,
      };
    }),
  };
}
