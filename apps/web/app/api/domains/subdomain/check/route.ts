import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireDomainPermission } from "@/lib/domains/require-domain-permission";
import { checkSubdomainAvailability } from "@/lib/domains/subdomain-pipeline";

const bodySchema = z.object({ tenantId: z.string().min(1), rawSubdomain: z.string().min(1) });

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });

  const actor = await requireDomainPermission(parsed.data.tenantId, "domains.create");
  if (!actor) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const result = await checkSubdomainAvailability(parsed.data.rawSubdomain);
  return NextResponse.json(result);
}
