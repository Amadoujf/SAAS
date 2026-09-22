import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { isValidSenegalRegion } from "@yamacommerce/database";
import {
  updateCustomerAddressAction,
  deleteCustomerAddressAction,
} from "@/lib/customers/customer-pipeline";

const updateSchema = z.object({
  label: z.string().nullable().optional(),
  region: z
    .string()
    .refine(isValidSenegalRegion, { message: "Région sénégalaise invalide." })
    .optional(),
  department: z.string().nullable().optional(),
  commune: z.string().nullable().optional(),
  neighborhood: z.string().nullable().optional(),
  street: z.string().nullable().optional(),
  geoLat: z.number().nullable().optional(),
  geoLng: z.number().nullable().optional(),
  isDefault: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { addressId: string } }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const membership = await getCurrentTenantMembership();
  if (!membership) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });

  try {
    const address = await updateCustomerAddressAction(membership.tenantId, params.addressId, parsed.data);
    if (address === null) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
    return NextResponse.json({ address });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur." }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { addressId: string } }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const membership = await getCurrentTenantMembership();
  if (!membership) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  try {
    const result = await deleteCustomerAddressAction(membership.tenantId, params.addressId);
    if (result === null) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur." }, { status: 400 });
  }
}
