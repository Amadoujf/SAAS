import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { RedisRateLimiter, redisConnection } from "@yamacommerce/queue";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { requireDomainPermission } from "@/lib/domains/require-domain-permission";
import { checkDomainDnsAndAdvance } from "@/lib/domains/dns-check-pipeline";
import { realDnsCheckDeps } from "@/lib/domains/real-deps";

/** Bouton « Vérifier maintenant » — voir docs/13, « DÉTECTION DNS » : « Prévoir un
 *  bouton "Vérifier maintenant" limité en fréquence ». Au plus 3 vérifications
 *  manuelles par domaine et par 5 minutes. */
const rateLimiter = new RedisRateLimiter(redisConnection);
const VERIFY_NOW_LIMIT = 3;
const VERIFY_NOW_WINDOW_MS = 5 * 60 * 1000;

const bodySchema = z.object({ tenantId: z.string().min(1) });

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });

  const actor = await requireDomainPermission(parsed.data.tenantId, "domains.verify");
  if (!actor) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const rateLimit = await rateLimiter.consume(`verify-now:${params.id}`, VERIFY_NOW_LIMIT, VERIFY_NOW_WINDOW_MS);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Trop de vérifications récentes — réessayez dans quelques instants." },
      { status: 429, headers: { "retry-after": String(Math.ceil(rateLimit.retryAfterMs / 1000)) } },
    );
  }

  const outcome = await checkDomainDnsAndAdvance(parsed.data.tenantId, params.id, realDnsCheckDeps());
  return NextResponse.json({ outcome });
}
