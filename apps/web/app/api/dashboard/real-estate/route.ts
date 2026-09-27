import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { changePropertyStatus, closeLease, openLease, recordRent, removeProperty, saveProperty, updateVisitStatus } from "@/lib/real-estate/pipeline";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save_property"), listingId: z.string().min(1).nullable(), property: z.unknown() }),
  z.object({ action: z.literal("property_status"), listingId: z.string().min(1), status: z.enum(["draft", "published", "unavailable", "archived"]) }),
  z.object({ action: z.literal("delete_property"), listingId: z.string().min(1) }),
  z.object({ action: z.literal("visit_status"), reservationId: z.string().min(1), status: z.enum(["confirmed", "completed", "canceled", "no_show"]), note: z.string().max(300).optional() }),
  z.object({ action: z.literal("open_lease"), lease: z.unknown() }),
  z.object({ action: z.literal("close_lease"), leaseId: z.string().min(1), endDate: z.string(), status: z.enum(["ended", "terminated"]) }),
  z.object({ action: z.literal("record_rent"), payment: z.unknown() }),
]);

/** Actions immobilier du dashboard — permission vérifiée par action dans le pipeline. */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const b = parsed.data;
  const result =
    b.action === "save_property" ? await saveProperty(b.listingId, b.property)
    : b.action === "property_status" ? await changePropertyStatus(b.listingId, b.status)
    : b.action === "delete_property" ? await removeProperty(b.listingId)
    : b.action === "visit_status" ? await updateVisitStatus(b.reservationId, b.status, b.note)
    : b.action === "open_lease" ? await openLease(b.lease)
    : b.action === "close_lease" ? await closeLease(b.leaseId, b.endDate, b.status)
    : await recordRent(b.payment);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ data: result.data });
}
