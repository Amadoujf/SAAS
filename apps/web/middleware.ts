import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware Edge — volontairement minimal.
 *
 * La résolution effective du tenant (requête PostgreSQL via Prisma) ne peut PAS avoir
 * lieu ici : le middleware Next.js tourne par défaut sur le runtime Edge, qui ne
 * supporte pas les connexions Prisma. Elle est faite plus loin, dans les Server
 * Components (runtime Node.js) — voir `lib/tenant.ts` et
 * docs/03-architecture-technique.md §3.3.
 *
 * Ce middleware se contente de : propager le Host reçu (utile derrière un proxy comme
 * Caddy qui peut réécrire certains en-têtes) et bloquer immédiatement les chemins
 * internes Next.js / assets statiques pour ne pas les faire transiter inutilement.
 */
export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const response = NextResponse.next();
  response.headers.set("x-yamacommerce-host", host);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
