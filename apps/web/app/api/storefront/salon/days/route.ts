import { NextResponse, type NextRequest } from "next/server";
import { RedisRateLimiter, redisConnection } from "@yamacommerce/queue";
import { publicDays } from "@/lib/salon/public-pipeline";
import { notFoundSalon, salonErrorResponse, salonTenantOf } from "@/lib/salon/route-guard";
import { getOrCreateVisitorToken } from "@/lib/storefront/visitor-session";

const limiter = new RedisRateLimiter(redisConnection);

/** Jours des deux prochaines semaines avec leur nombre d'horaires libres. */
export async function GET(request: NextRequest) {
  const tenantId = await salonTenantOf(request);
  if (!tenantId) return notFoundSalon();
  const rate = await limiter.consume(`salon-days:${tenantId}:${await getOrCreateVisitorToken()}`, 120, 10 * 60_000);
  if (!rate.allowed) return NextResponse.json({ error: "Trop de demandes. Réessayez dans quelques minutes." }, { status: 429 });
  const p = request.nextUrl.searchParams;
  try {
    const days = await publicDays(tenantId, { service: p.get("service") ?? "", from: p.get("from") ?? "", staff: p.get("staff") });
    return NextResponse.json({ data: days }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return salonErrorResponse(error, "Calendrier indisponible pour le moment.");
  }
}
