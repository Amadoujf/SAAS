import { NextResponse, type NextRequest } from "next/server";
import type { MediaAssetStatus, MediaAssetType } from "@/lib/media/media-repository";
import { realMediaRepository } from "@/lib/media/real-media-context";
import { requireAnyTenantPermission } from "@/lib/tenant-permissions";
import { getCurrentTenantMembership } from "@/lib/current-tenant";

/** Liste les médias RÉELS du tenant courant — voir `app/api/demo-media/route.ts`
 *  pour l'équivalent démonstration. Ajoute `url` (route `/api/media/[id]/file`, voir
 *  ce fichier) à chaque élément : le client n'a jamais besoin de `storageKey`. */
export async function GET(request: NextRequest) {
  const membership = await getCurrentTenantMembership();
  if (!membership) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  const actor = await requireAnyTenantPermission(membership.tenantId, ["products.view", "listings.view"]);
  if (!actor) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") as MediaAssetStatus | null;
  const type = searchParams.get("type") as MediaAssetType | null;
  const folder = searchParams.get("folder");
  const search = searchParams.get("search");

  const assets = await realMediaRepository().list(membership.tenantId, {
    status: status ?? "READY",
    ...(type ? { type } : {}),
    ...(folder !== null ? { folder } : {}),
    ...(search ? { search } : {}),
  });

  return NextResponse.json({
    items: assets.map((asset) => ({ ...asset, url: `${request.nextUrl.origin}/api/media/${asset.id}/file` })),
  });
}
