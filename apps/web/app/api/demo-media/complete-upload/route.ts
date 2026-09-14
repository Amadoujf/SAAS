import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { completeMediaUpload } from "@/lib/media/upload-pipeline";
import { DEMO_TENANT_ID, demoMediaDeps } from "@/lib/media/demo-media-context";

/**
 * Étapes 6-9 du parcours d'import — voir docs/12 §12.2, « IMPORTATION » : vérification
 * réelle du fichier, déduplication, génération des variantes, puis disponibilité dans
 * l'éditeur. Ne lève jamais pour un fichier rejeté (voir `completeMediaUpload`) : un
 * rejet est un résultat 200 avec `status: "failed"`, pas une erreur serveur.
 */
const bodySchema = z.object({ mediaAssetId: z.string().min(1) });

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const outcome = await completeMediaUpload(demoMediaDeps(), {
    tenantId: DEMO_TENANT_ID,
    mediaAssetId: parsed.data.mediaAssetId,
    absoluteBaseUrl: request.nextUrl.origin,
  });
  return NextResponse.json(outcome);
}
