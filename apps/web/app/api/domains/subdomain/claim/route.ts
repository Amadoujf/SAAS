import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { requireDomainPermission } from "@/lib/domains/require-domain-permission";
import { claimFreeSubdomain } from "@/lib/domains/subdomain-pipeline";

const bodySchema = z.object({ tenantId: z.string().min(1), rawSubdomain: z.string().min(1) });

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });

  const actor = await requireDomainPermission(parsed.data.tenantId, "domains.create");
  if (!actor) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const result = await claimFreeSubdomain({
    tenantId: parsed.data.tenantId,
    actorUserId: actor.userId,
    rawSubdomain: parsed.data.rawSubdomain,
  });
  return NextResponse.json(result);
}
