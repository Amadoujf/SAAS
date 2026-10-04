import { NextResponse, type NextRequest } from "next/server";
import { readBodyWithLimit } from "@/lib/media/read-body-limit";
import { saasBillingWebhooksQueue } from "@yamacommerce/queue";

/**
 * Point d'entrée du Pulse Chariow (facturation SaaS) — voir
 * docs/14-facturation-saas-abonnements.md. À NE JAMAIS confondre avec
 * `/api/webhooks/[provider]/[tenantId]` (paiements des commandes clientes) :
 * endpoint GLOBAL, sans tenant dans l'URL (un seul compte Chariow pour toute la
 * plateforme) — le tenant est retrouvé PLUS TARD par `processSaasBillingWebhook` via
 * `internalReference`, jamais fait confiance depuis l'URL ou le corps de la requête.
 *
 * Traitement ASYNCHRONE via la file `saas-billing-webhooks` — même raison que le
 * webhook de paiement commerce : accusé de réception rapide, vérification/
 * rapprochement complets côté worker.
 */
export async function POST(request: NextRequest) {
  // Un webhook légitime pèse quelques Ko : au-delà de 64 Ko, refus avant toute mise en file.
  const body = await readBodyWithLimit(request, 64 * 1024);
  if (!body) return NextResponse.json({ error: "Requête trop volumineuse." }, { status: 413 });
  const rawBody = new TextDecoder().decode(body);
  const headers = Object.fromEntries(request.headers.entries());

  try {
    await saasBillingWebhooksQueue.add("process", { headers, rawBody });
  } catch {
    return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 503 });
  }

  return NextResponse.json({ received: true });
}
