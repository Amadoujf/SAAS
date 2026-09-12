import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isDomainAllowedForTls } from "@yamacommerce/domains";

/**
 * Endpoint interrogé par Caddy (directive `on_demand_tls.ask`, voir infra/Caddyfile)
 * avant d'émettre un certificat TLS pour un domaine — personnalisé ou sous-domaine.
 * Doit répondre 200 uniquement pour un domaine vérifié et rattaché à un tenant actif ;
 * toute autre réponse fait échouer l'émission du certificat côté Caddy.
 */
export async function GET(request: NextRequest) {
  const domain = request.nextUrl.searchParams.get("domain");
  if (!domain) {
    return NextResponse.json({ error: "Paramètre 'domain' manquant." }, { status: 400 });
  }

  const allowed = await isDomainAllowedForTls(domain);
  if (!allowed) {
    return NextResponse.json({ error: "Domaine non autorisé." }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
