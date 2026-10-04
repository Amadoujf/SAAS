/** Libellés de la livraison — partagés par le tableau de bord, le site public, le suivi
 *  et l'espace livreur (utilisables côté navigateur : aucun accès base). */
type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export const JOB_LABELS: Record<string, { label: string; tone: Tone; guest: string }> = {
  pending: { label: "À affecter", tone: "warning", guest: "Course enregistrée : un livreur va être désigné." },
  assigned: { label: "Affectée", tone: "info", guest: "Un livreur est désigné : il passe prendre le colis." },
  picked_up: { label: "Colis pris", tone: "info", guest: "Le colis a été pris en charge." },
  in_transit: { label: "En route", tone: "info", guest: "Le livreur est en route vers le destinataire." },
  delivered: { label: "Livrée", tone: "success", guest: "Colis remis au destinataire." },
  failed: { label: "Échec", tone: "danger", guest: "La livraison n'a pas pu être faite : nous vous recontactons." },
  returning: { label: "Retour en cours", tone: "warning", guest: "Le colis revient à l'expéditeur." },
  returned: { label: "Retournée", tone: "neutral", guest: "Colis rendu à l'expéditeur." },
  canceled: { label: "Annulée", tone: "neutral", guest: "Course annulée." },
};

/** Étapes affichées sur le tracé (le reste est signalé à part). */
export const TRACK_STEPS = ["pending", "assigned", "picked_up", "in_transit", "delivered"] as const;
export const SIZE_LABELS: Record<string, { label: string; hint: string }> = {
  small: { label: "Petit", hint: "Enveloppe, vêtement, téléphone" },
  medium: { label: "Moyen", hint: "Carton à chaussures, sac" },
  large: { label: "Grand", hint: "Carton volumineux, petit appareil" },
};
export const FAILURE_REASONS = ["Destinataire absent", "Téléphone injoignable", "Adresse introuvable", "Refus du colis", "Ne peut pas payer", "Reporté à la demande du destinataire"];
export const SETTLEMENT_METHOD_LABELS: Record<string, string> = { cash: "Espèces", wave: "Wave", orange_money: "Orange Money", free_money: "Free Money", bank_transfer: "Virement", other: "Autre" };

const nf = new Intl.NumberFormat("fr-FR");
export const formatXof = (n: number | null | undefined) => (n == null ? "—" : `${nf.format(n)} FCFA`);
export const formatNumber = (n: number) => nf.format(n);
export const timeIn = (d: Date | string, tz: string) => new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date(d)).replace(":", " h ");
export const dateTimeIn = (d: Date | string, tz: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date(d));
export const zoneLabel = (z: { name: string | null; commune?: string | null; region: string }) => z.name ?? [z.commune, z.region].filter(Boolean).join(", ");
