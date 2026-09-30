import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { assign, cancel, deliver, fail, newJob, progress, remit, renewCourierLink, saveCourier, saveCourierHome, saveSettings, saveZone, settle, startReturn } from "@/lib/courier/pipeline";

const id = z.string().uuid();
const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("new_job"), job: z.unknown() }),
  z.object({ action: z.literal("assign"), jobId: id, delivererId: id }),
  z.object({ action: z.literal("cancel"), jobId: id, reason: z.string().max(200) }),
  z.object({ action: z.literal("start_return"), jobId: id, delivererId: id.nullable() }),
  z.object({ action: z.literal("progress"), jobId: id, to: z.enum(["picked_up", "in_transit", "returned"]) }),
  z.object({ action: z.literal("deliver"), jobId: id, delivery: z.unknown() }),
  z.object({ action: z.literal("fail"), jobId: id, reason: z.string().max(200) }),
  z.object({ action: z.literal("save_courier"), delivererId: id.nullable(), courier: z.unknown() }),
  z.object({ action: z.literal("renew_courier_link"), delivererId: id }),
  z.object({ action: z.literal("remit"), remittance: z.unknown() }),
  z.object({ action: z.literal("settle"), settlement: z.unknown() }),
  z.object({ action: z.literal("settings"), settings: z.unknown() }),
  z.object({ action: z.literal("save_home"), home: z.unknown() }),
  z.object({ action: z.literal("save_zone"), zoneId: id.nullable(), zone: z.unknown() }),
]);

/** Actions du bureau de livraison — permission vérifiée par action dans le pipeline. */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const b = parsed.data;
  const result =
    b.action === "new_job" ? await newJob(b.job)
    : b.action === "assign" ? await assign(b.jobId, b.delivererId)
    : b.action === "cancel" ? await cancel(b.jobId, b.reason)
    : b.action === "start_return" ? await startReturn(b.jobId, b.delivererId)
    : b.action === "progress" ? await progress(b.jobId, b.to)
    : b.action === "deliver" ? await deliver(b.jobId, b.delivery)
    : b.action === "fail" ? await fail(b.jobId, b.reason)
    : b.action === "save_courier" ? await saveCourier(b.delivererId, b.courier)
    : b.action === "renew_courier_link" ? await renewCourierLink(b.delivererId)
    : b.action === "remit" ? await remit(b.remittance)
    : b.action === "settle" ? await settle(b.settlement)
    : b.action === "settings" ? await saveSettings(b.settings)
    : b.action === "save_zone" ? await saveZone(b.zoneId, b.zone)
    : await saveCourierHome(b.home);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ data: result.data });
}
