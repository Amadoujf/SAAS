"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
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
 * Demande de devis — pré-remplit la référence produit depuis `?produit=SKU` quand la
 * demande vient du bouton « Demander un devis » d'une fiche produit (voir
 * b2b-product-detail.tsx). Soumission réellement fonctionnelle côté client (état +
 * confirmation), sans traitement serveur réel — voir la note de limitation en tête de
 * lib/demo/dakar-distribution-pro-template.ts.
 */
export default function DemandeDevisPage() {
  return (
    <Suspense fallback={null}>
      <DemandeDevisForm />
    </Suspense>
  );
}

function DemandeDevisForm() {
  const searchParams = useSearchParams();
  const prefilledSku = searchParams.get("produit") ?? "";
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
            Demander un devis
          </h1>
          <p className="mt-3 text-[length:var(--text-body-md)] text-[var(--color-text-secondary)]">
            Pour une commande volumineuse ou un besoin spécifique, notre équipe commerciale vous
            prépare un devis personnalisé sous 24h ouvrées.
          </p>

          {submitted ? (
            <div className="mt-10 rounded-[var(--card-radius)] border border-[var(--color-success)] bg-[var(--color-surface)] p-6">
              <p className="font-semibold text-[var(--color-success)]">Demande de devis envoyée</p>
              <p className="mt-2 text-[length:var(--text-body-sm)] text-[var(--color-text-secondary)]">
                Vous recevrez une réponse par e-mail sous 24h ouvrées.
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
              <div>
                <label
                  htmlFor="company"
                  className="mb-1.5 block text-[length:var(--text-body-sm)] text-[var(--color-text-secondary)]"
                >
                  Raison sociale
                </label>
                <input
                  id="company"
                  required
                  className="w-full border border-[var(--color-border)] bg-transparent px-3 py-2.5 text-[var(--color-text-primary)] outline-none [border-radius:var(--input-radius)]"
                />
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-1.5 block text-[length:var(--text-body-sm)] text-[var(--color-text-secondary)]"
                  >
                    E-mail
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    className="w-full border border-[var(--color-border)] bg-transparent px-3 py-2.5 text-[var(--color-text-primary)] outline-none [border-radius:var(--input-radius)]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="phone"
                    className="mb-1.5 block text-[length:var(--text-body-sm)] text-[var(--color-text-secondary)]"
                  >
                    Téléphone
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    required
                    className="w-full border border-[var(--color-border)] bg-transparent px-3 py-2.5 text-[var(--color-text-primary)] outline-none [border-radius:var(--input-radius)]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="sku"
                    className="mb-1.5 block text-[length:var(--text-body-sm)] text-[var(--color-text-secondary)]"
                  >
                    Référence produit (optionnel)
                  </label>
                  <input
                    id="sku"
                    defaultValue={prefilledSku}
                    className="w-full border border-[var(--color-border)] bg-transparent px-3 py-2.5 text-[var(--color-text-primary)] outline-none [border-radius:var(--input-radius)]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="qty"
                    className="mb-1.5 block text-[length:var(--text-body-sm)] text-[var(--color-text-secondary)]"
                  >
                    Quantité souhaitée
                  </label>
                  <input
                    id="qty"
                    type="number"
                    min={1}
                    className="w-full border border-[var(--color-border)] bg-transparent px-3 py-2.5 text-[var(--color-text-primary)] outline-none [border-radius:var(--input-radius)]"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="message"
                  className="mb-1.5 block text-[length:var(--text-body-sm)] text-[var(--color-text-secondary)]"
                >
                  Détails de la demande
                </label>
                <textarea
                  id="message"
                  rows={4}
                  className="w-full border border-[var(--color-border)] bg-transparent px-3 py-2.5 text-[var(--color-text-primary)] outline-none [border-radius:var(--input-radius)]"
                />
              </div>
              <Button type="submit" className="mt-2 w-full justify-center">
                Envoyer la demande de devis
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
