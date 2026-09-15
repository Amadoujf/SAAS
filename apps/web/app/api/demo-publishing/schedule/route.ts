import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { demoSchedulePublish } from "@/lib/publishing/demo-publishing-context";

const bodySchema = z.object({
  toggles: z.object({
    tenantSuspended: z.boolean(),
    subscriptionExpired: z.boolean(),
    domainMissing: z.boolean(),
    privateMediaReferenced: z.boolean(),
  }),
  dateTimeLocal: z.string().min(1),
  timeZone: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }
  try {
    const result = demoSchedulePublish(parsed.data.toggles, parsed.data.dateTimeLocal, parsed.data.timeZone);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur inconnue." },
      { status: 400 },
    );
  }
}
