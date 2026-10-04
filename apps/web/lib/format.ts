import type { Locale } from "./i18n";

const NUMBER_LOCALE: Record<Locale, string> = { fr: "fr-SN", en: "en-US", wo: "fr-SN" };

/** Formate un montant en FCFA — voir docs/01 §1.6 (« FCFA partout, `1 250 000 FCFA` »). */
export function formatFcfa(amount: number, locale: Locale = "fr"): string {
  const formatted = new Intl.NumberFormat(NUMBER_LOCALE[locale], {
    maximumFractionDigits: 0,
  }).format(amount);
  return `${formatted} FCFA`;
}

/** Montant nu (sans unité), chiffres groupés à la sénégalaise. */
export function formatAmount(amount: number): string {
  return new Intl.NumberFormat("fr-SN", { maximumFractionDigits: 0 }).format(amount);
}

export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export function formatRelative(date: Date | string, now = new Date()): string {
  const diff = (now.getTime() - new Date(date).getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86_400) return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 7 * 86_400) return `il y a ${Math.floor(diff / 86_400)} j`;
  return formatDate(date);
}
