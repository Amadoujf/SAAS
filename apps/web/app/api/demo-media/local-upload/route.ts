import { NextResponse, type NextRequest } from "next/server";
import { InvalidTokenError } from "@yamacommerce/storage";
import { demoLocalStorageProvider } from "@/lib/media/demo-media-context";

/**
 * Réception RÉELLE des octets pour l'adaptateur de stockage local de démonstration —
 * voir docs/12 §12.2, « médiathèque R2 » (21 septembre 2026), « Utilise des URL
 * pré-signées afin que les fichiers soient envoyés directement vers R2. ». En
 * développement/démonstration (pas de vrai bucket R2), c'est CETTE route qui joue le
 * rôle du bucket : le jeton porté par `?token=` est la seule autorisation (voir
 * `LocalStorageProvider`, signature HMAC, aucun état serveur à consulter).
 */
export async function PUT(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Paramètre 'token' manquant." }, { status: 400 });
  }

  const bytes = new Uint8Array(await request.arrayBuffer());
  try {
    await demoLocalStorageProvider.writeUploadedBytes(token, bytes);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof InvalidTokenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}
