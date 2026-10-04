import { NextResponse, type NextRequest } from "next/server";
import { InvalidTokenError } from "@yamacommerce/storage";
import { demoLocalStorageProvider } from "@/lib/media/demo-media-context";

/**
 * Sert les octets d'une URL "signée" locale — voir `createSignedUrl`
 * (@yamacommerce/storage). Le jeton expire réellement (voir LocalStorageProvider) :
 * une fois passé, cette route refuse la requête même si le fichier existe toujours.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Paramètre 'token' manquant." }, { status: 400 });
  }

  try {
    const asset = await demoLocalStorageProvider.readForDownload(token);
    const fileName = request.nextUrl.searchParams.get("filename");
    return new NextResponse(Buffer.from(asset.body), {
      headers: {
        "content-type": asset.metadata.contentType,
        // Jamais interprété comme une page (ni deviné par le navigateur, ni exécuté).
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox",
        ...(fileName ? { "content-disposition": `attachment; filename="${fileName.replace(/[^\w.\- ]/g, "_").slice(0, 120)}"` } : {}),
      },
    });
  } catch (error) {
    if (error instanceof InvalidTokenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}
