import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { designTokensToStyle } from "@/lib/design-tokens-to-css";
import type { EducationContext } from "@/lib/education/education-context";
import { templateFontVariables } from "@/lib/storefront/template-fonts";
import { DemoBanner } from "@/components/demo/demo-banner";
import { EducationHeader } from "./education-header";
import { LegalLinks } from "@/components/legal/legal-links";

/** Lignes et marge rouge du cahier (élément signature du template « Préau »). */
export const NOTEBOOK: CSSProperties = {
  backgroundImage:
    "linear-gradient(90deg, transparent 0, transparent 52px, color-mix(in srgb, var(--color-accent-secondary) 55%, transparent) 52px, color-mix(in srgb, var(--color-accent-secondary) 55%, transparent) 54px, transparent 54px), repeating-linear-gradient(180deg, transparent 0, transparent 31px, color-mix(in srgb, var(--color-primary) 9%, transparent) 31px, color-mix(in srgb, var(--color-primary) 9%, transparent) 32px)",
};

/** Coque du site d'un établissement : SON template et SA personnalisation. */
export function EducationShell({ school, children }: { school: EducationContext; children: ReactNode }) {
  const { contact } = school;
  const whatsapp = contact.whatsapp?.replace(/[^\d]/g, "");
  return (
    <div style={designTokensToStyle(school.tokens)} className={`${templateFontVariables} flex min-h-screen flex-col bg-[var(--color-background)] font-[family-name:var(--font-body)] text-[var(--color-text-primary)]`}>
      <a href="#contenu-ecole" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2">Aller au contenu</a>
      {school.demoData && <DemoBanner kind="ecole" />}
      {school.content.announcement && (
        <p className="bg-[var(--color-secondary)] px-4 py-2 text-center text-[13.5px] font-semibold text-white">
          {school.content.announcement.href ? <Link href={school.content.announcement.href} className="underline-offset-4 hover:underline">{school.content.announcement.text}</Link> : school.content.announcement.text}
        </p>
      )}
      <EducationHeader tenantName={school.tenantName} logoUrl={school.logoUrl} phone={contact.phone} academicYear={school.rules.academicYear} />
      <main id="contenu-ecole" className="flex-1">{children}</main>
      <footer id="contact" className="mt-24 scroll-mt-20 bg-[var(--color-primary)] text-white">
        <div className="mx-auto grid max-w-[var(--content-max-width,1240px)] gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.3fr_1fr_1fr]">
          <div>
            <p className="font-[family-name:var(--font-heading)] text-[30px] leading-none">{school.tenantName}</p>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/65">Aucun paiement en ligne : les frais se règlent à l&apos;accueil (espèces, Wave, Orange Money, virement), toujours contre un reçu numéroté.</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent-primary)]">Familles et élèves</p>
            <p className="mt-3 text-sm leading-relaxed text-white/70">Chaque famille reçoit un lien personnel pour suivre les inscriptions, les échéances, les reçus, les absences et les notes publiées.</p>
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
        <div className="mx-auto max-w-[var(--content-max-width,1240px)] px-5 sm:px-8 pb-8"><LegalLinks /></div>
      </footer>
    </div>
  );
}
