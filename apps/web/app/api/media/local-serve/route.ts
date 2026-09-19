import { NextResponse, type NextRequest } from "next/server";
import { InvalidTokenError, LocalStorageProvider } from "@yamacommerce/storage";
import { storageProvider, resolveStorageConfig } from "@/lib/media/storage-config";

/**
 * Sert les octets d'une URL "signée" locale — voir `createSignedUrl`
 * (@yamacommerce/storage). Le jeton expire réellement (voir LocalStorageProvider) :
 * une fois passé, cette route refuse la requête même si le fichier existe toujours.
 * Comme `local-upload`, uniquement atteignable quand `STORAGE_PROVIDER` n'est pas
 * "r2" (voir storage-config.ts).
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Paramètre 'token' manquant." }, { status: 400 });
  }
  if (resolveStorageConfig().kind !== "local") {
    return NextResponse.json({ error: "Fournisseur de stockage local non actif." }, { status: 404 });
  }

  try {
    const asset = await (storageProvider() as LocalStorageProvider).readForDownload(token);
    const fileName = request.nextUrl.searchParams.get("filename");
    return new NextResponse(Buffer.from(asset.body), {
      headers: {
        "content-type": asset.metadata.contentType,
        ...(fileName ? { "content-disposition": `attachment; filename="${fileName}"` } : {}),
      },
    });
  } catch (error) {
    if (error instanceof InvalidTokenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}
