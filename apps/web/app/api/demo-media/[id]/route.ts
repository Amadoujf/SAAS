import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { DEMO_TENANT_ID, demoAssetPublicRef, demoMediaRepositoryInstance } from "@/lib/media/demo-media-context";

const bodySchema = z.object({
  originalName: z.string().min(1).optional(),
  altText: z.string().nullable().optional(),
  caption: z.string().nullable().optional(),
  folder: z.string().optional(),
});

/** Renommage / texte alternatif / légende / dossier — voir « INTERFACE ». */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  try {
    const asset = await demoMediaRepositoryInstance().update(DEMO_TENANT_ID, params.id, parsed.data);
    return NextResponse.json({ ...asset, url: demoAssetPublicRef(request.nextUrl.origin, asset.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur." }, { status: 404 });
  }
}
