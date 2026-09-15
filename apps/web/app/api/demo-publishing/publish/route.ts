import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { demoPublishNow, demoPublishNowSlow } from "@/lib/publishing/demo-publishing-context";

const togglesSchema = z.object({
  tenantSuspended: z.boolean(),
  subscriptionExpired: z.boolean(),
  domainMissing: z.boolean(),
  privateMediaReferenced: z.boolean(),
});

const bodySchema = z.object({
  toggles: togglesSchema,
  publishMessage: z.string().optional(),
  simulateSlowMs: z.number().min(0).max(10_000).optional(),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }
  const { toggles, publishMessage, simulateSlowMs } = parsed.data;
  const result = simulateSlowMs
    ? await demoPublishNowSlow(toggles, simulateSlowMs)
    : await demoPublishNow(toggles, publishMessage);
  return NextResponse.json(result);
}
