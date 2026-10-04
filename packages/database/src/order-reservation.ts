import type { Prisma } from "@prisma/client";
import { withSuperAdminAccess, withTenant } from "./tenant-context";
import { cancelOrder } from "./order-registry";
import { OrderStatusConflictError } from "./order-status";

/**
 * Expiration automatique des réservations de stock — étape 2 (clients/panier/
 * commandes/livraison, 19 septembre 2026), suite directe de `order-registry.ts`
 * (`convertCartToOrder` pose `Order.reservationExpiresAt` UNIQUEMENT pour le chemin
 * paiement en ligne, jamais pour COD — voir `RESERVATION_WINDOW_MINUTES`).
 *
 * Exigences explicites de la revue (après le premier passage de M4) :
 * - Utilise l'heure de POSTGRESQL (`NOW()`), jamais l'horloge du serveur applicatif
 *   (`new Date()`), pour décider qu'une réservation est expirée — un décalage
 *   d'horloge entre l'app et la base ne doit jamais avancer ou retarder une expiration.
 *   Nécessite `$queryRaw` (Prisma ne peut pas exprimer `NOW()` dans un filtre fluide) —
 *   seul le SELECT de découverte est brut ; la mutation elle-même passe TOUJOURS par
 *   `cancelOrder` -> `transitionOrderStatus` (le seul point autorisé à modifier
 *   `Order.status`, voir order-status.ts), jamais un UPDATE brut direct.
 * - Condition ATOMIQUE sur le statut : `transitionOrderStatus` garde son écriture par
 *   un `updateMany` conditionné sur le statut LU (`WHERE status = 'AWAITING_PAYMENT'`)
 *   — c'est CE mécanisme, déjà prouvé par `order-status.test.ts`, qui arbitre la
 *   course avec un paiement concurrent : si un webhook a déjà fait progresser la
 *   commande entre notre lecture et notre tentative d'annulation,
 *   `OrderStatusConflictError` est levée et traitée comme un no-op sûr, jamais une
 *   erreur à journaliser comme un échec (voir `releaseExpiredReservationTx`).
 * - Idempotente à plusieurs niveaux : (1) un job rejoué pour une commande déjà traitée
 *   (payée, annulée manuellement, etc.) est un no-op sûr, (2) deux workers traitant le
 *   MÊME job (ou le job individuel ET le balayage périodique traitant la même commande
 *   en parallèle) ne peuvent jamais libérer le stock deux fois — la garde de
 *   `transitionOrderStatus` empêche la seconde tentative de progresser.
 * - Traçabilité : `releaseReservedStock` (order-registry.ts) écrit désormais TOUJOURS
 *   un `StockMovement`, et `cancelOrder` écrit TOUJOURS une entrée
 *   `OrderStatusHistory` — aucune libération n'est silencieuse.
 * - `sweepExpiredReservations` est le job de RÉCUPÉRATION après interruption du
 *   worker : il ne dépend d'AUCUN job BullMQ individuel encore présent, il relit
 *   directement l'état réel en base (voir `findExpiredReservationCandidates`) — si le
 *   job différé d'une commande a été perdu (worker arrêté au mauvais moment, purge
 *   Redis, etc.), le prochain passage du balayage la retrouve quand même.
 */

export type ReleaseReservationOutcome =
  | { outcome: "released" }
  | { outcome: "skipped"; reason: "not_awaiting_payment_or_not_yet_expired" | "concurrent_payment_won_the_race" };

/**
 * Version "déjà dans une transaction" — réutilisable si un appelant a déjà ouvert son
 * propre `withTenant` (ex. un traitement groupé qui voudrait tout faire dans une seule
 * transaction). Le balayage (`sweepExpiredReservations`) préfère volontairement UNE
 * TRANSACTION PAR COMMANDE (voir `releaseExpiredReservation` ci-dessous) : l'échec
 * d'une commande ne doit jamais faire annuler la libération déjà réussie d'une autre.
 */
