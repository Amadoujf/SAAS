import { headers } from "next/headers";
import { resolveTenantByHost } from "@yamacommerce/domains";

/**
 * Résout le tenant courant à partir du Host HTTP de la requête.
 *
 * IMPORTANT — pourquoi ce n'est PAS fait dans `middleware.ts` : le middleware Next.js
 * s'exécute par défaut sur le runtime Edge, qui ne peut pas ouvrir de connexion
 * PostgreSQL via Prisma. La résolution réelle du tenant a donc lieu ici, dans des
 * Server Components / Route Handlers (runtime Node.js) — voir
 * docs/03-architecture-technique.md §3.3 pour le schéma de principe ; cette fonction en
 * est l'implémentation concrète. Le middleware se contente de laisser transiter le Host.
 */
export async function getCurrentTenant() {
  const headerList = await headers();
  const host = headerList.get("host");
  if (!host) return null;
  return resolveTenantByHost(host);
}
