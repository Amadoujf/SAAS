import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { publishTenantDraft, saveTenantDraft } from "@/lib/site-editor/editor-pipeline";

const bodySchema = z.object({ action: z.enum(["save", "publish"]), pages: z.unknown() });

/** Éditeur visuel d'une entreprise : enregistrer le brouillon, ou l'enregistrer puis le
 *  publier. Permissions `site.edit` / `site.publish` vérifiées dans le pipeline. */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const saved = await saveTenantDraft({ pages: parsed.data.pages });
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: saved.status });
  if (parsed.data.action === "save") return NextResponse.json({ data: { saved: true } });
  const published = await publishTenantDraft();
  if (!published.ok) return NextResponse.json({ error: published.error }, { status: published.status });
  return NextResponse.json({ data: published.data });
}
