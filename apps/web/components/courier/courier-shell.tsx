import Link from "next/link";
import type { ReactNode } from "react";
import { designTokensToStyle } from "@/lib/design-tokens-to-css";
import type { CourierContext } from "@/lib/courier/courier-context";
import { templateFontVariables } from "@/lib/storefront/template-fonts";
import { DemoBanner } from "@/components/demo/demo-banner";
import { CourierHeader } from "./courier-header";

/** Tracé pointillé du trajet (élément signature du template « Trajet ») : la ligne s'étire,
 *  les repères de retrait et de remise restent ronds quelle que soit la largeur. */
export function RouteLine({ className = "", dark = false }: { className?: string; dark?: boolean }) {
  return (
    <div aria-hidden="true" className={`relative ${className}`}>
      <svg viewBox="0 0 400 60" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <path d="M8 50 C 120 50, 110 10, 200 10 S 290 50, 392 10" fill="none" stroke={dark ? "rgba(255,255,255,.55)" : "var(--color-primary)"} strokeWidth="2.5" strokeDasharray="2 9" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="absolute bottom-[10%] left-0 h-3.5 w-3.5 -translate-x-1/2 translate-y-1/2 rounded-full bg-[var(--color-accent-primary)]" />
      <span className="absolute right-0 top-[16%] h-4 w-4 -translate-y-1/2 translate-x-1/2 rounded-full border-[3px] border-[var(--color-accent-primary)]" />
    </div>
  );
}

/** Coque du site d'une société de livraison : SON template et SA personnalisation. */
export function CourierShell({ company, children }: { company: CourierContext; children: ReactNode }) {
  const { contact } = company;
  const whatsapp = contact.whatsapp?.replace(/[^\d]/g, "");
  return (
    <div style={designTokensToStyle(company.tokens)} className={`${templateFontVariables} flex min-h-screen flex-col bg-[var(--color-background)] font-[family-name:var(--font-body)] text-[var(--color-text-primary)]`}>
      <a href="#contenu-livraison" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2">Aller au contenu</a>
      {company.demoData && <DemoBanner kind="livraison" />}
      {company.content.announcement && (
        <p className="bg-[var(--color-accent-primary)] px-4 py-2 text-center text-[13.5px] font-semibold text-[var(--color-primary)]">
          {company.content.announcement.href ? <Link href={company.content.announcement.href} className="underline-offset-4 hover:underline">{company.content.announcement.text}</Link> : company.content.announcement.text}
        </p>
      )}
      <CourierHeader tenantName={company.tenantName} logoUrl={company.logoUrl} phone={contact.phone} />
      <main id="contenu-livraison" className="flex-1">{children}</main>
      <footer id="contact" className="mt-24 scroll-mt-20 bg-[var(--color-primary)] text-white">
        <RouteLine dark className="mx-4 h-10 opacity-60 sm:mx-8" />
        <div className="mx-auto grid max-w-[var(--content-max-width,1240px)] gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.3fr_1fr_1fr]">
          <div>
            <p className="font-[family-name:var(--font-heading)] text-[30px] leading-none">{company.tenantName}</p>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/65">Aucun paiement en ligne. Le tarif est affiché avant l&apos;envoi ; les sommes encaissées à la livraison sont reversées à l&apos;expéditeur avec un reçu.</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent-primary)]">Suivi</p>
            <p className="mt-3 text-sm leading-relaxed text-white/70">Chaque course a son lien de suivi. Le destinataire reçoit le sien, avec le code à donner au livreur.</p>
            <Link href="/suivre" className="mt-3 inline-block text-sm font-semibold text-white underline decoration-[var(--color-accent-primary)] underline-offset-4">Suivre un colis</Link>
          </div>
          <address className="flex flex-col gap-2.5 text-sm not-italic text-white/85">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent-primary)]">Nous joindre</p>
            {contact.address && <span>{contact.address}</span>}
            {contact.phone && <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="yc-num hover:text-white">{contact.phone}</a>}
            {whatsapp && <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="hover:text-white">WhatsApp</a>}
            {contact.email && <a href={`mailto:${contact.email}`} className="hover:text-white">{contact.email}</a>}
          </address>
        </div>
        <p className="border-t border-white/10 px-5 py-4 text-center text-xs text-white/45">Site propulsé par Y-COM</p>
      </footer>
    </div>
  );
}
