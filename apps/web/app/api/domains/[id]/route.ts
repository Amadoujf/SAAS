import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { requireDomainPermission } from "@/lib/domains/require-domain-permission";
import { removeDomain } from "@/lib/domains/custom-domain-pipeline";
import { realDnsCheckDeps } from "@/lib/domains/real-deps";

const bodySchema = z.object({ tenantId: z.string().min(1) });

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });

  const actor = await requireDomainPermission(parsed.data.tenantId, "domains.remove");
  if (!actor) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  await removeDomain(parsed.data.tenantId, actor.userId, params.id, realDnsCheckDeps());
  return NextResponse.json({ ok: true });
}
