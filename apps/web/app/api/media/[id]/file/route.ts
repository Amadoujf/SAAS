import { NextResponse, type NextRequest } from "next/server";
import { withSuperAdminAccess, isMediaAssetPubliclyUsedByProduct } from "@yamacommerce/database";
import { requireAnyTenantPermission } from "@/lib/tenant-permissions";
import { storageProvider } from "@/lib/media/storage-config";

/**
 * Sert les octets réels d'un média — voir `app/api/demo-media/[id]/file/route.ts`
 * pour l'équivalent démonstration. N'expose JAMAIS `storageKey` au client — seul
 * `MediaAsset.id`, déjà opaque, apparaît dans l'URL.
 *
 * Trois cas d'accès, du plus large au plus restreint :
 *
 * 1. `isPublic: true` (média promu par la PUBLICATION D'UN SITE, voir
 *    `setMediaAssetPublic` dans le pipeline de publication — mécanisme séparé,
 *    inchangé) : servi intégralement, original ET variantes, sans authentification.
 * 2. Sinon, PRODUIT PUBLIÉ utilisant ce média (voir la revue du 18 septembre 2026,
 *    « publier un produit ne doit pas rendre public un fichier privé complet utilisé
 *    ailleurs ») : servi SANS authentification, mais UNIQUEMENT une variante
 *    redimensionnée connue (`?variant=thumbnail|small|medium|large`) — JAMAIS le
 *    fichier original, même public. Ce statut est calculé À LA VOLÉE à chaque
 *    requête (jamais un drapeau à garder synchronisé) : dépublier le produit ou
 *    retirer sa dernière image PUBLIÉE retire cet accès immédiatement, à la requête
 *    suivante, sans code de "démarquage" séparé à maintenir.
 * 3. Sinon (média privé/brouillon, ou original demandé hors cas 1) : exige une
 *    adhésion tenant active avec `products.view` — même garde que le reste du
 *    dashboard.
 *
 * La consultation du statut `isPublic`/`tenantId` du média, ET la vérification "est-
 * il utilisé par un produit publié", DOIVENT passer par `withSuperAdminAccess`
 * (comme `resolveActiveDomainByHost` pour les domaines) : savoir "à quel tenant
 * appartient ce média, et est-il légitimement public" est par nature une question
 * PRÉ-authentification, cross-tenant.
 */
const PUBLIC_VARIANT_KEYS = new Set(["thumbnail", "small", "medium", "large"]);

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const asset = await withSuperAdminAccess((tx) => tx.mediaAsset.findUnique({ where: { id: params.id } }));
  if (!asset || (asset.status !== "READY" && asset.status !== "TRASHED")) {
    return NextResponse.json({ error: "Média introuvable." }, { status: 404 });
  }

  const variantKey = request.nextUrl.searchParams.get("variant");
  const isKnownSizeVariant = variantKey !== null && PUBLIC_VARIANT_KEYS.has(variantKey);

  let publicAccess: "full" | "variant-only" | "none" = "none";
  if (asset.isPublic) {
    publicAccess = "full";
  } else {
    const usedByPublishedProduct = await withSuperAdminAccess((tx) =>
      isMediaAssetPubliclyUsedByProduct(tx, asset.tenantId, asset.id),
    );
    if (usedByPublishedProduct) publicAccess = "variant-only";
  }

  const grantedPublicly = publicAccess === "full" || (publicAccess === "variant-only" && isKnownSizeVariant);
  if (!grantedPublicly) {
    const actor = await requireAnyTenantPermission(asset.tenantId, ["products.view", "listings.view"]);
    if (!actor) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const variants = Array.isArray(asset.variants) ? (asset.variants as { key: string; storageKey: string; format: string }[]) : [];
  const variant = variantKey ? variants.find((candidate) => candidate.key === variantKey) : undefined;
  const storageKey = variant?.storageKey ?? asset.storageKey;

  const file = await storageProvider().getAsset(asset.tenantId, storageKey);
  return new NextResponse(Buffer.from(file.body), {
    headers: {
      "content-type": variant ? `image/${variant.format}` : asset.mimeType,
      "cache-control": grantedPublicly ? "public, max-age=3600" : "private, max-age=60",
    },
  });
}
