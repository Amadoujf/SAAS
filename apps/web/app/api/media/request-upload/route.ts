import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { QuotaExceededError, requestMediaUpload } from "@/lib/media/upload-pipeline";
import { realMediaDeps } from "@/lib/media/real-media-context";
import { requireTenantPermission } from "@/lib/tenant-permissions";
import { getCurrentTenantMembership } from "@/lib/current-tenant";

/** Étapes 2-4 du parcours d'import RÉEL — voir `app/api/demo-media/request-upload`
 *  pour l'équivalent démonstration : vérifie le quota RÉEL du tenant (formule
 *  active) puis génère une autorisation d'import. */
const bodySchema = z.object({
  originalFileName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  folder: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const membership = await getCurrentTenantMembership();
  if (!membership) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  const actor = await requireTenantPermission(membership.tenantId, "products.edit");
  if (!actor) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  try {
    const result = await requestMediaUpload(await realMediaDeps(membership.tenantId), {
      tenantId: membership.tenantId,
      ownerId: actor.userId,
      originalFileName: parsed.data.originalFileName,
      declaredMimeType: parsed.data.mimeType,
      declaredSizeBytes: parsed.data.sizeBytes,
      folder: parsed.data.folder,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return NextResponse.json({ error: error.message, reason: error.reason }, { status: 413 });
    }
    throw error;
  }
}
