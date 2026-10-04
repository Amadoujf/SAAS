import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { withSuperAdminAccess } from "@yamacommerce/database";
import { RedisRateLimiter, redisConnection } from "@yamacommerce/queue";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { getOrCreateVisitorToken } from "@/lib/storefront/visitor-session";

const limiter = new RedisRateLimiter(redisConnection);

const schema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  companyName: z.string().trim().max(160).optional().or(z.literal("")),
  sectorKey: z.string().trim().max(40).optional().or(z.literal("")),
  message: z.string().trim().min(10).max(3000),
  website: z.string().max(0).optional(), // champ piège anti-robot : doit rester vide
});

/** Demande de devis « Sur mesure » — enregistrée pour l'équipe Y-COM (visible
 *  uniquement dans l'administration plateforme). Limité en fréquence par visiteur. */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const rate = await limiter.consume(`platform-inquiry:${await getOrCreateVisitorToken()}`, 5, 3_600_000);
  if (!rate.allowed) return NextResponse.json({ error: "Trop de demandes envoyées. Réessayez plus tard." }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Vérifiez les champs : nom, e-mail valide et message d'au moins 10 caractères." }, { status: 400 });
  const d = parsed.data;
  await withSuperAdminAccess((tx) =>
    tx.platformInquiry.create({
      data: { kind: "custom_plan", fullName: d.fullName, email: d.email.toLowerCase(), phone: d.phone || null, companyName: d.companyName || null, sectorKey: d.sectorKey || null, message: d.message },
    }),
  );
  return NextResponse.json({ data: { received: true } });
}
