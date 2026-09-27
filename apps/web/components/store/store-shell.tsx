import Link from "next/link";
import type { ReactNode } from "react";
import { designTokensToStyle } from "@/lib/design-tokens-to-css";
import type { StoreContext } from "@/lib/storefront/store-context";
import { StoreCartProvider } from "./cart-provider";
import { StoreHeader } from "./store-header";
import { LazyCartDrawer } from "./lazy-cart-drawer";
import { templateFontVariables } from "@/lib/storefront/template-fonts";
import { DemoBanner } from "@/components/demo/demo-banner";

/** Coque des pages commerce d'une boutique : TOUTES les couleurs, polices et rayons
 *  viennent des design tokens de l'entreprise (template + personnalisation). Rien de
 *  l'identité Y-COM n'y fuit, hormis la mention discrète en pied de page. */
export function StoreShell({ store, children }: { store: StoreContext; children: ReactNode }) {
  return (
    <div style={designTokensToStyle(store.tokens)} className={`${templateFontVariables} flex min-h-screen flex-col bg-[var(--color-background)] font-[family-name:var(--font-body)] text-[var(--color-text-primary)]`}>
      <StoreCartProvider>
        <a href="#contenu-boutique" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2">Aller au contenu</a>
        {store.demoData && <DemoBanner kind="boutique" />}
        {store.announcement && (
          <p className="bg-[var(--color-primary)] px-4 py-2 text-center text-[13px] font-medium text-white">
            {store.announcement.href ? <Link href={store.announcement.href} className="underline-offset-4 hover:underline">{store.announcement.text}</Link> : store.announcement.text}
          </p>
        )}
        <StoreHeader tenantName={store.tenantName} logoUrl={store.logoUrl} categories={store.categories} layout={store.layout} />
        <main id="contenu-boutique" className="flex-1">{children}</main>
        <footer className="mt-16 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="mx-auto grid max-w-[var(--content-max-width,1280px)] gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6">
            <div>
              <p className="font-[family-name:var(--font-heading)] text-lg font-semibold">{store.tenantName}</p>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">Paiement à la livraison, Wave ou Orange Money. Livraison au Sénégal.</p>
            </div>
            <nav aria-label="Pied de page" className="flex flex-col gap-2 text-sm">
              <Link href="/catalogue" className="hover:underline">Catalogue</Link>
              <Link href="/panier" className="hover:underline">Panier</Link>
              <Link href="/suivi" className="hover:underline">Suivre ma commande</Link>
            </nav>
            <p className="text-xs text-[var(--color-text-muted)] sm:text-right">Boutique propulsée par Y-COM</p>
          </div>
        </footer>
        <LazyCartDrawer />
      </StoreCartProvider>
    </div>
  );
}
