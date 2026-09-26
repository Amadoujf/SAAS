import { NextResponse, type NextRequest } from "next/server";
import { normalizeSubdomain, validateSubdomainFormat, generateSubdomainAlternatives } from "@yamacommerce/domains";
import { isSubdomainTaken } from "@yamacommerce/database";
import { RedisRateLimiter, redisConnection } from "@yamacommerce/queue";
import { getOrCreateVisitorToken } from "@/lib/storefront/visitor-session";

const limiter = new RedisRateLimiter(redisConnection);
const SUFFIX = process.env.PLATFORM_SUBDOMAIN_SUFFIX ?? "yamacommerce.ai";

const ISSUE_LABEL: Record<string, string> = {
  too_short: "3 caractères minimum.",
  too_long: "63 caractères maximum.",
  invalid_characters: "Lettres, chiffres et tirets uniquement.",
  leading_or_trailing_hyphen: "Pas de tiret au début ni à la fin.",
  reserved: "Cette adresse est réservée.",
};

/** Disponibilité d'un sous-domaine pendant l'onboarding (limité en fréquence). */
export async function GET(request: NextRequest) {
  const rate = await limiter.consume(`onboarding-subdomain:${await getOrCreateVisitorToken()}`, 60, 60_000);
  if (!rate.allowed) return NextResponse.json({ error: "Trop de vérifications, patientez un instant." }, { status: 429 });
  const normalized = normalizeSubdomain(request.nextUrl.searchParams.get("value") ?? "");
  const format = validateSubdomainFormat(normalized);
  if (!format.valid) return NextResponse.json({ normalized, suffix: SUFFIX, available: false, message: ISSUE_LABEL[format.issues[0]!] ?? "Adresse invalide." });
  const taken = await isSubdomainTaken(normalized, SUFFIX);
  const suggestions: string[] = [];
  if (taken) {
    for (const alt of generateSubdomainAlternatives(normalized, 6)) {
      if (suggestions.length >= 3) break;
      if (validateSubdomainFormat(alt).valid && !(await isSubdomainTaken(alt, SUFFIX))) suggestions.push(alt);
    }
  }
  return NextResponse.json({ normalized, suffix: SUFFIX, available: !taken, message: taken ? "Déjà prise." : null, suggestions });
}
