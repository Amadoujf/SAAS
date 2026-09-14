import { NextResponse } from "next/server";
import { DEMO_TENANT_ID, demoLocalStorageProvider, demoMediaRepositoryInstance } from "@/lib/media/demo-media-context";

/** Suppression DÉFINITIVE — voir « Prévoir une suppression définitive différée » :
 *  n'agit que sur un média déjà TRASHED (voir `permanentlyDelete`). Purge l'original
 *  ET toutes ses variantes du stockage réel, pas seulement la ligne de métadonnées. */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const repository = demoMediaRepositoryInstance();
  const asset = await repository.get(DEMO_TENANT_ID, params.id);
  if (!asset) {
    return NextResponse.json({ error: "Média introuvable." }, { status: 404 });
  }

  try {
    await repository.permanentlyDelete(DEMO_TENANT_ID, params.id);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur." }, { status: 409 });
  }

  await demoLocalStorageProvider.deleteAsset(DEMO_TENANT_ID, asset.storageKey);
  await Promise.all(
    asset.variants.map((variant) => demoLocalStorageProvider.deleteAsset(DEMO_TENANT_ID, variant.storageKey)),
  );

  return NextResponse.json({ ok: true });
}
