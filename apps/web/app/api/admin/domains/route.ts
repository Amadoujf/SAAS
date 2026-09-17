import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { searchDomains, withSuperAdminAccess, type DomainLifecycleStatus } from "@yamacommerce/database";
import { requireSuperAdmin } from "@/lib/domains/require-super-admin";

const VALID_STATUSES = new Set<string>([
  "DRAFT",
  "PENDING_DNS",
  "VERIFYING",
  "VERIFIED",
  "SSL_PENDING",
  "ACTIVE",
  "MISCONFIGURED",
  "SUSPENDED",
  "EXPIRED",
  "REMOVED",
]);

function parseStatus(value: string | null): DomainLifecycleStatus | undefined {
  return value && VALID_STATUSES.has(value) ? (value as DomainLifecycleStatus) : undefined;
}

/** Recherche/filtrage global — voir docs/13, « INTERFACE SUPER ADMIN » : « Rechercher
 *  un domaine », « Filtrer par statut », « Voir le tenant ». */
export async function GET(request: NextRequest) {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const query = request.nextUrl.searchParams.get("query") ?? undefined;
  const status = parseStatus(request.nextUrl.searchParams.get("status"));
  const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;

  const domains = await withSuperAdminAccess((tx) => searchDomains(tx, { query, status, cursor }));
  return NextResponse.json({ domains });
}
