import { NextResponse } from "next/server";
import { DEMO_TENANT_ID, demoMediaRepositoryInstance } from "@/lib/media/demo-media-context";

/** Restaure un média depuis la corbeille — voir « Restauration ». */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    await demoMediaRepositoryInstance().restore(DEMO_TENANT_ID, params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur." }, { status: 404 });
  }
}
