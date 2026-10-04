import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { RedisRateLimiter, redisConnection } from "@yamacommerce/queue";
import { PREVIEW_COOKIE, previewEnabled, previewFingerprint, safeNext } from "@/lib/preview/private-preview";

const limiter = new RedisRateLimiter(redisConnection);

/** Vérifie le code de la prévisualisation privée et pose le cookie (empreinte, jamais le code). */
export async function POST(request: NextRequest) {
  // Origine vue par le visiteur (Host transmis par le proxy), jamais l'adresse interne du serveur.
  const host = request.headers.get("host") ?? request.nextUrl.host;
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  const origin = `${proto}://${host}`;
  if (!previewEnabled()) return NextResponse.redirect(new URL("/", origin), 303);
  const form = await request.formData().catch(() => null);
  const code = String(form?.get("code") ?? "").slice(0, 200);
  const next = safeNext(String(form?.get("suite") ?? "/"));
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "inconnu";
  const rate = await limiter.consume(`preview-access:${ip}`, 8, 15 * 60_000);
  const back = (error: string) => NextResponse.redirect(new URL(`/acces-previsualisation?suite=${encodeURIComponent(next)}&erreur=${error}`, origin), 303);
  if (!rate.allowed) return back("trop");
  const expected = Buffer.from(await previewFingerprint(process.env.PREVIEW_ACCESS_CODE!));
  const given = Buffer.from(await previewFingerprint(code));
  if (!code || !timingSafeEqual(expected, given)) return back("code");
  const res = NextResponse.redirect(new URL(next, origin), 303);
  res.cookies.set(PREVIEW_COOKIE, expected.toString(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
    // Un seul code pour tous les sous-domaines de démonstration (ex. « .1-2-3-4.sslip.io »).
    ...(process.env.PREVIEW_COOKIE_DOMAIN ? { domain: process.env.PREVIEW_COOKIE_DOMAIN } : {}),
  });
  return res;
}
