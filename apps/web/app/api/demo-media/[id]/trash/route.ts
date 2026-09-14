import { NextResponse } from "next/server";
import { DEMO_TENANT_ID, demoMediaRepositoryInstance } from "@/lib/media/demo-media-context";

/** Déplace un média dans la corbeille — voir « Déplacer d'abord le fichier dans la
 *  corbeille » (jamais une suppression directe et définitive depuis l'interface). */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    await demoMediaRepositoryInstance().trash(DEMO_TENANT_ID, params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur." }, { status: 404 });
  }
}
