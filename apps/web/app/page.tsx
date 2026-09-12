import Link from "next/link";
import { getCurrentTenant } from "@/lib/tenant";
import { DEFAULT_LOCALE, t } from "@/lib/i18n";

/**
 * Page d'accueil publique. Si le Host correspond à un tenant actif (sous-domaine ou
 * domaine personnalisé), affiche un placeholder identifiant l'entreprise — le vrai
 * template de site (Phase 1) prendra le relais ici. Sinon, affiche la vitrine
 * plateforme YamaCommerce AI.
 */
export default async function HomePage() {
  const tenant = await getCurrentTenant();

  if (tenant) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-brand text-3xl font-semibold">{tenant.name}</h1>
        <p className="text-[var(--color-muted)]">
          Le site de cette entreprise sera généré à partir de son modèle de secteur en Phase 1 (voir
          docs/09-plan-developpement.md).
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-brand text-4xl font-semibold">YamaCommerce AI</h1>
      <p className="text-lg text-[var(--color-muted)]">{t(DEFAULT_LOCALE, "landing.title")}</p>
      <Link
        href="/connexion"
        className="bg-brand text-brand-foreground rounded-lg px-6 py-3 font-medium transition hover:opacity-90"
      >
        {t(DEFAULT_LOCALE, "landing.cta")}
      </Link>
    </main>
  );
}
