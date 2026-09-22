import { NextResponse } from "next/server";
import { withSuperAdminAccess } from "@yamacommerce/database";
import { requireSuperAdmin } from "@/lib/domains/require-super-admin";

/** Détail d'un abonnement pour inspection Super Admin — voir docs/14-facturation-
 *  saas-abonnements.md, « consultation paiements/événements ». `events` inclut
 *  TOUS les événements, y compris les webhooks rejetés (signature invalide déjà
 *  exclue en amont — voir packages/billing, celle-là ne peut pas être rattachée à un
 *  tenant — mais montant/produit/session incohérents SONT journalisés ici). */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const subscription = await withSuperAdminAccess((tx) =>
    tx.tenantSubscription.findUnique({
      where: { id: params.id },
      include: {
        tenant: { select: { id: true, name: true, slug: true, status: true } },
        plan: true,
        payments: { orderBy: { createdAt: "desc" }, take: 50 },
        events: { orderBy: { createdAt: "desc" }, take: 100 },
      },
    }),
  );

  if (!subscription) return NextResponse.json({ error: "Abonnement introuvable." }, { status: 404 });
  return NextResponse.json({ subscription });
}
