import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { createCustomerAction, listCustomersAction } from "@/lib/customers/customer-pipeline";

const customerSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  customerGroup: z.enum(["retail", "wholesale", "reseller"]).optional(),
  internalNotes: z.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
  const membership = await getCurrentTenantMembership();
  if (!membership) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const search = request.nextUrl.searchParams.get("search");
  const customers = await listCustomersAction(membership.tenantId, search ? { search } : undefined);
  if (customers === null) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  return NextResponse.json({ customers });
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const membership = await getCurrentTenantMembership();
  if (!membership) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const parsed = customerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });

  try {
    const customer = await createCustomerAction(membership.tenantId, parsed.data);
    if (customer === null) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
    return NextResponse.json({ customer });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur." }, { status: 400 });
  }
}
