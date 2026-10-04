import Link from "next/link";
import type { ReactNode } from "react";
import { designTokensToStyle } from "@/lib/design-tokens-to-css";
import type { AutoContext } from "@/lib/auto/auto-context";
import { hoursByDay } from "@/lib/auto/labels";
import { templateFontVariables } from "@/lib/storefront/template-fonts";
import { DemoBanner } from "@/components/demo/demo-banner";
import { AutoHeader } from "./auto-header";

/** Coque du site d'une concession : SON template et SA personnalisation. */
export function AutoShell({ auto, children }: { auto: AutoContext; children: ReactNode }) {
  const { contact } = auto;
  const whatsapp = contact.whatsapp?.replace(/[^\d]/g, "");
  return (
    <div style={designTokensToStyle(auto.tokens)} className={`${templateFontVariables} flex min-h-screen flex-col bg-[var(--color-background)] font-[family-name:var(--font-body)] text-[var(--color-text-primary)]`}>
      <a href="#contenu-auto" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2">Aller au contenu</a>
      {auto.demoData && <DemoBanner kind="auto" />}
      {auto.content.announcement && (
        <p className="bg-[var(--color-accent-primary)] px-4 py-2 text-center text-[13px] font-bold text-[var(--color-primary)]">
          {auto.content.announcement.href ? <Link href={auto.content.announcement.href} className="underline-offset-4 hover:underline">{auto.content.announcement.text}</Link> : auto.content.announcement.text}
        </p>
      )}
      <AutoHeader tenantName={auto.tenantName} logoUrl={auto.logoUrl} phone={contact.phone} />
      <main id="contenu-auto" className="flex-1">{children}</main>
      <footer id="showroom" className="mt-24 scroll-mt-20 bg-[var(--color-primary)] text-white">
        <div className="mx-auto grid max-w-[var(--content-max-width,1320px)] gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.3fr_1fr_1fr]">
          <div>
            <p className="text-[30px] font-black uppercase leading-none tracking-[-0.02em]" style={{ fontStyle: "oblique 8deg" }}>{auto.tenantName}</p>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/60">Les prix affichés sont ceux de la concession. Aucun paiement en ligne : acompte et règlement se font au showroom, avec reçu.</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent-primary)]">Horaires du showroom</p>
            <dl className="mt-3 grid gap-1.5 text-sm">
              {hoursByDay(auto.rules.openingHours).map((h) => (
                <div key={h.day} className="flex justify-between gap-4 border-b border-white/10 pb-1.5">
                  <dt className="text-white/60">{h.day}</dt>
                  <dd className={`yc-num ${h.text === "Fermé" ? "text-white/40" : ""}`}>{h.text}</dd>
                </div>
              ))}
            </dl>
          </div>
          <address className="flex flex-col gap-2.5 text-sm not-italic text-white/85">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent-primary)]">Nous trouver</p>
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
