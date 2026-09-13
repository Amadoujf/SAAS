import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { SiteShell } from "@/components/site-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { ProductGridSkeleton } from "@/components/ui/product-grid-skeleton";
import {
  DEMO_FOOTER_GROUPS,
  DEMO_NAV_ITEMS,
  DEMO_SEARCH_SUGGESTIONS,
  SHOP_NAME,
  SHOP_TAGLINE,
  TERANGA_ATELIER_DESIGN_TOKENS,
  WHATSAPP_NUMBER,
} from "@/lib/demo/teranga-atelier-template";

/**
 * Page de documentation interne — pas un lien de navigation public — pour capturer les
 * états "vide" et "chargement" demandés dans la checklist de captures du 20 septembre
 * 2026. Réutilise les VRAIS composants partagés (`EmptyState`, `ProductGridSkeleton`),
 * ce ne sont pas des maquettes distinctes des sections réelles.
 */
export default function EtatsPreviewPage() {
  return (
    <SiteShell
      tokens={TERANGA_ATELIER_DESIGN_TOKENS}
      animationLevel={TERANGA_ATELIER_DESIGN_TOKENS.animation.level}
    >
      <Header
        shopName={SHOP_NAME}
        navItems={DEMO_NAV_ITEMS}
        searchSuggestions={DEMO_SEARCH_SUGGESTIONS}
        showCurrencySelector
      />
      <main className="mx-auto max-w-[var(--content-max-width)] px-6 pb-24 pt-32 lg:px-10 lg:pt-40">
        <section>
          <h2 className="mb-6 font-[family-name:var(--font-heading)] text-[length:var(--text-heading-sm)] text-[var(--color-text-primary)]">
            État vide (aucun résultat)
          </h2>
          <div className="rounded-[var(--card-radius)] border border-[var(--color-border)]">
            <EmptyState
              title="Aucun produit à afficher"
              description="Aucune pièce ne correspond à cette recherche pour le moment."
              actionLabel="Voir toute la collection"
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
