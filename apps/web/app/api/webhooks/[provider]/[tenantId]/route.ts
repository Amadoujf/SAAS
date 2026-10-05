import { NextResponse, type NextRequest } from "next/server";
import { readBodyWithLimit } from "@/lib/media/read-body-limit";
import { webhooksPaymentsQueue } from "@yamacommerce/queue";

const KNOWN_PROVIDERS = ["paydunya", "paytech", "cod", "wave_direct", "orange_money_direct"];

/**
 * Point d'entrée webhook de paiement — la route MANQUANTE identifiée par
 * l'exploration de l'étape 2 : `packages/payments/src/webhook-processor.ts` et
 * `apps/worker` (`webhooksPaymentsWorker`, déjà branché sur `processPaymentWebhook`)
 * existaient déjà, mais rien ne les invoquait depuis une vraie requête HTTP entrante.
 *
 * Traitement ASYNCHRONE via la file `webhooks-payments` (déjà configurée avec un
 * backoff agressif, voir `packages/queue/src/queues.ts`) plutôt qu'un appel direct
 * ici : un prestataire de paiement attend un accusé de réception rapide, jamais le
 * temps complet de vérification/rapprochement — l'idempotence réelle
 * (`PaymentWebhookEvent.eventId` unique) est de toute façon assurée par
 * `processPaymentWebhook` lui-même, pas par cette route.
 *
 * `tenantId`/`provider` viennent de l'URL (jamais du corps de la requête, dont le
 * contenu ne doit JAMAIS être considéré comme fiable avant vérification
 * cryptographique côté `processPaymentWebhook`).
 */
export async function POST(request: NextRequest, { params }: { params: { provider: string; tenantId: string } }) {
  if (!KNOWN_PROVIDERS.includes(params.provider)) {
    return NextResponse.json({ error: "Prestataire inconnu." }, { status: 404 });
  }

  // Un webhook légitime pèse quelques Ko : au-delà de 64 Ko, refus avant toute mise en file.
  const body = await readBodyWithLimit(request, 64 * 1024);
  if (!body) return NextResponse.json({ error: "Requête trop volumineuse." }, { status: 413 });
  const rawBody = new TextDecoder().decode(body);
  const headers = Object.fromEntries(request.headers.entries());

  try {
    await webhooksPaymentsQueue.add("process", {
      tenantId: params.tenantId,
      provider: params.provider,
      headers,
      rawBody,
    });
  } catch {
    // File d'attente injoignable (Redis down) — le prestataire doit réessayer.
    return NextResponse.json({ error: "Service temporairement indisponible." }, { status: 503 });
  }

  return NextResponse.json({ received: true });
}
