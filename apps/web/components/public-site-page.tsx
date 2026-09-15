import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { RenderTemplatePage } from "@/components/render-template-page";
import { SiteShell } from "@/components/site-shell";
import type { TenantSiteRenderProps } from "@/lib/rendering/resolve-tenant-site";

/**
 * Composition Header + `RenderTemplatePage` + Footer pour UN tenant réel résolu par
 * hôte — voir docs/12 §12.3, « RENDU PUBLIC ». Partagée par `app/page.tsx` (page
 * d'accueil) et `app/[slug]/page.tsx` (toute autre page) pour ne jamais dupliquer/faire
 * diverger cette composition entre les deux.
 *
 * Ne résout AUCUNE donnée catalogue dynamique (produits, etc.) pour les sections qui
 * en dépendraient : `resolvedContent` reste vide — la résolution du contenu catalogue
 * par tenant est hors périmètre de cette étape (publication de la STRUCTURE du site,
 * pas encore l'intégration catalogue par section), voir le point d'arrêt explicite de
 * cette phase avant l'assistant de domaines personnalisés.
 */
export function PublicSitePage({
  tenantName,
  site,
  slug,
}: {
  tenantName: string;
  site: TenantSiteRenderProps;
  /** `undefined` = page d'accueil. */
  slug?: string;
}) {
  const page = slug
    ? site.manifest.pages.find((candidate) => candidate.slug === slug)
    : site.manifest.pages.find((candidate) => candidate.isHome) ?? site.manifest.pages[0];

  if (!page) notFound();

  const navItems = site.manifest.pages
    .filter((candidate) => !candidate.isHome)
    .map((candidate) => ({ label: candidate.title, href: `/${candidate.slug}` }));

  return (
    <SiteShell tokens={site.tokens} animationLevel={site.animationLevel}>
      <Header shopName={tenantName} navItems={navItems} />
      <main>
        <RenderTemplatePage
          page={page}
          tokens={site.tokens}
          animationLevel={site.animationLevel}
          locale="fr"
        />
      </main>
      <Footer
        shopName={tenantName}
        tagline={{ fr: "", en: "" }}
        groups={[
          {
            title: "Pages",
            links: site.manifest.pages.map((candidate) => ({
              label: candidate.title,
              href: candidate.isHome ? "/" : `/${candidate.slug}`,
            })),
          },
        ]}
      />
    </SiteShell>
  );
}
