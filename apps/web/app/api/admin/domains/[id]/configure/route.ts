import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { configureManagedDomain, forceVerifiedByAdmin, withSuperAdminAccess, writeAuditLog } from "@yamacommerce/database";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { requireSuperAdmin } from "@/lib/domains/require-super-admin";

/**
 * Configuration manuelle par un Super Admin — voir docs/13, « INTERFACE SUPER
 * ADMIN » : « Configurer manuellement pour le client », « Enregistrer le
 * fournisseur », « Enregistrer le coût », « Enregistrer le prix facturé », « Définir
 * une date d'expiration ». Le titulaire légal reste TOUJOURS le client, même si
 * `managedByPlatform` est vrai (voir docs/13, « DOMAINE GÉRÉ PAR LA PLATEFORME »).
 */
const bodySchema = z.object({
  forceVerified: z.boolean().optional(),
  managedByPlatform: z.boolean().optional(),
  registrarProvider: z.string().nullable().optional(),
  externalRegistrarId: z.string().nullable().optional(),
  purchasedAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  autoRenew: z.boolean().optional(),
  purchaseCostXOF: z.number().nullable().optional(),
  priceBilledXOF: z.number().nullable().optional(),
  paymentStatus: z.string().nullable().optional(),
  legalOwnerName: z.string().nullable().optional(),
  legalOwnerContact: z.record(z.unknown()).nullable().optional(),
  transferStatus: z.string().nullable().optional(),
  isLocked: z.boolean().optional(),
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  const { forceVerified, purchasedAt, expiresAt, ...rest } = parsed.data;

  const updated = await withSuperAdminAccess(async (tx) => {
    if (forceVerified) await forceVerifiedByAdmin(tx, params.id);
    const domain = await configureManagedDomain(tx, params.id, {
      ...rest,
      purchasedAt: purchasedAt ? new Date(purchasedAt) : purchasedAt === null ? null : undefined,
      expiresAt: expiresAt ? new Date(expiresAt) : expiresAt === null ? null : undefined,
    });
    await writeAuditLog(tx, {
      tenantId: domain.tenantId,
      actorUserId: admin.userId,
      actorType: "super_admin",
      action: "domain.configured_by_admin",
      entityType: "Domain",
      entityId: params.id,
      metadata: { forceVerified: forceVerified ?? false },
    });
    return domain;
  });

  return NextResponse.json({ domain: updated });
}
