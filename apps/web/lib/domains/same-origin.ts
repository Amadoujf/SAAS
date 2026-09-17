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
export function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false; // pas de fallback permissif : sans Origin, on refuse.
  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}
