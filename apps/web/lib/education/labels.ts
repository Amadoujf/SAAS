/** Libellés et formats de l'éducation — partagés par le tableau de bord, le site public
 *  et les espaces famille / élève (utilisables côté navigateur : aucun accès base). */
import { MANUAL_METHOD_LABELS } from "@/lib/payments/labels";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export const CATEGORY_LABELS: Record<string, string> = { school: "Scolarité", training: "Formation professionnelle", language: "Langues", tutoring: "Soutien scolaire", other: "Autre" };
export const FORMAT_LABELS: Record<string, string> = { onsite: "En présentiel", online: "En ligne", hybrid: "Hybride" };
export const AUDIENCE_LABELS: Record<string, string> = { children: "Enfants", teens: "Adolescents", adults: "Adultes", all: "Tous publics" };
export const RELATION_LABELS: Record<string, string> = { parent: "Parent", guardian: "Tuteur", self: "L'élève lui-même" };

export const ENROLLMENT_LABELS: Record<string, { label: string; tone: Tone; guest: string }> = {
  requested: { label: "À confirmer", tone: "warning", guest: "Demande reçue : l'établissement vous recontacte pour confirmer la classe." },
  confirmed: { label: "Inscrit", tone: "success", guest: "Inscription confirmée." },
  completed: { label: "Terminée", tone: "neutral", guest: "Formation terminée." },
  canceled: { label: "Annulée", tone: "neutral", guest: "Inscription annulée." },
  no_show: { label: "Absent", tone: "danger", guest: "Inscription non honorée." },
};

export const INSTALLMENT_LABELS: Record<string, { label: string; tone: Tone }> = {
  paid: { label: "Réglée", tone: "success" },
  partial: { label: "Partiellement réglée", tone: "info" },
  due: { label: "À venir", tone: "neutral" },
  overdue: { label: "En retard", tone: "danger" },
};

export const ATTENDANCE_LABELS: Record<string, { label: string; short: string; tone: Tone }> = {
  present: { label: "Présent", short: "P", tone: "success" },
  absent: { label: "Absent", short: "A", tone: "danger" },
  late: { label: "En retard", short: "R", tone: "warning" },
  excused: { label: "Absence justifiée", short: "J", tone: "info" },
};

export const PAYMENT_METHOD_LABELS = MANUAL_METHOD_LABELS;

const nf = new Intl.NumberFormat("fr-FR");
export const formatXof = (n: number | null | undefined) => (n == null ? "Sur devis" : `${nf.format(n)} FCFA`);
export const formatNumber = (n: number) => nf.format(n);
export const formatScore = (n: number | null) => (n == null ? "—" : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n));
export const clockLabel = (m: number) => `${Math.floor(m / 60) % 24} h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`;
export const WEEKDAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
export const WEEKDAYS_SHORT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
export const dateLabel = (d: Date | string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }) =>
  new Intl.DateTimeFormat("fr-FR", { ...opts, timeZone: "UTC" }).format(typeof d === "string" ? new Date(`${d.slice(0, 10)}T12:00:00Z`) : d);
export const shortDate = (d: Date | string) => dateLabel(d, { day: "numeric", month: "short" });
export const dateTimeIn = (d: Date | string, tz: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: tz }).format(new Date(d));

export type Slot = { weekday: number; startMinute: number; endMinute: number };
export const scheduleText = (schedule: Slot[]) =>
  schedule.length ? [...schedule].sort((a, b) => ((a.weekday + 6) % 7) - ((b.weekday + 6) % 7) || a.startMinute - b.startMinute).map((s) => `${WEEKDAYS_SHORT[s.weekday]} ${clockLabel(s.startMinute)}–${clockLabel(s.endMinute)}`).join(" · ") : "Horaires communiqués à l'inscription";
