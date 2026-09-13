import type { Locale } from "./i18n";

const NUMBER_LOCALE: Record<Locale, string> = { fr: "fr-SN", en: "en-US", wo: "fr-SN" };

/** Formate un montant en FCFA — voir docs/01 §1.6 (« FCFA partout, `1 250 000 FCFA` »). */
export function formatFcfa(amount: number, locale: Locale = "fr"): string {
  const formatted = new Intl.NumberFormat(NUMBER_LOCALE[locale], {
    maximumFractionDigits: 0,
  }).format(amount);
  return `${formatted} FCFA`;
}
