"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { SiteShell } from "@/components/site-shell";
import { Button } from "@/components/ui/button";
import {
  DAKAR_DISTRIBUTION_DESIGN_TOKENS,
  DEMO_FOOTER_GROUPS,
  DEMO_NAV_ITEMS,
  DEMO_SEARCH_SUGGESTIONS,
  SHOP_NAME,
  SHOP_TAGLINE,
  WHATSAPP_NUMBER,
} from "@/lib/demo/dakar-distribution-pro-template";

/**
 * Inscription revendeur — formulaire RÉELLEMENT fonctionnel côté client (validation
 * native du navigateur, état de soumission, confirmation) mais SANS validation par un
 * administrateur derrière (pas de backend dans cette démonstration statique, voir la
 * note de limitation en tête de lib/demo/dakar-distribution-pro-template.ts) — un vrai
 * commercial ne se manifestera pas, c'est explicitement indiqué dans la confirmation.
 */
export default function DevenirRevendeurPage() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <SiteShell
      tokens={DAKAR_DISTRIBUTION_DESIGN_TOKENS}
      animationLevel={DAKAR_DISTRIBUTION_DESIGN_TOKENS.animation.level}
    >
      <Header
        shopName={SHOP_NAME}
        navItems={DEMO_NAV_ITEMS}
        searchSuggestions={DEMO_SEARCH_SUGGESTIONS}
      />
      <main style={{ paddingTop: "var(--header-height)" }}>
        <div className="mx-auto max-w-2xl px-6 py-16 lg:py-24">
          <h1 className="font-[family-name:var(--font-heading)] text-[length:var(--text-heading-lg)] text-[var(--color-text-primary)]">
            Devenir revendeur agréé
          </h1>
          <p className="mt-3 text-[length:var(--text-body-md)] text-[var(--color-text-secondary)]">
            Complétez ce formulaire pour demander l&apos;ouverture d&apos;un compte professionnel.
            Votre demande sera examinée par notre équipe avant activation.
          </p>

          {submitted ? (
            <div className="mt-10 rounded-[var(--card-radius)] border border-[var(--color-success)] bg-[var(--color-surface)] p-6">
              <p className="font-semibold text-[var(--color-success)]">Demande envoyée</p>
              <p className="mt-2 text-[length:var(--text-body-sm)] text-[var(--color-text-secondary)]">
                Merci — un commercial Dakar Distribution Pro examinera votre dossier et vous
                recontactera sous 24 à 48h ouvrées pour valider votre compte.
              </p>
            </div>
          ) : (
            <form
              className="mt-10 flex flex-col gap-5"
              onSubmit={(event) => {
                event.preventDefault();
                setSubmitted(true);
              }}
            >
              <Field label="Raison sociale" id="company" required />
              <Field label="Numéro RCCM / NINEA" id="registry" required />
              <Field label="Nom du contact" id="contact-name" required />
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label="Téléphone" id="phone" type="tel" required />
                <Field label="E-mail professionnel" id="email" type="email" required />
              </div>
              <Field label="Adresse de l'entreprise" id="address" required />
              <div>
                <label
                  htmlFor="volume"
                  className="mb-1.5 block text-[length:var(--text-body-sm)] text-[var(--color-text-secondary)]"
                >
                  Volume d&apos;achat mensuel estimé
                </label>
                <select
                  id="volume"
                  required
                  className="w-full border border-[var(--color-border)] bg-transparent px-3 py-2.5 text-[var(--color-text-primary)] outline-none [border-radius:var(--input-radius)]"
                >
                  <option value="">Sélectionner...</option>
                  <option value="lt-500k">Moins de 500 000 FCFA</option>
                  <option value="500k-2m">500 000 — 2 000 000 FCFA</option>
                  <option value="gt-2m">Plus de 2 000 000 FCFA</option>
                </select>
              </div>
              <Button type="submit" className="mt-2 w-full justify-center">
                Soumettre ma demande
              </Button>
            </form>
          )}
        </div>
      </main>
      <Footer
        shopName={SHOP_NAME}
        whatsappNumber={WHATSAPP_NUMBER}
        tagline={SHOP_TAGLINE}
        groups={DEMO_FOOTER_GROUPS}
      />
    </SiteShell>
  );
}

function Field({
  label,
  id,
  type = "text",
  required,
}: {
  label: string;
  id: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-[length:var(--text-body-sm)] text-[var(--color-text-secondary)]"
      >
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        className="w-full border border-[var(--color-border)] bg-transparent px-3 py-2.5 text-[var(--color-text-primary)] outline-none [border-radius:var(--input-radius)]"
      />
    </div>
  );
}
