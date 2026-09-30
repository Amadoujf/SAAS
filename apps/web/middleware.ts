import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { PREVIEW_COOKIE, isPreviewExempt, previewEnabled, previewFingerprint } from "@/lib/preview/private-preview";

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
const VISITOR_COOKIE = "yamacommerce_visitor";

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  // Prévisualisation privée (PREVIEW_ACCESS_CODE défini) : code exigé partout, rien d'indexable.
  if (previewEnabled() && !isPreviewExempt(request.nextUrl.pathname)) {
    const expected = await previewFingerprint(process.env.PREVIEW_ACCESS_CODE!);
    if (request.cookies.get(PREVIEW_COOKIE)?.value !== expected) {
      if (request.nextUrl.pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Prévisualisation privée : code d'accès requis." }, { status: 401, headers: { "x-robots-tag": "noindex, nofollow" } });
      }
      const url = request.nextUrl.clone();
      url.pathname = "/acces-previsualisation";
      url.search = `?suite=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
      const gate = NextResponse.redirect(url);
      gate.headers.set("x-robots-tag", "noindex, nofollow");
      return gate;
    }
  }
  // Jeton visiteur posé DÈS la première réponse : sans cela, les premiers appels
  // parallèles du panier (lecture du panier + options de checkout) arrivaient sans
  // cookie et créaient chacun leur propre panier (paniers orphelins, trouvé en
  // testant la boutique dans un vrai navigateur).
  let visitor = request.cookies.get(VISITOR_COOKIE)?.value;
  const requestHeaders = new Headers(request.headers);
  if (!visitor) {
    visitor = crypto.randomUUID();
    requestHeaders.set("cookie", `${request.headers.get("cookie") ? `${request.headers.get("cookie")}; ` : ""}${VISITOR_COOKIE}=${visitor}`);
  }
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-yamacommerce-host", host);
  if (previewEnabled()) response.headers.set("x-robots-tag", "noindex, nofollow");
  if (!request.cookies.get(VISITOR_COOKIE)) {
    response.cookies.set(VISITOR_COOKIE, visitor, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 180 * 24 * 60 * 60,
    });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
