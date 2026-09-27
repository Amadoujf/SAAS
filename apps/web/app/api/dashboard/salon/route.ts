import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import {
  changeServiceStatus,
  checkout,
  createDeskBooking,
  createTimeOff,
  deleteTimeOff,
  moveAppointment,
  removeService,
  saveBookingSettings,
  saveService,
  saveStaff,
  setFinalPrice,
  updateAppointmentStatus,
  voidCheckout,
} from "@/lib/salon/pipeline";

const id = z.string().uuid();
const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save_service"), listingId: id.nullable(), service: z.unknown() }),
  z.object({ action: z.literal("service_status"), listingId: id, status: z.enum(["draft", "published", "unavailable", "archived"]) }),
  z.object({ action: z.literal("delete_service"), listingId: id }),
  z.object({ action: z.literal("save_staff"), staffId: id.nullable(), staff: z.unknown() }),
  z.object({ action: z.literal("add_time_off"), timeOff: z.unknown() }),
  z.object({ action: z.literal("remove_time_off"), timeOffId: id }),
  z.object({ action: z.literal("save_settings"), settings: z.unknown() }),
  z.object({ action: z.literal("book"), booking: z.unknown() }),
  z.object({ action: z.literal("status"), reservationId: id, status: z.enum(["confirmed", "completed", "canceled", "no_show"]), note: z.string().max(300).optional() }),
  z.object({ action: z.literal("move"), reservationId: id, startAt: z.string().datetime(), staffId: id.nullable() }),
  z.object({ action: z.literal("final_price"), reservationId: id, total: z.number().int() }),
  z.object({ action: z.literal("checkout"), payment: z.unknown() }),
  z.object({ action: z.literal("void_payment"), paymentId: id, reason: z.string().max(300) }),
]);

/** Actions salon du tableau de bord — permission vérifiée par action dans le pipeline. */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const b = parsed.data;
  const result =
    b.action === "save_service" ? await saveService(b.listingId, b.service)
    : b.action === "service_status" ? await changeServiceStatus(b.listingId, b.status)
    : b.action === "delete_service" ? await removeService(b.listingId)
    : b.action === "save_staff" ? await saveStaff(b.staffId, b.staff)
    : b.action === "add_time_off" ? await createTimeOff(b.timeOff)
    : b.action === "remove_time_off" ? await deleteTimeOff(b.timeOffId)
    : b.action === "save_settings" ? await saveBookingSettings(b.settings)
    : b.action === "book" ? await createDeskBooking(b.booking)
    : b.action === "status" ? await updateAppointmentStatus(b.reservationId, b.status, b.note)
    : b.action === "move" ? await moveAppointment(b.reservationId, b.startAt, b.staffId)
    : b.action === "final_price" ? await setFinalPrice(b.reservationId, b.total)
    : b.action === "checkout" ? await checkout(b.payment)
    : await voidCheckout(b.paymentId, b.reason);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ data: result.data });
}