export async function releaseExpiredReservationTx(
  tx: Prisma.TransactionClient,
  tenantId: string,
  orderId: string,
): Promise<ReleaseReservationOutcome> {
  // `reservationExpiresAt` est `@db.Timestamptz(3)` (voir schema.prisma) : un instant
  // ABSOLU, directement comparable à `NOW()` (également `timestamptz`) SANS AUCUNE
  // gymnastique de fuseau, quel que soit le fuseau de la session Postgres courante —
  // voir `order-reservation.test.ts`, « MULTI-FUSEAUX », pour la preuve avec
  // plusieurs `SET TIME ZONE` différents. Une PREMIÈRE version comparait une colonne
  // `timestamp` sans fuseau via `AT TIME ZONE 'UTC' < NOW()` — fonctionnellement
  // correct mais fragile (toute autre requête future contre cette colonne aurait pu
  // oublier cette clause et reproduire le bug) ; la migration
  // `20260927000000_reservation_expiry_timestamptz` élimine la classe de bug entière
  // en changeant le TYPE de la colonne, pas seulement cette requête.
  //
  // `FOR UPDATE` : sérialise les appels concurrents sur la MÊME commande (deux workers
  // sur le même job, ou un job individuel contre le balayage périodique, ou un
  // paiement en cours). Sous READ COMMITTED, un appel bloqué ici réévalue la clause
  // WHERE sur la version validée de la ligne une fois le verrou obtenu : si un autre
  // appel a déjà annulé (ou si un paiement a déjà confirmé), la ligne ne correspond
  // plus et cet appel est proprement `skipped` — il ne peut jamais agir une seconde fois.
  const candidates = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Order"
    WHERE "id" = ${orderId} AND "tenantId" = ${tenantId}
      AND "status" = 'AWAITING_PAYMENT' AND "reservationExpiresAt" < NOW()
    FOR UPDATE
  `;
  if (candidates.length === 0) {
    return { outcome: "skipped", reason: "not_awaiting_payment_or_not_yet_expired" };
  }

  try {
    await cancelOrder(tx, tenantId, orderId, {
      changedByType: "system",
      note: "Réservation expirée : paiement non reçu à temps.",
    });
    return { outcome: "released" };
  } catch (error) {
    if (error instanceof OrderStatusConflictError) {
      // Un paiement a gagné la course entre notre lecture ci-dessus et notre tentative
      // d'annulation — comportement CORRECT attendu, jamais un échec à journaliser.
      return { outcome: "skipped", reason: "concurrent_payment_won_the_race" };
    }
    throw error;
  }
}

/** Point d'entrée appelé directement par le worker (voir apps/worker) pour UNE
 *  commande précise — ouvre sa PROPRE transaction `withTenant`. */
export async function releaseExpiredReservation(
  tenantId: string,
  orderId: string,
): Promise<ReleaseReservationOutcome> {
  return withTenant(tenantId, (tx) => releaseExpiredReservationTx(tx, tenantId, orderId));
}

export interface ExpiredReservationCandidate {
  id: string;
  tenantId: string;
}

/**
 * Découverte CROSS-TENANT des candidats — nécessite `withSuperAdminAccess` (RLS
 * scoperait sinon à un seul tenant). Ne mute JAMAIS rien elle-même : seulement une
 * lecture, `NOW()` faisant foi, plafonnée à `batchSize` (traitement par lots — voir
 * la revue). Triée par expiration la plus ancienne d'abord, pour qu'un retard de
 * traitement rattrape les plus anciennes en premier.
 */
export async function findExpiredReservationCandidates(batchSize: number): Promise<ExpiredReservationCandidate[]> {
  return withSuperAdminAccess((tx) =>
    // Voir la note de `releaseExpiredReservationTx` : colonne `timestamptz`, instant
    // absolu, comparaison nue contre `NOW()` correcte sans conversion de fuseau.
    tx.$queryRaw<ExpiredReservationCandidate[]>`
      SELECT "id", "tenantId" FROM "Order"
      WHERE "status" = 'AWAITING_PAYMENT' AND "reservationExpiresAt" < NOW()
      ORDER BY "reservationExpiresAt" ASC
      LIMIT ${batchSize}
    `,
  );
}

export interface SweepExpiredReservationsResult {
  released: number;
  skipped: number;
  failed: number;
  errors: { tenantId: string; orderId: string; message: string }[];
}

/**
 * Job de RÉCUPÉRATION périodique — voir la note de tête de fichier. Chaque commande
 * candidate est traitée dans SA PROPRE transaction (`releaseExpiredReservation`) : un
 * échec isolé (ex. erreur transitoire sur une commande) n'empêche jamais le
 * traitement des autres candidates du même lot, et reste réessayable sans risque de
 * doublon au prochain passage (voir `errors`, à journaliser par l'appelant — voir
 * apps/worker).
 */
export async function sweepExpiredReservations(batchSize = 100): Promise<SweepExpiredReservationsResult> {
  const candidates = await findExpiredReservationCandidates(batchSize);
  const result: SweepExpiredReservationsResult = { released: 0, skipped: 0, failed: 0, errors: [] };

  for (const candidate of candidates) {
    try {
      const outcome = await releaseExpiredReservation(candidate.tenantId, candidate.id);
      if (outcome.outcome === "released") {
        result.released += 1;
      } else {
        result.skipped += 1;
      }
    } catch (error) {
      result.failed += 1;
      result.errors.push({
        tenantId: candidate.tenantId,
        orderId: candidate.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}
