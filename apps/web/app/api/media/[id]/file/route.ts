import { NextResponse, type NextRequest } from "next/server";
import { withSuperAdminAccess } from "@yamacommerce/database";
import { requireTenantPermission } from "@/lib/tenant-permissions";
import { storageProvider } from "@/lib/media/storage-config";

/**
 * Sert les octets réels d'un média — voir `app/api/demo-media/[id]/file/route.ts`
 * pour l'équivalent démonstration. N'expose JAMAIS `storageKey` au client — seul
 * `MediaAsset.id`, déjà opaque, apparaît dans l'URL.
 *
 * Deux cas d'accès légitimes :
 * - `isPublic: true` (média promu par la publication d'un site/produit, voir
 *   `setMediaAssetPublic`) : servi SANS authentification — un visiteur du site
 *   public doit voir les images produit sans être connecté.
 * - Sinon (média privé/brouillon) : exige une adhésion tenant active (même garde que
 *   le reste du dashboard) — voir `requireTenantPermission`.
 *
 * La consultation du statut `isPublic`/`tenantId` lui-même DOIT passer par
 * `withSuperAdminAccess` (comme `resolveActiveDomainByHost` pour les domaines) :
 * savoir "à quel tenant appartient ce média, et est-il public" est par nature une
 * question PRÉ-authentification, cross-tenant — l'appelant ne peut pas fournir son
 * propre `tenantId` pour se scoper puisque le découvrir est justement le but.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const asset = await withSuperAdminAccess((tx) => tx.mediaAsset.findUnique({ where: { id: params.id } }));
  if (!asset || (asset.status !== "READY" && asset.status !== "TRASHED")) {
    return NextResponse.json({ error: "Média introuvable." }, { status: 404 });
  }

  if (!asset.isPublic) {
    const actor = await requireTenantPermission(asset.tenantId, "products.view");
    if (!actor) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const variantKey = request.nextUrl.searchParams.get("variant");
  const variants = Array.isArray(asset.variants) ? (asset.variants as { key: string; storageKey: string; format: string }[]) : [];
  const variant = variantKey ? variants.find((candidate) => candidate.key === variantKey) : undefined;
  const storageKey = variant?.storageKey ?? asset.storageKey;

  const file = await storageProvider().getAsset(asset.tenantId, storageKey);
  return new NextResponse(Buffer.from(file.body), {
    headers: {
      "content-type": variant ? `image/${variant.format}` : asset.mimeType,
      "cache-control": asset.isPublic ? "public, max-age=3600" : "private, max-age=60",
    },
  });
}
