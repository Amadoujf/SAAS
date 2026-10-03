import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { completeMediaUpload } from "@/lib/media/upload-pipeline";
import { realMediaDeps } from "@/lib/media/real-media-context";
import { requireAnyTenantPermission } from "@/lib/tenant-permissions";
import { getCurrentTenantMembership } from "@/lib/current-tenant";

/** Étapes 6-9 du parcours d'import RÉEL — voir `app/api/demo-media/complete-upload`
 *  pour l'équivalent démonstration. Ne lève jamais pour un fichier rejeté (voir
 *  `completeMediaUpload`) : un rejet est un résultat 200 avec `status: "failed"`. */
const bodySchema = z.object({ mediaAssetId: z.string().min(1) });

export async function POST(request: NextRequest) {
  const membership = await getCurrentTenantMembership();
  if (!membership) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  const actor = await requireAnyTenantPermission(membership.tenantId, ["products.edit", "listings.edit"]);
  if (!actor) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const outcome = await completeMediaUpload(await realMediaDeps(membership.tenantId), {
    tenantId: membership.tenantId,
    mediaAssetId: parsed.data.mediaAssetId,
    absoluteBaseUrl: request.nextUrl.origin,
  });
  return NextResponse.json(outcome);
}
