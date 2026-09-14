import { NextResponse, type NextRequest } from "next/server";
import { findMediaReferencesInPages } from "@/lib/editor/media-references";
import {
  DEMO_TENANT_ID,
  demoAssetPublicRef,
  demoMediaRepositoryInstance,
  demoUsagePages,
  ensureDemoMediaSeeded,
} from "@/lib/media/demo-media-context";

/**
 * Vérifie où un média est utilisé AVANT suppression — voir « Un média utilisé ne doit
 * pas être supprimé silencieusement. Avant suppression : afficher les pages et
 * sections qui l'utilisent. ». Réutilise le même scanner générique que l'éditeur
 * visuel (voir lib/editor/media-references.ts, basé sur l'introspection de schéma —
 * fonctionne pour n'importe quelle section/secteur).
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  await ensureDemoMediaSeeded(request.nextUrl.origin);
  const asset = await demoMediaRepositoryInstance().get(DEMO_TENANT_ID, params.id);
  if (!asset) {
    return NextResponse.json({ error: "Média introuvable." }, { status: 404 });
  }
  const usage = findMediaReferencesInPages(demoUsagePages(), demoAssetPublicRef(request.nextUrl.origin, asset.id));
  return NextResponse.json({ usage });
}
