import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { assignOrderDeliverer, changeOrderStatus, issueInvoice, reviewManualPayment, updateInternalNotes } from "@/lib/orders/dashboard-pipeline";

const STATUSES = ["PREPARING", "READY", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELED", "REFUNDED"] as const;

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), toStatus: z.enum(STATUSES), note: z.string().max(500).nullable().optional() }),
  z.object({ action: z.literal("payment"), decision: z.enum(["approve", "reject"]), note: z.string().max(500).nullable().optional() }),
  z.object({ action: z.literal("deliverer"), delivererId: z.string().min(1).nullable() }),
  z.object({ action: z.literal("notes"), notes: z.string().max(4000) }),
  z.object({ action: z.literal("invoice") }),
]);

/** Actions du dashboard sur UNE commande — permission vérifiée par action dans
 *  `dashboard-pipeline.ts`, isolation tenant par RLS. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const body = parsed.data;
  const result =
    body.action === "status"
      ? await changeOrderStatus(params.id, body.toStatus, body.note)
      : body.action === "payment"
        ? await reviewManualPayment(params.id, body.decision, body.note)
        : body.action === "deliverer"
          ? await assignOrderDeliverer(params.id, body.delivererId)
          : body.action === "notes"
            ? await updateInternalNotes(params.id, body.notes)
            : await issueInvoice(params.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ data: result.data });
}
