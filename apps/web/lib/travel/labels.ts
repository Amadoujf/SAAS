/** Libellés français du voyage — partagés par le tableau de bord et le site public. */

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export const TRIP_TYPE_LABELS: Record<string, string> = {
  circuit: "Circuit",
  stay: "Séjour",
  pilgrimage: "Pèlerinage",
  excursion: "Escapade",
  cruise: "Croisière",
};

export const INCLUSION_LABELS: Record<string, string> = {
  flights: "Vols aller-retour",
  hotel: "Hébergement",
  transfers: "Transferts",
  breakfast: "Petits déjeuners",
  full_board: "Pension complète",
  guide: "Guide accompagnateur",
  visa_assistance: "Dossier de visa",
  insurance: "Assurance voyage",
  excursions: "Excursions au programme",
};

export const DOCUMENT_LABELS: Record<string, string> = {
  passport: "Passeport valide",
  id_card: "Carte d'identité",
  visa: "Visa",
  yellow_fever: "Carnet de vaccination (fièvre jaune)",
  photo: "Photo d'identité",
  travel_insurance: "Attestation d'assurance",
};

export const DOCUMENT_STATUS_LABELS: Record<string, { label: string; tone: Tone }> = {
  missing: { label: "À fournir", tone: "warning" },
  received: { label: "Reçu", tone: "info" },
  submitted: { label: "Déposé", tone: "info" },
  approved: { label: "Validé", tone: "success" },
  refused: { label: "Refusé", tone: "danger" },
};
/** Libellé propre au visa (« accordé » plutôt que « validé »). */
export function documentStatusLabel(kind: string, status: string) {
  if (kind === "visa" && status === "approved") return "Accordé";
  return DOCUMENT_STATUS_LABELS[status]?.label ?? status;
}

export const BOOKING_STATUS_LABELS: Record<string, { label: string; tone: Tone; guest: string }> = {
  requested: { label: "À confirmer", tone: "warning", guest: "Demande reçue — l'agence vous rappelle pour confirmer." },
  confirmed: { label: "Confirmée", tone: "info", guest: "Réservation confirmée par l'agence." },
  completed: { label: "Voyage effectué", tone: "success", guest: "Voyage effectué. Merci d'avoir voyagé avec nous." },
  canceled: { label: "Annulée", tone: "neutral", guest: "Réservation annulée." },
  no_show: { label: "Absent au départ", tone: "danger", guest: "Absent au départ." },
};

export const PAYMENT_STATE_LABELS: Record<string, { label: string; tone: Tone }> = {
  on_request: { label: "Sur devis", tone: "neutral" },
  unpaid: { label: "Aucun paiement reçu", tone: "warning" },
  partial: { label: "Paiement partiel", tone: "warning" },
  deposit_paid: { label: "Acompte reçu", tone: "info" },
  paid: { label: "Réglé", tone: "success" },
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Espèces à l'agence",
  wave: "Wave",
  orange_money: "Orange Money",
  bank_transfer: "Virement",
  card_terminal: "Carte (terminal de l'agence)",
};

export const PAYMENT_KIND_LABELS: Record<string, string> = { deposit: "Acompte", balance: "Solde", other: "Paiement" };

const nf = new Intl.NumberFormat("fr-FR");
export function formatXof(amount: number | null | undefined) {
  return amount == null ? "Sur devis" : `${nf.format(amount)} FCFA`;
}

export function formatTripPrice(price: number | null, priceUnit: string) {
  if (price == null || priceUnit === "on_request") return "Prix sur demande";
  return `${nf.format(price)} FCFA${priceUnit === "per_person" ? " / pers." : ""}`;
}

const dayFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" });
const dayYearFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const shortFmt = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", timeZone: "UTC" });

/** « 12 → 16 novembre 2026 », « 28 octobre → 3 novembre 2026 ». Dates en UTC (Dakar). */
export function formatDateRange(start: Date, end: Date | null) {
  if (!end || end.getTime() === start.getTime()) return dayYearFmt.format(start);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();
  return sameMonth ? `${start.getUTCDate()} → ${dayYearFmt.format(end)}` : `${dayFmt.format(start)} → ${dayYearFmt.format(end)}`;
}
export function formatShortDate(d: Date) {
  return shortFmt.format(d).replace(".", "");
}
export function formatLongDate(d: Date) {
  return dayYearFmt.format(d);
}

export function durationLabel(days: number, nights: number) {
  return nights > 0 ? `${days} jours · ${nights} nuit${nights > 1 ? "s" : ""}` : `${days} jour${days > 1 ? "s" : ""}`;
}

/** Places restantes, formulées pour le client (sans jamais inventer d'urgence). */
export function seatsLabel(capacity: number, reserved: number, status: string) {
  const left = Math.max(0, capacity - reserved);
  if (status !== "open") return { left, text: "Fermé à la réservation", tone: "neutral" as Tone };
  if (left === 0) return { left, text: "Complet", tone: "neutral" as Tone };
  return { left, text: left === 1 ? "1 place restante" : `${left} places restantes`, tone: left <= 3 ? ("warning" as Tone) : ("success" as Tone) };
}
