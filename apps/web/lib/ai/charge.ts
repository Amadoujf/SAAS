import type { AiBilling } from "./provider";

/**
 * Coût imputé au budget pour une génération qui n'a pas abouti :
 * - réponse reçue (coût connu) : ce coût, même si l'étape suivante a échoué ;
 * - erreur de l'API sans génération : rien ;
 * - coût inconnu (coupure, réponse illisible, erreur inattendue) : le maximum réservé.
 */
export function failedCallCharge(input: { receivedCostXOF: number | null; billing: AiBilling | null; knownCostXOF: number; reservedXOF: number }): number {
  if (input.receivedCostXOF !== null) return input.receivedCostXOF;
  if (input.billing === "known") return input.knownCostXOF;
  if (input.billing === "none") return 0;
  return input.reservedXOF;
}
