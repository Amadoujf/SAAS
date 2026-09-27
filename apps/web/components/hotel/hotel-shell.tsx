import Link from "next/link";
import type { ReactNode } from "react";
import { designTokensToStyle } from "@/lib/design-tokens-to-css";
import type { HotelContext } from "@/lib/hotel/hotel-context";
import { templateFontVariables } from "@/lib/storefront/template-fonts";
import { DemoBanner } from "@/components/demo/demo-banner";
import { HotelHeader } from "./hotel-header";

/** Coque du site d'un établissement : SON template et SA personnalisation. */
export function HotelShell({ hotel, children }: { hotel: HotelContext; children: ReactNode }) {
  const { contact } = hotel;
  const whatsapp = contact.whatsapp?.replace(/[^\d]/g, "");
  return (
    <div style={designTokensToStyle(hotel.tokens)} className={`${templateFontVariables} flex min-h-screen flex-col bg-[var(--color-background)] font-[family-name:var(--font-body)] text-[var(--color-text-primary)]`}>
      <a href="#contenu-hotel" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2">Aller au contenu</a>
      {hotel.demoData && <DemoBanner kind="hotel" />}
      {hotel.content.announcement && (
        <p className="bg-[var(--color-accent-primary)] px-4 py-2 text-center text-[13px] font-medium text-white">
          {hotel.content.announcement.href ? <Link href={hotel.content.announcement.href} className="underline-offset-4 hover:underline">{hotel.content.announcement.text}</Link> : hotel.content.announcement.text}
        </p>
      )}
      <HotelHeader tenantName={hotel.tenantName} logoUrl={hotel.logoUrl} phone={contact.phone} />
      <main id="contenu-hotel" className="flex-1">{children}</main>
      <footer className="mt-24 bg-[var(--color-primary)] text-white">
        <div className="mx-auto grid max-w-[var(--content-max-width,1320px)] gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="font-[family-name:var(--font-heading)] text-[32px] leading-none">{hotel.tenantName}</p>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/65">Réservation en direct : la disponibilité affichée est celle de nos chambres, le prix est celui de l&apos;établissement, sans frais d&apos;intermédiaire.</p>
          </div>
          <nav aria-label="Pied de page" className="flex flex-col gap-2.5 text-sm text-white/85">
            <Link href="/chambres" className="hover:text-white">Chambres et disponibilités</Link>
            <Link href="/#sejour" className="hover:text-white">Le séjour</Link>
            <Link href="/#infos" className="hover:text-white">Infos pratiques</Link>
          </nav>
          <address className="flex flex-col gap-2.5 text-sm not-italic text-white/85">
            {contact.address && <span>{contact.address}</span>}
            {contact.phone && <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="hover:text-white">{contact.phone}</a>}
            {whatsapp && <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="hover:text-white">WhatsApp</a>}
            {contact.email && <a href={`mailto:${contact.email}`} className="hover:text-white">{contact.email}</a>}
          </address>
        </div>
        <p className="border-t border-white/10 px-5 py-4 text-center text-xs text-white/45">Site propulsé par Y-COM</p>
      </footer>
    </div>
  );
}
