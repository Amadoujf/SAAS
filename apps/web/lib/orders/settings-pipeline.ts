import "server-only";
import {
  withTenant,
  createDeliveryZone,
  updateDeliveryZone,
  deleteDeliveryZone,
  updateCommerceSettings,
  createDeliverer,
  setDelivererActive,
  normalizeSenegalPhone,
  type DeliveryZoneInput,
  type EffectiveCommerceSettings,
} from "@yamacommerce/database";
import { resolveDashboardTenant, type DashboardActionResult } from "./dashboard-pipeline";

/** Réglages de vente (livraison, retrait, livreurs, moyens de paiement manuels) —
 *  permissions dédiées (`delivery.manage_zones`, `payments.configure`). */

function fail(error: unknown): { ok: false; status: number; error: string } {
  return { ok: false, status: 400, error: error instanceof Error ? error.message : "Erreur inattendue." };
}

export async function saveDeliveryZone(zoneId: string | null, input: DeliveryZoneInput): Promise<DashboardActionResult> {
  const ctx = await resolveDashboardTenant("delivery.manage_zones");
  if (!ctx) return { ok: false, status: 403, error: "Action non autorisée." };
  try {
    const zone = await withTenant(ctx.tenantId, (tx) =>
      zoneId ? updateDeliveryZone(tx, ctx.tenantId, zoneId, input) : createDeliveryZone(tx, ctx.tenantId, input),
    );
    return { ok: true, data: zone };
  } catch (error) {
    return fail(error);
  }
}

export async function removeDeliveryZone(zoneId: string): Promise<DashboardActionResult> {
  const ctx = await resolveDashboardTenant("delivery.manage_zones");
  if (!ctx) return { ok: false, status: 403, error: "Action non autorisée." };
  try {
    return { ok: true, data: await withTenant(ctx.tenantId, (tx) => deleteDeliveryZone(tx, ctx.tenantId, zoneId)) };
  } catch (error) {
    return fail(error);
  }
}

export async function saveCommerceSettings(input: Partial<EffectiveCommerceSettings>): Promise<DashboardActionResult> {
  const ctx = await resolveDashboardTenant("delivery.manage_zones");
  if (!ctx) return { ok: false, status: 403, error: "Action non autorisée." };
  try {
    await withTenant(ctx.tenantId, (tx) => updateCommerceSettings(tx, ctx.tenantId, input));
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}

export async function addDeliverer(phone: string, vehicleType: string | null): Promise<DashboardActionResult> {
  const ctx = await resolveDashboardTenant("delivery.assign");
  if (!ctx) return { ok: false, status: 403, error: "Action non autorisée." };
  try {
    return { ok: true, data: await withTenant(ctx.tenantId, (tx) => createDeliverer(tx, ctx.tenantId, { phone, vehicleType })) };
  } catch (error) {
    return fail(error);
  }
}

export async function toggleDeliverer(delivererId: string, isActive: boolean): Promise<DashboardActionResult> {
  const ctx = await resolveDashboardTenant("delivery.assign");
  if (!ctx) return { ok: false, status: 403, error: "Action non autorisée." };
  try {
    await withTenant(ctx.tenantId, (tx) => setDelivererActive(tx, ctx.tenantId, delivererId, isActive));
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}

export type ManualProvider = "wave_direct" | "orange_money_direct";

export async function saveManualPaymentMethod(
  provider: ManualProvider | "cod",
  input: { isEnabled: boolean; accountNumber?: string | null; accountHolderName?: string | null; publicInstructions?: string | null },
): Promise<DashboardActionResult> {
  const ctx = await resolveDashboardTenant("payments.configure");
  if (!ctx) return { ok: false, status: 403, error: "Action non autorisée." };
  let accountNumber: string | null = null;
  if (provider !== "cod") {
    accountNumber = input.accountNumber ? normalizeSenegalPhone(input.accountNumber) : null;
    if (input.isEnabled && !accountNumber) {
      return { ok: false, status: 400, error: "Indiquez un numéro sénégalais valide pour recevoir les transferts." };
    }
  }
  try {
    await withTenant(ctx.tenantId, (tx) =>
      tx.paymentProviderConfig.upsert({
        where: { tenantId_provider: { tenantId: ctx.tenantId, provider } },
        create: {
          tenantId: ctx.tenantId,
          provider,
          isEnabled: input.isEnabled,
          mode: "live",
          label: provider === "wave_direct" ? "Wave" : provider === "orange_money_direct" ? "Orange Money" : "Paiement à la livraison",
          accountNumber,
          accountHolderName: input.accountHolderName ?? null,
          publicInstructions: input.publicInstructions ?? null,
        },
        update: {
          isEnabled: input.isEnabled,
          ...(provider !== "cod" ? { accountNumber, accountHolderName: input.accountHolderName ?? null, publicInstructions: input.publicInstructions ?? null } : {}),
        },
      }),
    );
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}
