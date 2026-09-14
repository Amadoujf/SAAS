import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { QuotaExceededError, requestMediaUpload } from "@/lib/media/upload-pipeline";
import { DEMO_OWNER_ID, DEMO_TENANT_ID, demoMediaDeps, ensureDemoMediaSeeded } from "@/lib/media/demo-media-context";

/**
 * Étapes 2-4 du parcours d'import — voir docs/12 §12.2, « IMPORTATION » : vérifie le
 * quota puis génère une autorisation d'import. Démonstration : tenant/utilisateur
 * fixes (voir demo-media-context.ts), aucune session requise — comme tous les autres
 * `/demo/*` de ce projet.
 */
const bodySchema = z.object({
  originalFileName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  folder: z.string().optional(),
});

export async function POST(request: NextRequest) {
  await ensureDemoMediaSeeded(request.nextUrl.origin);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  try {
    const result = await requestMediaUpload(demoMediaDeps(), {
      tenantId: DEMO_TENANT_ID,
      ownerId: DEMO_OWNER_ID,
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
