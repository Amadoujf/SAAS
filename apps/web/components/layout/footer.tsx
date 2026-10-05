"use client";

import { useState } from "react";
import { WhatsappIcon } from "@/components/ui/icons";
import { useLocale } from "@/lib/locale-context";
import { LegalLinks } from "@/components/legal/legal-links";

export interface FooterLinkGroup {
  title: string;
  links: { label: string; href: string }[];
}

const PAYMENT_METHODS = ["Wave", "Orange Money", "Free Money", "Visa / Mastercard"];

/**
 * Pied de page complet — refonte du 16 septembre 2026 : logo, histoire courte,
 * navigation, moyens de paiement, newsletter, WhatsApp, mentions légales. Fond sombre
 * (assorti à la section signature) pour clore la page sur une note haut de gamme
 * plutôt qu'un simple bloc de liens gris clair.
 *
 * Langue lue depuis `useLocale()` (voir la revue du 16 septembre 2026, point 2) — le
 * sélecteur de langue de l'en-tête change donc réellement ce texte aussi, pas
 * seulement l'en-tête.
 */
export function Footer({
  shopName,
  groups,
  whatsappNumber,
  tagline,
}: {
  shopName: string;
  groups: FooterLinkGroup[];
  whatsappNumber?: string;
  /** Texte court sous le nom de la boutique — propre à chaque commerce (voir la revue
   *  du 16 septembre 2026, point 1 : aucun texte de marque ne doit être codé en dur
   *  dans un composant partagé entre plusieurs templates). */
  tagline: { fr: string; en: string };
}) {
  const { locale } = useLocale();
  const [subscribed, setSubscribed] = useState(false);

  return (
    <footer className="text-white/70" style={{ backgroundColor: "var(--color-primary)" }}>
      <div className="mx-auto max-w-[var(--content-max-width)] px-6 py-20 lg:px-10">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[1.3fr_2fr_1.3fr]">
          <div>
            <p className="font-[family-name:var(--font-heading)] text-[length:var(--text-heading-sm)] text-white">
              {shopName}
            </p>
            <p className="mt-4 max-w-xs text-[length:var(--text-body-sm)]">
              {locale === "en" ? tagline.en : tagline.fr}
            </p>
            {whatsappNumber && (
              <a
                href={`https://wa.me/${whatsappNumber.replace(/[^\d]/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex items-center gap-2 text-[length:var(--text-body-sm)] text-white transition hover:opacity-80"
              >
                <WhatsappIcon className="h-5 w-5" />
                {locale === "en" ? "Chat with us" : "Discuter avec nous"}
              </a>
            )}
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {groups.map((group) => (
              <div key={group.title}>
                <p className="mb-4 text-[length:var(--text-body-xs)] uppercase tracking-[0.1em] text-white">
                  {group.title}
                </p>
                <ul className="flex flex-col gap-2.5">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        className="text-[length:var(--text-body-sm)] transition hover:text-white"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div>
            <p className="text-[length:var(--text-body-xs)] uppercase tracking-[0.1em] text-white">
              {locale === "en" ? "Stay informed" : "Restez informée"}
            </p>
            {subscribed ? (
              <p className="mt-4 text-[length:var(--text-body-sm)] text-white">
                ✓ {locale === "en" ? "Thank you!" : "Merci !"}
              </p>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setSubscribed(true);
                }}
                className="mt-4 flex border-b border-white/30 pb-2"
              >
                <input
                  type="email"
                  required
                  placeholder={locale === "en" ? "Email address" : "Adresse e-mail"}
                  className="w-full bg-transparent text-[length:var(--text-body-sm)] text-white outline-none placeholder:text-white/40"
                />
                <button
                  type="submit"
                  className="shrink-0 text-[length:var(--text-body-sm)] text-white"
                >
                  →
                </button>
              </form>
            )}

            <p className="mt-10 text-[length:var(--text-body-xs)] uppercase tracking-[0.1em] text-white">
              {locale === "en" ? "Secure payment" : "Paiement sécurisé"}
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((method) => (
                <li
                  key={method}
                  className="border border-white/20 px-3 py-1.5 text-[length:var(--text-body-xs)]"
                >
                  {method}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-white/15 pt-8 text-[length:var(--text-body-xs)] sm:flex-row sm:items-center">
          <p>
            © {new Date().getFullYear()} {shopName}.{" "}
            {locale === "en" ? "All rights reserved." : "Tous droits réservés."}
          </p>
          <p>
            {locale === "en"
              ? "Senegal — French / English / Wolof"
              : "Sénégal — Français / English / Wolof"}
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-8"><LegalLinks /></div>
    </footer>
  );
}
