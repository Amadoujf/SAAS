import { NextResponse, type NextRequest } from "next/server";
import type { MediaAssetStatus, MediaAssetType } from "@/lib/media/media-repository";
import { DEMO_TENANT_ID, demoMediaRepositoryInstance, ensureDemoMediaSeeded } from "@/lib/media/demo-media-context";
import { demoAssetPublicRef } from "@/lib/media/demo-media-context";

/** Liste les médias de démonstration (grille/liste, recherche, filtres, dossiers) —
 *  voir docs/12 §12.2, « INTERFACE ». Ajoute `url` (voir demoAssetPublicRef) à chaque
 *  élément : le client n'a jamais besoin de connaître `storageKey`. */
export async function GET(request: NextRequest) {
  await ensureDemoMediaSeeded(request.nextUrl.origin);
  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") as MediaAssetStatus | null;
  const type = searchParams.get("type") as MediaAssetType | null;
  const folder = searchParams.get("folder");
  const search = searchParams.get("search");

  const assets = await demoMediaRepositoryInstance().list(DEMO_TENANT_ID, {
    status: status ?? "READY",
    ...(type ? { type } : {}),
    ...(folder !== null ? { folder } : {}),
    ...(search ? { search } : {}),
  });

  return NextResponse.json({
    items: assets.map((asset) => ({ ...asset, url: demoAssetPublicRef(request.nextUrl.origin, asset.id) })),
  });
}
