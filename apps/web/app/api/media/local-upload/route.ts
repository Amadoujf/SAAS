import { NextResponse, type NextRequest } from "next/server";
import { InvalidTokenError, LocalStorageProvider } from "@yamacommerce/storage";
import { storageProvider, resolveStorageConfig } from "@/lib/media/storage-config";

/**
 * Réception RÉELLE des octets pour l'adaptateur de stockage LOCAL — voir
 * storage-config.ts. Cette route n'est jamais atteinte quand `STORAGE_PROVIDER=r2`
 * (l'upload va alors directement au bucket via une URL pré-signée R2, jamais par
 * cette application) — voir `writeUploadedBytes`/`readForDownload`, spécifiques à
 * `LocalStorageProvider`, absents du contrat générique `StorageProvider`. Le jeton
 * signé (`?token=`) porté par l'URL de pré-autorisation EST l'autorisation
 * (signature HMAC vérifiée par `LocalStorageProvider`, aucun état serveur à
 * consulter) — même route que la démonstration (`app/api/demo-media/local-upload`),
 * mais sur le stockage réel du tenant.
 */
export async function PUT(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Paramètre 'token' manquant." }, { status: 400 });
  }
  if (resolveStorageConfig().kind !== "local") {
    return NextResponse.json({ error: "Fournisseur de stockage local non actif." }, { status: 404 });
  }

  const bytes = new Uint8Array(await request.arrayBuffer());
  try {
    await (storageProvider() as LocalStorageProvider).writeUploadedBytes(token, bytes);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof InvalidTokenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}
