import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { requireDomainPermission } from "@/lib/domains/require-domain-permission";
import { setPrimaryDomain } from "@/lib/domains/custom-domain-pipeline";

const bodySchema = z.object({ tenantId: z.string().min(1) });

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });

  const actor = await requireDomainPermission(parsed.data.tenantId, "domains.set_primary");
  if (!actor) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const result = await setPrimaryDomain(parsed.data.tenantId, actor.userId, params.id);
  return NextResponse.json(result);
}
