import Link from "next/link";
import type { ReactNode } from "react";
import { designTokensToStyle } from "@/lib/design-tokens-to-css";
import type { StoreContext } from "@/lib/storefront/store-context";
import { StoreCartProvider } from "./cart-provider";
import { StoreHeader } from "./store-header";
import { StoreFooter } from "./store-footer";
import { LazyCartDrawer } from "./lazy-cart-drawer";
import { templateFontVariables } from "@/lib/storefront/template-fonts";
import { DemoBanner } from "@/components/demo/demo-banner";

/** Coque des pages commerce d'une boutique : TOUTES les couleurs, polices et rayons
 *  viennent des design tokens de l'entreprise (template + personnalisation). Rien de
 *  l'identité Y-COM n'y fuit, hormis la mention discrète en pied de page. */
export function StoreShell({ store, children, preview = false }: { store: StoreContext; children: ReactNode; preview?: boolean }) {
  return (
    // `data-frame` : les cartes produits et sections s'accordent au cadre du site
    // (variantes Tailwind `group-data-[frame=…]/frame:`).
    <div data-frame={store.layout} style={designTokensToStyle(store.tokens)} className={`group/frame ${templateFontVariables} flex min-h-screen flex-col bg-[var(--color-background)] font-[family-name:var(--font-body)] text-[var(--color-text-primary)]`}>
      <StoreCartProvider preview={preview}>
        <a href="#contenu-boutique" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2">Aller au contenu</a>
        {store.demoData && <DemoBanner kind="boutique" />}
        {store.announcement && (
          <p className="bg-[var(--color-primary)] px-4 py-2 text-center text-[13px] font-medium text-white">
            {store.announcement.href ? <Link href={store.announcement.href} className="underline-offset-4 hover:underline">{store.announcement.text}</Link> : store.announcement.text}
          </p>
        )}
        <StoreHeader tenantName={store.tenantName} logoUrl={store.logoUrl} categories={store.categories} layout={store.layout} />
        <main id="contenu-boutique" className="flex-1">{children}</main>
        <StoreFooter tenantName={store.tenantName} layout={store.layout} categories={store.categories} />
        <LazyCartDrawer />
      </StoreCartProvider>
    </div>
  );
}
