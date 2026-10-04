import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { designTokensToStyle } from "@/lib/design-tokens-to-css";
import type { TravelContext } from "@/lib/travel/travel-context";
import { templateFontVariables } from "@/lib/storefront/template-fonts";
import { DemoBanner } from "@/components/demo/demo-banner";
import { TravelHeader } from "./travel-header";

/** Coque du site d'une agence de voyage : couleurs, polices et rayons de SON template et
 *  de SA personnalisation. Rien de l'identité Y-COM, hormis la mention en pied de page. */
export function TravelShell({ travel, children }: { travel: TravelContext; children: ReactNode }) {
  const { contact } = travel;
  const whatsapp = contact.whatsapp?.replace(/[^\d]/g, "");
  return (
    <div style={designTokensToStyle(travel.tokens)} className={`${templateFontVariables} flex min-h-screen flex-col bg-[var(--color-background)] font-[family-name:var(--font-body)] text-[var(--color-text-primary)]`}>
      <a href="#contenu-agence" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2">Aller au contenu</a>
      {travel.demoData && <DemoBanner kind="voyage" />}
      {travel.content.announcement && (
        <p className="bg-[var(--color-accent-primary)] px-4 py-2 text-center text-[13px] font-medium text-white">
          {travel.content.announcement.href ? <Link href={travel.content.announcement.href} className="underline-offset-4 hover:underline">{travel.content.announcement.text}</Link> : travel.content.announcement.text}
        </p>
      )}
      <Suspense fallback={<div className="h-[73px] border-b border-[var(--color-border)]" />}>
        <TravelHeader tenantName={travel.tenantName} logoUrl={travel.logoUrl} phone={contact.phone} />
      </Suspense>
      <main id="contenu-agence" className="flex-1">{children}</main>
      <footer className="mt-24 bg-[var(--color-primary)] text-white">
        <div className="mx-auto grid max-w-[var(--content-max-width,1320px)] gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="font-[family-name:var(--font-heading)] text-3xl italic">{travel.tenantName}</p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/70">Voyages préparés au Sénégal : départs confirmés, dossiers suivis, un conseiller joignable du départ au retour.</p>
          </div>
          <nav aria-label="Pied de page" className="flex flex-col gap-2.5 text-sm text-white/85">
            <Link href="/voyages" className="hover:text-white">Tous les voyages</Link>
            <Link href="/voyages?type=pilgrimage" className="hover:text-white">Pèlerinages</Link>
            <Link href="/voyages?type=stay" className="hover:text-white">Séjours</Link>
            <Link href="/voyages?type=circuit" className="hover:text-white">Circuits</Link>
          </nav>
          <address className="flex flex-col gap-2.5 text-sm not-italic text-white/85">
            {contact.address && <span>{contact.address}</span>}
            {contact.phone && <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="hover:text-white">{contact.phone}</a>}
            {whatsapp && <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="hover:text-white">WhatsApp</a>}
            {contact.email && <a href={`mailto:${contact.email}`} className="hover:text-white">{contact.email}</a>}
          </address>
        </div>
        <p className="border-t border-white/10 px-5 py-4 text-center text-xs text-white/50">Site propulsé par Y-COM</p>
      </footer>
    </div>
  );
}
