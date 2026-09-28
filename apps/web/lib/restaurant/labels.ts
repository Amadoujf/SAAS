/** Libellés et formats du restaurant — partagés par le tableau de bord et le site public
 *  (utilisables côté navigateur : aucun accès base). */

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export const MODE_LABELS: Record<string, { label: string; short: string }> = {
  dine_in: { label: "Sur place", short: "Table" },
  takeaway: { label: "À emporter", short: "Emporter" },
  delivery: { label: "Livraison", short: "Livraison" },
};

export const KITCHEN_LABELS: Record<string, { label: string; tone: Tone; guest: string; action?: string }> = {
  new: { label: "Nouvelle", tone: "warning", guest: "Commande envoyée : le restaurant va la prendre en charge.", action: "Accepter" },
  accepted: { label: "Acceptée", tone: "info", guest: "Commande acceptée par la cuisine.", action: "Lancer en cuisine" },
  preparing: { label: "En préparation", tone: "info", guest: "En cuisine : votre commande se prépare.", action: "Prête" },
  ready: { label: "Prête", tone: "success", guest: "Votre commande est prête.", action: "Remise au client" },
  completed: { label: "Remise", tone: "neutral", guest: "Commande remise. Bon appétit !" },
  canceled: { label: "Annulée", tone: "danger", guest: "Commande annulée." },
};

export const NEXT_STATUS: Record<string, string | undefined> = { new: "accepted", accepted: "preparing", preparing: "ready", ready: "completed" };

/** Libellé de l'étape « prête » selon le mode (le client comprend ce qu'il doit faire). */
export const readyGuestLabel = (mode: string) =>
  mode === "delivery" ? "Votre commande est prête : elle part en livraison." : mode === "takeaway" ? "Votre commande est prête : vous pouvez venir la retirer." : "Votre commande est prête : elle arrive à votre table.";

export const BOOKING_LABELS: Record<string, { label: string; tone: Tone; guest: string }> = {
  requested: { label: "À confirmer", tone: "warning", guest: "Demande reçue." },
  confirmed: { label: "Confirmée", tone: "info", guest: "Table réservée. À bientôt !" },
  completed: { label: "Venus", tone: "success", guest: "Merci de votre visite." },
  canceled: { label: "Annulée", tone: "neutral", guest: "Réservation annulée." },
  no_show: { label: "Absents", tone: "danger", guest: "Réservation non honorée." },
};

export const BADGE_LABELS: Record<string, string> = { signature: "Signature", spicy: "Pimenté", vegetarian: "Végétarien", new: "Nouveau" };

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Espèces",
  wave: "Wave",
  orange_money: "Orange Money",
  free_money: "Free Money",
  card: "Carte bancaire",
  bank_transfer: "Virement",
  other: "Autre",
};

export const WEEKDAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

const nf = new Intl.NumberFormat("fr-FR");
export const formatXof = (n: number | null | undefined) => (n == null ? "—" : `${nf.format(n)} FCFA`);
export const clockLabel = (m: number) => `${Math.floor(m / 60) % 24} h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`;
export const coversLabel = (n: number) => `${n} couvert${n > 1 ? "s" : ""}`;
export const shortDate = (iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) =>
  new Intl.DateTimeFormat("fr-FR", { ...opts, timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));
export const longDate = (iso: string) => shortDate(iso, { weekday: "long", day: "numeric", month: "long" });
export const addDaysIso = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
/** Heure locale « 12 h 45 » d'un instant, dans le fuseau du restaurant. */
export const timeIn = (d: Date | string, tz: string) =>
  new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date(d)).replace(":", " h ");
export const dateIn = (d: Date | string, tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(d));

/** Horaires regroupés par jour, lisibles : « 11 h – 15 h, 18 h – 23 h ». */
export function hoursByDay(hours: { weekday: number; startMinute: number; endMinute: number }[]) {
  return [1, 2, 3, 4, 5, 6, 0].map((d) => {
    const r = hours.filter((h) => h.weekday === d).sort((a, b) => a.startMinute - b.startMinute);
    const at = (m: number) => (m === 0 || m === 1440 ? "minuit" : clockLabel(m));
    return { day: WEEKDAYS[d]!, text: r.length ? r.map((x) => `${at(x.startMinute)} – ${at(x.endMinute)}`).join(", ") : "Fermé" };
  });
}

export interface OptionSnapshot {
  group: string;
  option: string;
  priceDelta: number;
}
export const optionsText = (options: unknown) =>
  (Array.isArray(options) ? (options as OptionSnapshot[]) : []).map((o) => (o.priceDelta ? `${o.option} (+${nf.format(o.priceDelta)})` : o.option)).join(", ");
