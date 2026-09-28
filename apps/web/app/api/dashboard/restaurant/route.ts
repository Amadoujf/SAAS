import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import {
  addTable,
  bookingOutcome,
  createDeskOrder,
  deskBooking,
  editTable,
  moveOrder,
  newTableQr,
  placeBooking,
  recordPayment,
  saveDish,
  saveRestaurantSettings,
  saveRestaurantHome,
  saveSection,
  setDishPhoto,
  toggleDish,
  toggleOption,
  voidPayment,
} from "@/lib/restaurant/pipeline";

const id = z.string().uuid();
const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save_section"), sectionId: id.nullable(), section: z.unknown() }),
  z.object({ action: z.literal("save_dish"), dishId: id.nullable(), dish: z.unknown() }),
  z.object({ action: z.literal("dish_available"), dishId: id, isAvailable: z.boolean() }),
  z.object({ action: z.literal("option_available"), optionId: id, isAvailable: z.boolean() }),
  z.object({ action: z.literal("add_table"), table: z.unknown() }),
  z.object({ action: z.literal("edit_table"), tableId: id, table: z.unknown() }),
  z.object({ action: z.literal("table_qr"), tableId: id }),
  z.object({ action: z.literal("save_settings"), settings: z.unknown() }),
  z.object({ action: z.literal("order_status"), orderId: id, to: z.string().max(20), note: z.string().max(300).optional() }),
  z.object({ action: z.literal("desk_order"), order: z.unknown() }),
  z.object({ action: z.literal("payment"), payment: z.unknown() }),
  z.object({ action: z.literal("void_payment"), paymentId: id, reason: z.string().max(300) }),
  z.object({ action: z.literal("desk_booking"), booking: z.unknown() }),
  z.object({ action: z.literal("booking_table"), reservationId: id, tableId: id.nullable() }),
  z.object({ action: z.literal("save_home"), home: z.unknown() }),
  z.object({ action: z.literal("dish_photo"), dishId: id, imageUrl: z.string().max(300).nullable() }),
  z.object({ action: z.literal("booking_outcome"), reservationId: id, outcome: z.enum(["arrived", "no_show", "canceled"]), note: z.string().max(300).optional() }),
]);

/** Actions restaurant du tableau de bord — permission vérifiée par action dans le pipeline. */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const b = parsed.data;
  const result =
    b.action === "save_section" ? await saveSection(b.sectionId, b.section)
    : b.action === "save_dish" ? await saveDish(b.dishId, b.dish)
    : b.action === "dish_available" ? await toggleDish(b.dishId, b.isAvailable)
    : b.action === "option_available" ? await toggleOption(b.optionId, b.isAvailable)
    : b.action === "add_table" ? await addTable(b.table)
    : b.action === "edit_table" ? await editTable(b.tableId, b.table)
    : b.action === "table_qr" ? await newTableQr(b.tableId)
    : b.action === "save_settings" ? await saveRestaurantSettings(b.settings)
    : b.action === "order_status" ? await moveOrder(b.orderId, b.to, b.note)
    : b.action === "desk_order" ? await createDeskOrder(b.order)
    : b.action === "payment" ? await recordPayment(b.payment)
    : b.action === "void_payment" ? await voidPayment(b.paymentId, b.reason)
    : b.action === "desk_booking" ? await deskBooking(b.booking)
    : b.action === "booking_table" ? await placeBooking(b.reservationId, b.tableId)
    : b.action === "save_home" ? await saveRestaurantHome(b.home)
    : b.action === "dish_photo" ? await setDishPhoto(b.dishId, b.imageUrl)
    : await bookingOutcome(b.reservationId, b.outcome, b.note);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ data: result.data });
}
