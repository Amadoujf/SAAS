import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { isValidSenegalRegion } from "@yamacommerce/database";
import {
  addCustomerAddressAction,
  listCustomerAddressesAction,
} from "@/lib/customers/customer-pipeline";

const addressSchema = z.object({
  label: z.string().nullable().optional(),
  region: z.string().refine(isValidSenegalRegion, { message: "Région sénégalaise invalide." }),
  department: z.string().nullable().optional(),
  commune: z.string().nullable().optional(),
  neighborhood: z.string().nullable().optional(),
  street: z.string().nullable().optional(),
  geoLat: z.number().nullable().optional(),
  geoLng: z.number().nullable().optional(),
  isDefault: z.boolean().optional(),
});

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const membership = await getCurrentTenantMembership();
  if (!membership) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  const addresses = await listCustomerAddressesAction(membership.tenantId, params.id);
  if (addresses === null) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  return NextResponse.json({ addresses });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const membership = await getCurrentTenantMembership();
  if (!membership) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const parsed = addressSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });

  try {
    const address = await addCustomerAddressAction(membership.tenantId, params.id, parsed.data);
    if (address === null) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
    return NextResponse.json({ address });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur." }, { status: 400 });
  }
}
