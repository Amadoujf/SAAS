import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { demoRestoreAndPublish, demoRestoreIntoDraft } from "@/lib/publishing/demo-publishing-context";

const bodySchema = z.object({
  versionId: z.string().min(1),
  andPublish: z.boolean(),
  toggles: z
    .object({
      tenantSuspended: z.boolean(),
      subscriptionExpired: z.boolean(),
      domainMissing: z.boolean(),
      privateMediaReferenced: z.boolean(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }
  try {
    if (parsed.data.andPublish) {
      const result = await demoRestoreAndPublish(
        parsed.data.versionId,
        parsed.data.toggles ?? {
          tenantSuspended: false,
          subscriptionExpired: false,
          domainMissing: false,
          privateMediaReferenced: false,
        },
      );
      return NextResponse.json(result);
    }
    const draft = demoRestoreIntoDraft(parsed.data.versionId);
    return NextResponse.json({ outcome: "restored_into_draft", version: draft });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur inconnue." },
      { status: 400 },
    );
  }
}
