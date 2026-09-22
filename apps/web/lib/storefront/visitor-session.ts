import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Identification du visiteur anonyme — étape 2 (clients/panier/commandes/livraison,
 * 19 septembre 2026). N'existait pas du tout avant cette étape (grep exhaustif :
 * aucun usage de `cookies()` nulle part dans le repo) — pas de compte client, pas de
 * connexion, uniquement un jeton opaque posé dans un cookie httpOnly le temps
 * qu'une commande résolve un `Customer` réel (voir `customer-registry.ts`,
 * `resolveOrCreateCustomer`).
 *
 * `cookies()` ne peut être ÉCRIT que depuis une Server Action ou un Route Handler
 * (jamais un Server Component) — voir la documentation Next.js App Router. Cette
 * fonction n'est donc appelée QUE depuis `apps/web/app/api/storefront/**` (Route
 * Handlers), jamais depuis une page.
 */
const VISITOR_COOKIE_NAME = "yamacommerce_visitor";
const VISITOR_COOKIE_MAX_AGE_SECONDS = 180 * 24 * 60 * 60; // ~180 jours.

export async function getOrCreateVisitorToken(): Promise<string> {
  const store = await cookies();
  const existing = store.get(VISITOR_COOKIE_NAME)?.value;
  if (existing) return existing;

  const token = randomUUID();
  store.set(VISITOR_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VISITOR_COOKIE_MAX_AGE_SECONDS,
  });
  return token;
}
