/**
 * Libellés COMMUNS des encaissements manuels (tous secteurs) — même liste que la base
 * (`MANUAL_PAYMENT_METHODS`). Utilisables côté navigateur.
 */
export const MANUAL_METHOD_LABELS: Record<string, string> = {
  cash: "Espèces",
  wave: "Wave",
  orange_money: "Orange Money",
  free_money: "Free Money",
  bank_transfer: "Virement",
  card_terminal: "Carte (terminal)",
  other: "Autre",
};

/** Mention affichée à côté de tout encaissement manuel : jamais présenté comme un paiement en ligne. */
export const MANUAL_PAYMENT_NOTE = "Encaissement enregistré par l'équipe — pas un paiement en ligne.";
