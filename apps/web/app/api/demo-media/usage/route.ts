import { NextResponse, type NextRequest } from "next/server";
import { summarizeQuotaUsage } from "@yamacommerce/storage";
import { DEMO_QUOTA, DEMO_TENANT_ID, demoMediaRepositoryInstance, ensureDemoMediaSeeded } from "@/lib/media/demo-media-context";

/** Utilisation du quota — voir « Affichage de l'espace utilisé », « Avertissement à
 *  80% », « Blocage propre à 100% ». */
export async function GET(request: NextRequest) {
  await ensureDemoMediaSeeded(request.nextUrl.origin);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const usage = await demoMediaRepositoryInstance().getUsageSnapshot(DEMO_TENANT_ID, monthStart);
  const summary = summarizeQuotaUsage(DEMO_QUOTA, usage);
  return NextResponse.json({ usage, quota: DEMO_QUOTA, summary });
}
