import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import {
  addRate,
  changeHousekeeping,
  changeRoomTypeStatus,
  createDeskStay,
  createRoom,
  deleteRate,
  editRoom,
  modifyStay,
  recordStayPayment,
  removeRoomType,
  saveHotelSettings,
  saveRoomType,
  stayAction,
  voidStayPayment,
} from "@/lib/hotel/pipeline";

const id = z.string().uuid();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save_room_type"), listingId: id.nullable(), roomType: z.unknown() }),
  z.object({ action: z.literal("room_type_status"), listingId: id, status: z.enum(["draft", "published", "unavailable", "archived"]) }),
  z.object({ action: z.literal("delete_room_type"), listingId: id }),
  z.object({ action: z.literal("add_room"), listingId: id, number: z.string().max(20), floor: z.string().max(40).nullable() }),
  z.object({ action: z.literal("edit_room"), roomId: id, number: z.string().max(20).optional(), floor: z.string().max(40).nullable().optional(), isActive: z.boolean().optional(), listingId: id.optional() }),
  z.object({ action: z.literal("housekeeping"), roomId: id, status: z.string().max(20), note: z.string().max(200).nullable().optional() }),
  z.object({ action: z.literal("add_rate"), rate: z.unknown() }),
  z.object({ action: z.literal("delete_rate"), rateId: id }),
  z.object({ action: z.literal("save_settings"), settings: z.unknown() }),
  z.object({ action: z.literal("book"), stay: z.unknown() }),
  z.object({ action: z.literal("stay"), reservationId: id, do: z.enum(["confirm", "check_in", "check_out", "no_show", "cancel"]), note: z.string().max(300).optional() }),
  z.object({ action: z.literal("modify"), reservationId: id, roomId: id.optional(), arrival: day.optional(), departure: day.optional() }),
  z.object({ action: z.literal("payment"), payment: z.unknown() }),
  z.object({ action: z.literal("void_payment"), paymentId: id, reason: z.string().max(300) }),
]);

/** Actions hôtel du tableau de bord — permission vérifiée par action dans le pipeline. */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const b = parsed.data;
  const result =
    b.action === "save_room_type" ? await saveRoomType(b.listingId, b.roomType)
    : b.action === "room_type_status" ? await changeRoomTypeStatus(b.listingId, b.status)
    : b.action === "delete_room_type" ? await removeRoomType(b.listingId)
    : b.action === "add_room" ? await createRoom(b.listingId, b.number, b.floor)
    : b.action === "edit_room" ? await editRoom(b.roomId, { number: b.number, floor: b.floor, isActive: b.isActive, listingId: b.listingId })
    : b.action === "housekeeping" ? await changeHousekeeping(b.roomId, b.status, b.note)
    : b.action === "add_rate" ? await addRate(b.rate)
    : b.action === "delete_rate" ? await deleteRate(b.rateId)
    : b.action === "save_settings" ? await saveHotelSettings(b.settings)
    : b.action === "book" ? await createDeskStay(b.stay)
    : b.action === "stay" ? await stayAction(b.reservationId, b.do, b.note)
    : b.action === "modify" ? await modifyStay(b.reservationId, { roomId: b.roomId, arrival: b.arrival, departure: b.departure })
    : b.action === "payment" ? await recordStayPayment(b.payment)
    : await voidStayPayment(b.paymentId, b.reason);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ data: result.data });
}
