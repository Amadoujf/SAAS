import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { designTokensToStyle } from "@/lib/design-tokens-to-css";
import type { SalonContext } from "@/lib/salon/salon-context";
import { templateFontVariables } from "@/lib/storefront/template-fonts";
import { DemoBanner } from "@/components/demo/demo-banner";
import { SalonHeader } from "./salon-header";
import { LegalLinks } from "@/components/legal/legal-links";

/** Coque du site d'un salon : couleurs, polices et rayons de SON template et de SA
 *  personnalisation. Rien de l'identité Y-COM, hormis la mention en pied de page. */
export function SalonShell({ salon, children, bookingBar = true }: { salon: SalonContext; children: ReactNode; bookingBar?: boolean }) {
  const { contact } = salon;
  const whatsapp = contact.whatsapp?.replace(/[^\d]/g, "");
  return (
    <div style={designTokensToStyle(salon.tokens)} className={`${templateFontVariables} flex min-h-screen flex-col bg-[var(--color-background)] font-[family-name:var(--font-body)] text-[var(--color-text-primary)]`}>
      <a href="#contenu-salon" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2">Aller au contenu</a>
      {salon.demoData && <DemoBanner kind="salon" />}
      {salon.content.announcement && (
        <p className="bg-[var(--color-primary)] px-4 py-2 text-center text-[13px] font-medium text-white/90">
          {salon.content.announcement.href ? <Link href={salon.content.announcement.href} className="underline-offset-4 hover:underline">{salon.content.announcement.text}</Link> : salon.content.announcement.text}
        </p>
      )}
      <Suspense fallback={<div className="h-[76px] border-b border-[var(--color-border)]" />}>
        <SalonHeader tenantName={salon.tenantName} logoUrl={salon.logoUrl} phone={contact.phone} />
      </Suspense>
      <main id="contenu-salon" className="flex-1">{children}</main>
      <footer className="mt-24 bg-[var(--color-primary)] pb-24 text-white lg:pb-0">
        <div className="mx-auto grid max-w-[var(--content-max-width,1280px)] gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="font-[family-name:var(--font-heading)] text-[34px] italic leading-none">{salon.tenantName}</p>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/65">Rendez-vous en ligne à toute heure : l&apos;horaire affiché est réellement libre, et vous recevez aussitôt votre confirmation.</p>
          </div>
          <nav aria-label="Pied de page" className="flex flex-col gap-2.5 text-sm text-white/85">
            <Link href="/reserver" className="hover:text-white">Prendre rendez-vous</Link>
            <Link href="/#carte" className="hover:text-white">La carte des soins</Link>
            <Link href="/#equipe" className="hover:text-white">L&apos;équipe</Link>
            <Link href="/#infos" className="hover:text-white">Horaires et accès</Link>
          </nav>
          <address className="flex flex-col gap-2.5 text-sm not-italic text-white/85">
            {contact.address && <span>{contact.address}</span>}
            {contact.phone && <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="hover:text-white">{contact.phone}</a>}
            {whatsapp && <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="hover:text-white">WhatsApp</a>}
            {contact.email && <a href={`mailto:${contact.email}`} className="hover:text-white">{contact.email}</a>}
          </address>
        </div>
        <p className="border-t border-white/10 px-5 py-4 text-center text-xs text-white/45">Site propulsé par Y-COM</p>
        <div className="mx-auto max-w-[var(--content-max-width,1280px)] px-5 sm:px-8 pb-8"><LegalLinks /></div>
      </footer>
      {bookingBar && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-background)_94%,transparent)] px-4 py-3 backdrop-blur-md lg:hidden">
          <Link href="/reserver" className="flex h-12 items-center justify-center rounded-[var(--radius-full)] bg-[var(--color-accent-primary)] text-[15px] font-semibold text-white">Prendre rendez-vous</Link>
        </div>
      )}
    </div>
  );
}
