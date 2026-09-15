import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { demoPromoteScheduled } from "@/lib/publishing/demo-publishing-context";

const bodySchema = z.object({ versionId: z.string().min(1) });

/** Bouton "Simuler l'échéance maintenant" de la démonstration — remplace l'attente
 *  réelle du job BullMQ (voir promoteScheduledPublish, schedule-pipeline.ts) par un
 *  déclenchement manuel immédiat, pour rendre la publication programmée vérifiable
 *  sans attendre. */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }
  const result = await demoPromoteScheduled(parsed.data.versionId);
  return NextResponse.json(result);
}
