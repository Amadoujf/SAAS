"use client";

import { createContext, useContext, useState } from "react";
import type { Locale } from "@/lib/i18n";

/**
 * Langue active de l'interface (en-tête, pied de page, libellés de bouton) — voir la
 * revue du 16 septembre 2026, point 2 : le sélecteur de langue devait cesser d'être un
 * bouton silencieux. Change réellement les chaînes de l'interface (`Header`, `Footer`,
 * tout ce qui utilise `t(locale, ...)` ou un ternaire `locale === "en" ? ... : ...`).
 *
 * Limitation assumée : le CONTENU des sections (titres de produits, texte du
 * manifeste, etc.) reste en français, car les données de démonstration ne sont
 * rédigées qu'en français — les traduire intégralement est un travail de contenu
 * (Phase 2+), pas de ce composant. Voir le rapport de refonte.
 */
interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  children,
  initialLocale = "fr",
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  return <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale() doit être appelé sous <LocaleProvider> (voir components/site-shell.tsx).");
  return ctx;
}
