import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { SiteShell } from "@/components/site-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { ProductGridSkeleton } from "@/components/ui/product-grid-skeleton";
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
 * Page de documentation interne (voir la même page sur Teranga Atelier) — capture des
 * états "vide" et "chargement" pour ce template B2B.
 */
export default function EtatsPreviewPage() {
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
      <main
        style={{ paddingTop: "var(--header-height)" }}
        className="mx-auto max-w-[var(--content-max-width)] px-6 py-16 lg:px-10"
      >
        <section>
          <h2 className="mb-6 font-[family-name:var(--font-heading)] text-[length:var(--text-heading-sm)] text-[var(--color-text-primary)]">
            État vide (aucun résultat de recherche)
          </h2>
          <div className="rounded-[var(--card-radius)] border border-[var(--color-border)]">
            <EmptyState
              title="Aucun produit ne correspond à cette recherche"
              description="Essayez une autre référence ou contactez votre commercial assigné."
              actionLabel="Voir tout le catalogue"
              actionHref="/catalogue"
            />
          </div>
        </section>

        <section className="mt-16">
          <h2 className="mb-6 font-[family-name:var(--font-heading)] text-[length:var(--text-heading-sm)] text-[var(--color-text-primary)]">
            État de chargement
          </h2>
          <ProductGridSkeleton count={4} />
        </section>
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
