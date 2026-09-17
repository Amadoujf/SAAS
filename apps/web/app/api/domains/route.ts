import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { listDomainsForTenant, withTenant } from "@yamacommerce/database";
import { requireDomainPermission } from "@/lib/domains/require-domain-permission";

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get("tenantId");
  if (!tenantId) return NextResponse.json({ error: "Paramètre 'tenantId' manquant." }, { status: 400 });

  const actor = await requireDomainPermission(tenantId, "domains.view");
  if (!actor) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const domains = await withTenant(tenantId, (tx) => listDomainsForTenant(tx, tenantId));
  return NextResponse.json({ domains });
}
