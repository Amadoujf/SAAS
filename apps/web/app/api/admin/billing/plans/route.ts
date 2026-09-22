import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { withSuperAdminAccess } from "@yamacommerce/database";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { requireSuperAdmin } from "@/lib/domains/require-super-admin";

/**
 * CRUD des formules SaaS — voir docs/14-facturation-saas-abonnements.md, « Super
 * Admin : plan CRUD ». Toutes les valeurs sont administrables, JAMAIS codées en dur
 * (voir la revue initiale de cette étape).
 */
const planSchema = z.object({
  name: z.string().min(1),
  currency: z.string().default("XOF"),
  priceMonthly: z.number().int().nonnegative(),
  priceYearly: z.number().int().nonnegative(),
  trialDays: z.number().int().nonnegative().default(14),
  monthlyDurationDays: z.number().int().positive().default(30),
  yearlyDurationDays: z.number().int().positive().default(365),
  gracePeriodDays: z.number().int().nonnegative().default(3),
  setupFeeXOF: z.number().int().nonnegative().nullable().optional(),
  maxProducts: z.number().int().nonnegative(),
  maxEmployees: z.number().int().nonnegative(),
  maxShops: z.number().int().nonnegative(),
  storageMB: z.number().int().nonnegative(),
  customDomainAllowed: z.boolean().default(false),
  maxCustomDomains: z.number().int().nonnegative().default(1),
  maxEmailsPerMonth: z.number().int().nonnegative().nullable().optional(),
  maxWhatsAppMessagesPerMonth: z.number().int().nonnegative().nullable().optional(),
  maxAIGenerationsPerMonth: z.number().int().nonnegative(),
  maxAIImagesAnalyzedPerMonth: z.number().int().nonnegative(),
  maxAIProductsImportedPerMonth: z.number().int().nonnegative(),
  aiEstimatedCostCapXOF: z.number().int().nonnegative().nullable().optional(),
  includedModuleKeys: z.array(z.string()).default([]),
  renewalMode: z.enum(["MANUAL", "AUTOMATIC"]).default("MANUAL"),
  chariowMonthlyProductId: z.string().nullable().optional(),
  chariowYearlyProductId: z.string().nullable().optional(),
});

export async function GET() {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const plans = await withSuperAdminAccess((tx) => tx.subscriptionPlan.findMany({ orderBy: { priceMonthly: "asc" } }));
  return NextResponse.json({ plans });
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const parsed = planSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });

  // Toujours créée en DRAFT — un Super Admin doit explicitement publier une formule
  // (via PATCH) avant qu'elle ne soit proposable à la souscription, jamais visible
  // par accident dès sa création (voir `/api/billing/summary`, qui ne liste QUE les
  // formules `PUBLISHED`).
  try {
    const plan = await withSuperAdminAccess((tx) =>
      tx.subscriptionPlan.create({ data: { ...parsed.data, status: "DRAFT" } }),
    );
    return NextResponse.json({ plan });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Échec de la création de la formule." },
      { status: 400 },
    );
  }
}
