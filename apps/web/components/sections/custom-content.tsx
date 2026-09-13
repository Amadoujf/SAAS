import type { CustomContentParams } from "./content-types";

/**
 * Contenu personnalisé (secteur "custom", §11.7). Sécurité : le HTML fourni n'est
 * PAS interprété (`dangerouslySetInnerHTML` volontairement évité) tant qu'un
 * assainisseur dédié (allowlist de balises) n'a pas été audité — voir « limitations »
 * du rapport de l'étape 3. Le texte est affiché tel quel, échappé par React.
 */
export function CustomContentSection({ params }: { variant: string; params: CustomContentParams }) {
  return (
    <section className="mx-auto max-w-[var(--content-max-width)] whitespace-pre-line px-6 py-24 lg:py-32 lg:px-10 text-[var(--color-text-secondary)] text-[length:var(--text-body-md)]">
      {params.html}
    </section>
  );
}
