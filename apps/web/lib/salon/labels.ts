/** Libellés et formats du salon — partagés par le tableau de bord et le site public
 *  (utilisables côté navigateur : aucun accès base). */

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export const APPOINTMENT_STATUS_LABELS: Record<string, { label: string; tone: Tone; guest: string }> = {
  requested: { label: "À confirmer", tone: "warning", guest: "Demande reçue : le salon vous confirme le rendez-vous rapidement." },
  confirmed: { label: "Confirmé", tone: "info", guest: "Rendez-vous confirmé. À bientôt !" },
  completed: { label: "Réalisé", tone: "success", guest: "Prestation réalisée. Merci de votre visite." },
  canceled: { label: "Annulé", tone: "neutral", guest: "Rendez-vous annulé." },
  no_show: { label: "Manqué", tone: "danger", guest: "Rendez-vous manqué." },
};

export const WEEKDAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
/** Ordre d'affichage : la semaine commence le lundi. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const nf = new Intl.NumberFormat("fr-FR");
export const formatXof = (n: number | null | undefined) => (n == null ? "—" : `${nf.format(n)} FCFA`);

export function durationLabel(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

export function priceLabel(price: number | null, priceFrom: boolean) {
  if (price == null) return "Sur devis";
  return `${priceFrom ? "À partir de " : ""}${nf.format(price)} FCFA`;
}

export const minuteLabel = (m: number) => `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`.replace(" h 00", " h");
export const clockLabel = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Heure locale du salon d'un instant (« 14:30 »). */
export const timeIn = (d: Date, tz: string) => new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz }).format(d);

/** « mardi 14 octobre » dans le fuseau du salon. */
export const dayIn = (d: Date, tz: string, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }) => new Intl.DateTimeFormat("fr-FR", { ...opts, timeZone: tz }).format(d);

/** Libellé d'une date locale AAAA-MM-JJ (« Aujourd'hui », « Demain », « jeu. 16 »). */
export function dayChip(date: string, today: string) {
  const d = new Date(`${date}T12:00:00Z`);
  const t = new Date(`${today}T12:00:00Z`);
  const diff = Math.round((d.getTime() - t.getTime()) / 86_400_000);
  const week = new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: "UTC" }).format(d).replace(".", "");
  const num = d.getUTCDate();
  const month = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" }).format(d).replace(".", "");
  return { top: diff === 0 ? "Auj." : diff === 1 ? "Demain" : week, num, month };
}

/** Couleurs des rendez-vous dans l'agenda du tableau de bord, par statut. */
export const STATUS_STYLE: Record<string, string> = {
  requested: "bg-[#FFF6E5] ring-[#F0B44C] text-[#6B4300]",
  confirmed: "bg-[#EAF0FF] ring-[#5B7FE0] text-[#15296B]",
  completed: "bg-[#E8F6EF] ring-[#3FA176] text-[#0F4D31]",
  no_show: "bg-[#FDECEC] ring-[#D65A5A] text-[#7A1717]",
  canceled: "bg-yc-ink/[0.04] ring-yc-ink/15 text-yc-ink-soft line-through",
};
