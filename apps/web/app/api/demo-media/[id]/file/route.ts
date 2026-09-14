import { NextResponse, type NextRequest } from "next/server";
import { DEMO_TENANT_ID, demoLocalStorageProvider, demoMediaRepositoryInstance } from "@/lib/media/demo-media-context";

/**
 * Sert les octets d'UNE variante (ou l'original) d'un média de démonstration — voir
 * « Conserver l'original privé et servir les variantes publiées par CDN ». Cette
 * route joue ici le rôle du CDN (pas de vrai CDN en démonstration) : un vrai tenant
 * servirait ses variantes PUBLIQUES directement depuis le domaine CDN R2 (voir
 * `R2StorageProvider.publicUrl`), jamais via une route applicative comme celle-ci.
 *
 * N'expose JAMAIS `storageKey` (clé de stockage interne) au client — seul
 * l'identifiant `MediaAsset.id`, déjà opaque, apparaît dans l'URL.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const asset = await demoMediaRepositoryInstance().get(DEMO_TENANT_ID, params.id);
  if (!asset || (asset.status !== "READY" && asset.status !== "TRASHED")) {
    return NextResponse.json({ error: "Média introuvable." }, { status: 404 });
  }

  const variantKey = request.nextUrl.searchParams.get("variant") ?? "medium";
  const variant = asset.variants.find((candidate) => candidate.key === variantKey);
  const storageKey = variant?.storageKey ?? asset.storageKey;

  const file = await demoLocalStorageProvider.getAsset(DEMO_TENANT_ID, storageKey);
  return new NextResponse(Buffer.from(file.body), {
    headers: {
      "content-type": variant ? `image/${variant.format}` : asset.mimeType,
      "cache-control": "private, max-age=60",
    },
  });
}
