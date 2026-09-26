import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isValidSenegalRegion } from "@yamacommerce/database";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import {
  addDeliverer,
  removeDeliveryZone,
  saveCommerceSettings,
  saveDeliveryZone,
  saveManualPaymentMethod,
  toggleDeliverer,
} from "@/lib/orders/settings-pipeline";

const money = z.number().int().min(0).max(10_000_000);
const zone = z.object({
  name: z.string().max(80).nullable().optional(),
  region: z.string().refine(isValidSenegalRegion, "Région invalide."),
  commune: z.string().max(80).nullable().optional(),
  fee: money,
  freeThreshold: money.nullable().optional(),
  bulkySurcharge: money.optional(),
  estimatedDays: z.number().int().min(0).max(60).nullable().optional(),
  isActive: z.boolean().optional(),
  excludedCategoryIds: z.array(z.string()).max(50).optional(),
});

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("zone.save"), zoneId: z.string().nullable(), zone }),
  z.object({ action: z.literal("zone.delete"), zoneId: z.string() }),
  z.object({
    action: z.literal("settings.save"),
    settings: z.object({
      pickupEnabled: z.boolean().optional(),
      pickupAddress: z.string().max(200).nullable().optional(),
      pickupInstructions: z.string().max(500).nullable().optional(),
      deliveryInstructions: z.string().max(500).nullable().optional(),
      guestCheckoutEnabled: z.boolean().optional(),
      manualPaymentWindowHours: z.number().int().min(1).max(168).optional(),
    }),
  }),
  z.object({ action: z.literal("deliverer.add"), phone: z.string().max(20), vehicleType: z.string().max(60).nullable() }),
  z.object({ action: z.literal("deliverer.toggle"), delivererId: z.string(), isActive: z.boolean() }),
  z.object({
    action: z.literal("payment.save"),
    provider: z.enum(["wave_direct", "orange_money_direct", "cod"]),
    isEnabled: z.boolean(),
    accountNumber: z.string().max(20).nullable().optional(),
    accountHolderName: z.string().max(80).nullable().optional(),
    publicInstructions: z.string().max(400).nullable().optional(),
  }),
]);

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide." }, { status: 400 });
  const b = parsed.data;
  const result =
    b.action === "zone.save" ? await saveDeliveryZone(b.zoneId, b.zone)
    : b.action === "zone.delete" ? await removeDeliveryZone(b.zoneId)
    : b.action === "settings.save" ? await saveCommerceSettings(b.settings)
    : b.action === "deliverer.add" ? await addDeliverer(b.phone, b.vehicleType)
    : b.action === "deliverer.toggle" ? await toggleDeliverer(b.delivererId, b.isActive)
    : await saveManualPaymentMethod(b.provider, b);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ data: result.data });
}
