import { createHash, timingSafeEqual } from "node:crypto";

/** Appel interne (worker → web) autorisé : secret configuré ET identique, comparé en
 *  temps constant (empreintes de même longueur, aucune fuite par le temps de réponse). */
export function isInternalCallAuthorized(provided: string | null): boolean {
  const expected = process.env.INTERNAL_WORKER_SECRET;
  if (!expected || !provided) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
