"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { formatFcfa } from "@/lib/format";
import type { Locale } from "@/lib/i18n";

/**
 * Devise d'affichage — ajouté pour « Boutique africaine contemporaine » (Teranga
 * Atelier, 20 septembre 2026) : vente au Sénégal ET à la diaspora, donc un sélecteur de
 * devise réel (pas décoratif) sur l'en-tête, qui reconvertit tous les prix affichés.
 *
 * Les montants restent stockés en FCFA partout dans les données (source de vérité
 * unique, voir docs/01 §1.6) — seule la PRÉSENTATION change ici, jamais le prix stocké.
 *
 * Limitation assumée : taux de change FIXES de démonstration (pas d'appel à une API de
 * taux en temps réel) — voir le rapport de livraison de ce template. Le taux EUR est le
 * taux réel de parité fixe FCFA/EUR (accord BCEAO) ; USD/CAD sont indicatifs.
 */
export const SUPPORTED_CURRENCIES = ["FCFA", "EUR", "CAD", "USD"] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

const FCFA_PER_UNIT: Record<Currency, number> = {
  FCFA: 1,
  EUR: 655.957,
  USD: 610,
  CAD: 450,
};

const ISO_CODE: Partial<Record<Currency, string>> = { EUR: "EUR", USD: "USD", CAD: "CAD" };
const NUMBER_LOCALE: Record<Locale, string> = { fr: "fr-SN", en: "en-US", wo: "fr-SN" };

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  /** Convertit et formate un montant stocké en FCFA vers la devise active. */
  formatPrice: (amountFcfa: number, locale?: Locale) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({
  children,
  initialCurrency = "FCFA",
}: {
  children: React.ReactNode;
  initialCurrency?: Currency;
}) {
  const [currency, setCurrency] = useState<Currency>(initialCurrency);

  const value = useMemo<CurrencyContextValue>(
    () => ({
      currency,
      setCurrency,
      formatPrice: (amountFcfa: number, locale: Locale = "fr") => {
        if (currency === "FCFA") return formatFcfa(amountFcfa, locale);
        const converted = amountFcfa / FCFA_PER_UNIT[currency];
        const isoCode = ISO_CODE[currency]!;
        return new Intl.NumberFormat(NUMBER_LOCALE[locale], {
          style: "currency",
          currency: isoCode,
          maximumFractionDigits: converted >= 100 ? 0 : 2,
        }).format(converted);
      },
    }),
    [currency],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error(
      "useCurrency() doit être appelé sous <CurrencyProvider> (voir components/site-shell.tsx).",
    );
  }
  return ctx;
}
