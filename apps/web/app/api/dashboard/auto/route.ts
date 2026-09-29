import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import {
  cancelSaleFile,
  deliver,
  deskLead,
  deskTestDrive,
  importStage,
  leadNote,
  leadStatus,
  newImport,
  newSale,
  removeVehicle,
  salePayment,
  saveShowroomSettings,
  saveVehicle,
  setArrival,
  setVehiclePublished,
  testDriveOutcome,
  voidPayment,
} from "@/lib/auto/pipeline";

const id = z.string().uuid();
const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save_vehicle"), listingId: id.nullable(), vehicle: z.unknown() }),
  z.object({ action: z.literal("publish"), listingId: id, publish: z.boolean() }),
  z.object({ action: z.literal("arrival"), listingId: id, stockStatus: z.enum(["incoming", "available"]) }),
  z.object({ action: z.literal("delete_vehicle"), listingId: id }),
  z.object({ action: z.literal("settings"), settings: z.unknown() }),
  z.object({ action: z.literal("desk_drive"), drive: z.unknown() }),
  z.object({ action: z.literal("drive_outcome"), reservationId: id, outcome: z.enum(["done", "no_show", "canceled"]), note: z.string().max(300).optional() }),
  z.object({ action: z.literal("desk_lead"), lead: z.unknown() }),
  z.object({ action: z.literal("lead_status"), leadId: id, to: z.string().max(20), note: z.string().max(300).optional() }),
  z.object({ action: z.literal("lead_note"), leadId: id, body: z.string().max(800), nextActionAt: z.string().max(10).nullable().optional() }),
  z.object({ action: z.literal("open_sale"), sale: z.unknown() }),
  z.object({ action: z.literal("payment"), payment: z.unknown() }),
  z.object({ action: z.literal("void_payment"), paymentId: id, reason: z.string().max(300) }),
  z.object({ action: z.literal("deliver"), reservationId: id }),
  z.object({ action: z.literal("cancel_sale"), reservationId: id, reason: z.string().max(300) }),
  z.object({ action: z.literal("new_import"), import: z.unknown() }),
  z.object({ action: z.literal("import_stage"), importId: id, to: z.string().max(20), eta: z.string().max(10).nullable().optional(), note: z.string().max(300).optional() }),
]);

/** Actions de la concession — permission vérifiée par action dans le pipeline. */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const b = parsed.data;
  const result =
    b.action === "save_vehicle" ? await saveVehicle(b.listingId, b.vehicle)
    : b.action === "publish" ? await setVehiclePublished(b.listingId, b.publish)
    : b.action === "arrival" ? await setArrival(b.listingId, b.stockStatus)
    : b.action === "delete_vehicle" ? await removeVehicle(b.listingId)
    : b.action === "settings" ? await saveShowroomSettings(b.settings)
    : b.action === "desk_drive" ? await deskTestDrive(b.drive)
    : b.action === "drive_outcome" ? await testDriveOutcome(b.reservationId, b.outcome, b.note)
    : b.action === "desk_lead" ? await deskLead(b.lead)
    : b.action === "lead_status" ? await leadStatus(b.leadId, b.to, b.note)
    : b.action === "lead_note" ? await leadNote(b.leadId, b.body, b.nextActionAt)
    : b.action === "open_sale" ? await newSale(b.sale)
    : b.action === "payment" ? await salePayment(b.payment)
    : b.action === "void_payment" ? await voidPayment(b.paymentId, b.reason)
    : b.action === "deliver" ? await deliver(b.reservationId)
    : b.action === "cancel_sale" ? await cancelSaleFile(b.reservationId, b.reason)
    : b.action === "new_import" ? await newImport(b.import)
    : await importStage(b.importId, b.to, { eta: b.eta, note: b.note ?? null });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ data: result.data });
}
