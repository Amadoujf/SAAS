import "server-only";
import type { NextRequest } from "next/server";

/**
 * Protection CSRF minimale pour les routes mutantes `/api/domains/*` — voir docs/13,
 * « SÉCURITÉ » : « CSRF ». Next.js protège nativement les Server Actions contre le
 * CSRF (vérification d'origine intégrée), mais PAS les Route Handlers classiques —
 * cette vérification comble cet écart pour toute route qui modifie l'état,
 * exactement comme un `fetch` same-origin depuis notre propre application le
 * satisferait toujours, contrairement à un formulaire hébergé sur un autre site.
 */
export function isSameOriginRequest(request: Pick<NextRequest, "headers" | "nextUrl">): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false; // pas de fallback permissif : sans Origin, on refuse.
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  // CORRECTION — bogue trouvé en testant une boutique sur son propre domaine :
  // `request.nextUrl.host` reflète l'adresse d'écoute du serveur Next (ex.
  // `localhost:3000`, ou l'hôte interne derrière Caddy), PAS le domaine public de la
  // boutique. Toute action panier/checkout d'un visiteur sur `boutique.sn` était donc
  // refusée. On compare désormais à l'hôte PUBLIC reçu (Host / X-Forwarded-Host
  // posé par le proxy). Sûr : un site tiers ne peut pas forger l'en-tête Origin du
  // navigateur de la victime, et une requête hors navigateur ne porte pas ses cookies.
  const candidates = [
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim(),
    request.headers.get("host"),
    request.nextUrl.host,
  ].filter((h): h is string => !!h);
  return candidates.includes(originHost);
}
