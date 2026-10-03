/** Libellés et formats de l'hôtel — partagés par le tableau de bord et le site public
 *  (utilisables côté navigateur : aucun accès base). */

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export const AMENITY_LABELS: Record<string, string> = {
  wifi: "Wi-Fi",
  air_conditioning: "Climatisation",
  tv: "Télévision",
  minibar: "Minibar",
  balcony: "Balcon ou terrasse",
  sea_view: "Vue sur la mer",
  garden_view: "Vue sur le jardin",
  bathtub: "Baignoire",
  workspace: "Bureau",
  kitchenette: "Kitchenette",
  breakfast: "Petit déjeuner inclus",
  parking: "Parking",
  pool: "Accès piscine",
};

export const HOUSEKEEPING_LABELS: Record<string, { label: string; tone: Tone }> = {
  clean: { label: "Propre", tone: "success" },
  dirty: { label: "À nettoyer", tone: "warning" },
  inspected: { label: "Vérifiée", tone: "info" },
  out_of_service: { label: "Hors service", tone: "danger" },
};

export const STAY_STATUS_LABELS: Record<string, { label: string; tone: Tone; guest: string }> = {
  requested: { label: "À confirmer", tone: "warning", guest: "Demande reçue : l'établissement vous confirme votre séjour rapidement." },
  confirmed: { label: "Confirmé", tone: "info", guest: "Séjour confirmé. Nous vous attendons !" },
  completed: { label: "Terminé", tone: "success", guest: "Séjour terminé. Merci et à bientôt." },
  canceled: { label: "Annulé", tone: "neutral", guest: "Séjour annulé." },
  no_show: { label: "Non présenté", tone: "danger", guest: "Séjour non honoré." },
};

const nf = new Intl.NumberFormat("fr-FR");
export const formatXof = (n: number | null | undefined) => (n == null ? "—" : `${nf.format(n)} FCFA`);

/** « ven. 10 oct. » d'une date locale AAAA-MM-JJ. */
export const shortDate = (iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) =>
  new Intl.DateTimeFormat("fr-FR", { ...opts, timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
export const longDate = (iso: string) => shortDate(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
export const nightsLabel = (n: number) => `${n} nuit${n > 1 ? "s" : ""}`;
export const guestsLabel = (adults: number, children: number) => `${adults} adulte${adults > 1 ? "s" : ""}${children ? `, ${children} enfant${children > 1 ? "s" : ""}` : ""}`;
export const clockLabel = (m: number) => `${Math.floor(m / 60)} h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`;
export const dateOnly = (d: Date) => d.toISOString().slice(0, 10);
export const addDaysIso = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
