import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { getCustomerAction, updateCustomerAction } from "@/lib/customers/customer-pipeline";

const updateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  customerGroup: z.enum(["retail", "wholesale", "reseller"]).optional(),
  internalNotes: z.string().nullable().optional(),
});

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const membership = await getCurrentTenantMembership();
  if (!membership) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  const customer = await getCustomerAction(membership.tenantId, params.id);
  if (customer === null) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  return NextResponse.json({ customer });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const membership = await getCurrentTenantMembership();
  if (!membership) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });

  try {
    const customer = await updateCustomerAction(membership.tenantId, params.id, parsed.data);
    if (customer === null) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
    return NextResponse.json({ customer });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur." }, { status: 400 });
  }
}
