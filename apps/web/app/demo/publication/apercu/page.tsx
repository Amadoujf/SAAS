import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DEFAULT_DESIGN_TOKENS } from "@yamacommerce/design-tokens";
import { validateTemplateManifest } from "@yamacommerce/templates";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { RenderTemplatePage } from "@/components/render-template-page";
import { SiteShell } from "@/components/site-shell";
import { getDemoPublishingSnapshot } from "@/lib/publishing/demo-publishing-context";

/**
 * "Voir le site" de la démonstration de publication — rend la version PUBLIÉE
 * uniquement (jamais le brouillon, voir demo-publishing-context.ts), pour illustrer
 * visuellement « le visiteur doit voir soit l'ancienne version complète, soit la
 * nouvelle version complète » sans dépendre d'un vrai domaine tenant.
 */
export const metadata: Metadata = {
  title: "Site publié — démonstration",
  robots: { index: false, follow: false },
};

export default function PublicationDemoPreviewPage() {
  const { published } = getDemoPublishingSnapshot();
  if (!published) notFound();

  const manifest = validateTemplateManifest({
    pages: published.pages.map((page) => ({
      slug: page.slug,
      title: page.title,
      isHome: page.isHome,
      sections: page.blocks,
    })),
  });
  const homePage = manifest.pages.find((page) => page.isHome) ?? manifest.pages[0]!;

  return (
    <SiteShell tokens={DEFAULT_DESIGN_TOKENS} animationLevel={DEFAULT_DESIGN_TOKENS.animation.level}>
      <Header shopName="Boutique de démonstration" navItems={[]} />
      <main>
        <RenderTemplatePage
          page={homePage}
          tokens={DEFAULT_DESIGN_TOKENS}
          animationLevel={DEFAULT_DESIGN_TOKENS.animation.level}
          locale="fr"
        />
      </main>
      <Footer shopName="Boutique de démonstration" tagline={{ fr: "", en: "" }} groups={[]} />
    </SiteShell>
  );
}
