import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sweepSubscriptionLifecycle, sweepExpiredCheckoutSessions } from "@yamacommerce/database";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { requireSuperAdmin } from "@/lib/domains/require-super-admin";

/**
 * Déclenchement MANUEL du balayage de rapprochement — voir docs/14-facturation-saas-
 * abonnements.md. Le VRAI mécanisme périodique tourne déjà dans `apps/worker`
 * (`subscription-lifecycle-sweep`, toutes les 5 minutes) ; cette route permet à un
 * Super Admin de forcer un passage immédiat (ex. juste après une panne Chariow
 * résolue), sans jamais dupliquer la logique elle-même.
 */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const lifecycle = await sweepSubscriptionLifecycle(500);
  const expiredSessions = await sweepExpiredCheckoutSessions(500);

  return NextResponse.json({ lifecycle, expiredSessions });
}
