import type { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { RenderTemplatePage } from "@/components/render-template-page";
import { SiteShell } from "@/components/site-shell";
import {
  DEMO_MANIFEST,
  DEMO_RESOLVED_CONTENT,
  LUXURY_MINIMAL_DESIGN_TOKENS,
  SHOP_NAME,
} from "@/lib/demo/luxury-minimal-template";

/**
 * Démonstration du moteur de rendu — template « Luxe minimaliste » (voir la demande
 * de validation du 13 septembre 2026, « premier rendu visuel »). Page 100% statique
 * (aucune base de données requise) pour rester vérifiable dans n'importe quel
 * environnement, y compris sans PostgreSQL.
 *
 * SEO : métadonnées générées à partir du contenu de démonstration — voir l'exigence
 * « supporter le référencement SEO » du moteur de rendu.
 */
export const metadata: Metadata = {
  title: `${SHOP_NAME} — Maroquinerie & prêt-à-porter sénégalais`,
  description:
    "Maroquinerie et prêt-à-porter façonnés à Dakar. Livraison au Sénégal, paiement Wave, Orange Money, Free Money et carte.",
};

export default function LuxuryMinimalDemoPage() {
  const homePage = DEMO_MANIFEST.pages.find((page) => page.isHome) ?? DEMO_MANIFEST.pages[0]!;

  return (
    <SiteShell
      tokens={LUXURY_MINIMAL_DESIGN_TOKENS}
      animationLevel={LUXURY_MINIMAL_DESIGN_TOKENS.animation.level}
    >
      <Header
        shopName={SHOP_NAME}
        locale="fr"
        cartCount={0}
        navItems={[
          { label: "Maroquinerie", href: "/catalogue/maroquinerie" },
          { label: "Prêt-à-porter", href: "/catalogue/pret-a-porter" },
          { label: "Bijoux", href: "/catalogue/bijoux" },
          { label: "Contact", href: "#contact" },
        ]}
      />
      <main>
        <RenderTemplatePage
          page={homePage}
          tokens={LUXURY_MINIMAL_DESIGN_TOKENS}
          animationLevel={LUXURY_MINIMAL_DESIGN_TOKENS.animation.level}
          locale="fr"
          resolvedContent={DEMO_RESOLVED_CONTENT}
        />
      </main>
      <Footer
        shopName={SHOP_NAME}
        locale="fr"
        groups={[
          {
            title: "Boutique",
            links: [
              { label: "Toute la collection", href: "/catalogue" },
              { label: "Nouveautés", href: "/catalogue?tri=nouveaute" },
            ],
          },
          {
            title: "Aide",
            links: [
              { label: "Livraison", href: "/livraison" },
              { label: "Retours", href: "/retours" },
              { label: "Contact", href: "#contact" },
            ],
          },
          {
            title: "Légal",
            links: [
              { label: "Mentions légales", href: "/mentions-legales" },
              { label: "Confidentialité", href: "/confidentialite" },
            ],
          },
        ]}
      />
    </SiteShell>
  );
}
