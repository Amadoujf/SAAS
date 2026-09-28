import Link from "next/link";
import type { ReactNode } from "react";
import { designTokensToStyle } from "@/lib/design-tokens-to-css";
import type { RestaurantContext } from "@/lib/restaurant/restaurant-context";
import { hoursByDay } from "@/lib/restaurant/labels";
import { templateFontVariables } from "@/lib/storefront/template-fonts";
import { DemoBanner } from "@/components/demo/demo-banner";
import { RestaurantHeader } from "./restaurant-header";

/** Coque du site d'un restaurant : SON template et SA personnalisation. */
export function RestaurantShell({ restaurant, open, children, bare = false }: { restaurant: RestaurantContext; open?: boolean; children: ReactNode; bare?: boolean }) {
  const { contact } = restaurant;
  const whatsapp = contact.whatsapp?.replace(/[^\d]/g, "");
  return (
    <div style={designTokensToStyle(restaurant.tokens)} className={`${templateFontVariables} flex min-h-screen flex-col bg-[var(--color-background)] font-[family-name:var(--font-body)] text-[var(--color-text-primary)]`}>
      <a href="#contenu-resto" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2">Aller au contenu</a>
      {restaurant.demoData && <DemoBanner kind="restaurant" />}
      {restaurant.content.announcement && (
        <p className="bg-[var(--color-accent-secondary)] px-4 py-2 text-center text-[13px] font-semibold text-white">
          {restaurant.content.announcement.href ? <Link href={restaurant.content.announcement.href} className="underline-offset-4 hover:underline">{restaurant.content.announcement.text}</Link> : restaurant.content.announcement.text}
        </p>
      )}
      <RestaurantHeader tenantName={restaurant.tenantName} logoUrl={restaurant.logoUrl} phone={contact.phone} open={open} />
      <main id="contenu-resto" className="flex-1">{children}</main>
      {!bare && (
        <footer className="mt-24 bg-[var(--color-primary)] text-[#FBF6EE]">
          <div className="mx-auto grid max-w-[var(--content-max-width,1240px)] gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.3fr_1fr_1fr]">
            <div>
              <p className="font-[family-name:var(--font-heading)] text-[34px] uppercase leading-none">{restaurant.tenantName}</p>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/60">Commande en direct : les prix sont ceux du restaurant, sans commission d&apos;intermédiaire. Vous réglez au retrait, à la livraison ou à table.</p>
            </div>
            <dl className="grid gap-1.5 text-sm">
              {hoursByDay(restaurant.rules.openingHours).map((h) => (
                <div key={h.day} className="flex justify-between gap-4 border-b border-white/10 pb-1.5">
                  <dt className="text-white/60">{h.day}</dt>
                  <dd className={h.text === "Fermé" ? "text-white/40" : ""}>{h.text}</dd>
                </div>
              ))}
            </dl>
            <address className="flex flex-col gap-2.5 text-sm not-italic text-white/85">
              {contact.address && <span>{contact.address}</span>}
              {contact.phone && <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="hover:text-white">{contact.phone}</a>}
              {whatsapp && <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="hover:text-white">WhatsApp</a>}
              {contact.email && <a href={`mailto:${contact.email}`} className="hover:text-white">{contact.email}</a>}
            </address>
          </div>
          <p className="border-t border-white/10 px-5 py-4 text-center text-xs text-white/45">Site propulsé par Y-COM</p>
        </footer>
      )}
    </div>
  );
}
