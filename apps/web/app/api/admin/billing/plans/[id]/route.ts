import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { withSuperAdminAccess } from "@yamacommerce/database";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { requireSuperAdmin } from "@/lib/domains/require-super-admin";

/** Toutes les valeurs restent PARTIELLEMENT modifiables — un Super Admin peut publier/
 *  archiver une formule sans devoir renvoyer tous ses autres champs. */
const planUpdateSchema = z
  .object({
    name: z.string().min(1),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
    currency: z.string(),
    priceMonthly: z.number().int().nonnegative(),
    priceYearly: z.number().int().nonnegative(),
    trialDays: z.number().int().nonnegative(),
    monthlyDurationDays: z.number().int().positive(),
    yearlyDurationDays: z.number().int().positive(),
    gracePeriodDays: z.number().int().nonnegative(),
    setupFeeXOF: z.number().int().nonnegative().nullable(),
    maxProducts: z.number().int().nonnegative(),
    maxEmployees: z.number().int().nonnegative(),
    maxShops: z.number().int().nonnegative(),
    storageMB: z.number().int().nonnegative(),
    customDomainAllowed: z.boolean(),
    maxCustomDomains: z.number().int().nonnegative(),
    maxEmailsPerMonth: z.number().int().nonnegative().nullable(),
    maxWhatsAppMessagesPerMonth: z.number().int().nonnegative().nullable(),
    maxAIGenerationsPerMonth: z.number().int().nonnegative(),
    maxAIImagesAnalyzedPerMonth: z.number().int().nonnegative(),
    maxAIProductsImportedPerMonth: z.number().int().nonnegative(),
    aiEstimatedCostCapXOF: z.number().int().nonnegative().nullable(),
    includedModuleKeys: z.array(z.string()),
    renewalMode: z.enum(["MANUAL", "AUTOMATIC"]),
    chariowMonthlyProductId: z.string().nullable(),
    chariowYearlyProductId: z.string().nullable(),
  })
  .partial();

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const parsed = planUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });

  // `RenewalMode.AUTOMATIC` reste STRUCTURELLEMENT inerte (voir docs/14) : autorisé à
  // être enregistré sur le schéma, mais aucun code de ce projet ne peut jamais
  // prélever sans confirmation explicite du client à chaque paiement — ce PATCH ne
  // fait que refléter la valeur choisie, il n'active rien de plus.
  try {
    const plan = await withSuperAdminAccess((tx) =>
      tx.subscriptionPlan.update({ where: { id: params.id }, data: parsed.data }),
    );
    return NextResponse.json({ plan });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Échec de la mise à jour de la formule." },
      { status: 400 },
    );
  }
}
