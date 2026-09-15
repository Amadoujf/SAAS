import Link from "next/link";
import { headers } from "next/headers";
import { getCurrentTenant } from "@/lib/tenant";
import { DEFAULT_LOCALE, t } from "@/lib/i18n";
import { resolvePublicSite } from "@/lib/rendering/resolve-public-site";
import { PublicSitePage } from "@/components/public-site-page";
import { PublicSiteSuspended } from "@/components/public-site-suspended";

/**
 * Page d'accueil publique — voir docs/12 §12.3, « RENDU PUBLIC ». Si le Host résout à
 * un tenant ACTIF avec une version PUBLIÉE, rend sa page d'accueil réelle (jamais un
 * brouillon, voir `resolvePublicSite`/`resolveTenantSiteForRendering`). Un tenant
 * suspendu reçoit un écran dédié ; un tenant sans site publié (ou inconnu) reçoit la
 * vitrine plateforme YamaCommerce AI — un visiteur qui atterrit ici avant que
 * l'entreprise ait publié quoi que ce soit ne doit jamais voir une erreur.
 */
export default async function HomePage() {
  const tenant = await getCurrentTenant();
  if (tenant) {
    const headerList = await headers();
    const host = headerList.get("host") ?? "";
    const resolution = await resolvePublicSite(host);
    if (resolution.status === "suspended") {
      return <PublicSiteSuspended tenantName={resolution.tenantName} />;
    }
    if (resolution.status === "ok") {
      return <PublicSitePage tenantName={resolution.tenantName} site={resolution.site} />;
    }
    // "not_found" (déjà exclu par `tenant` non nul) ou "not_published" : repli sur le
    // placeholder existant plutôt qu'une erreur, en attendant la première publication.
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-brand text-3xl font-semibold">{tenant.name}</h1>
        <p className="text-[var(--color-muted)]">
          Le site de cette entreprise n&apos;a pas encore été publié.
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
