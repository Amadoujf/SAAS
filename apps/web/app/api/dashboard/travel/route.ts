import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import {
  changeDocumentStatus,
  changeTripStatus,
  createDeparture,
  createPhoneBooking,
  recordPayment,
  removeTrip,
  saveTraveler,
  saveTrip,
  updateBookingStatus,
  updateDeparture,
  voidPayment,
} from "@/lib/travel/pipeline";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save_trip"), listingId: z.string().min(1).nullable(), trip: z.unknown() }),
  z.object({ action: z.literal("trip_status"), listingId: z.string().min(1), status: z.enum(["draft", "published", "unavailable", "archived"]) }),
  z.object({ action: z.literal("delete_trip"), listingId: z.string().min(1) }),
  z.object({ action: z.literal("add_departure"), departure: z.unknown() }),
  z.object({ action: z.literal("update_departure"), departureId: z.string().min(1), capacity: z.number().int().optional(), status: z.enum(["open", "closed"]).optional() }),
  z.object({ action: z.literal("booking_status"), reservationId: z.string().min(1), status: z.enum(["confirmed", "completed", "canceled", "no_show"]), note: z.string().max(300).optional() }),
  z.object({ action: z.literal("phone_booking"), booking: z.unknown() }),
  z.object({ action: z.literal("save_traveler"), traveler: z.unknown() }),
  z.object({ action: z.literal("document_status"), travelerId: z.string().min(1), kind: z.string().max(40), status: z.string().max(20), note: z.string().max(300).optional() }),
  z.object({ action: z.literal("record_payment"), payment: z.unknown() }),
  z.object({ action: z.literal("void_payment"), paymentId: z.string().min(1), reason: z.string().max(300) }),
]);

/** Actions voyage du tableau de bord — permission vérifiée par action dans le pipeline. */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const b = parsed.data;
  const result =
    b.action === "save_trip" ? await saveTrip(b.listingId, b.trip)
    : b.action === "trip_status" ? await changeTripStatus(b.listingId, b.status)
    : b.action === "delete_trip" ? await removeTrip(b.listingId)
    : b.action === "add_departure" ? await createDeparture(b.departure)
    : b.action === "update_departure" ? await updateDeparture(b.departureId, { capacity: b.capacity, status: b.status })
    : b.action === "booking_status" ? await updateBookingStatus(b.reservationId, b.status, b.note)
    : b.action === "phone_booking" ? await createPhoneBooking(b.booking)
    : b.action === "save_traveler" ? await saveTraveler(b.traveler)
    : b.action === "document_status" ? await changeDocumentStatus(b.travelerId, b.kind, b.status, b.note)
    : b.action === "record_payment" ? await recordPayment(b.payment)
    : await voidPayment(b.paymentId, b.reason);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ data: result.data });
}
