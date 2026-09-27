import type { Metadata } from "next";
import { utcToLocal } from "@yamacommerce/database";
import { resolveSalon } from "@/lib/salon/salon-context";
import { loadSalonCatalog } from "@/lib/salon/salon-data";
import { SalonShell } from "@/components/salon/salon-shell";
import { BookingFlow } from "@/components/salon/booking-flow";
import { PublicSiteSuspended } from "@/components/public-site-suspended";
import { PublicSiteBillingSuspended } from "@/components/public-site-billing-suspended";

export async function generateMetadata(): Promise<Metadata> {
  const r = await resolveSalon("/reserver");
  return r.status === "ok" ? { title: `Prendre rendez-vous — ${r.salon.tenantName}` } : {};
}

/** Prise de rendez-vous en ligne (prestation, personne, horaire libre, coordonnées). */
export default async function BookPage({ searchParams }: { searchParams: { prestation?: string; avec?: string } }) {
  const r = await resolveSalon("/reserver");
  if (r.status === "suspended") return <PublicSiteSuspended tenantName={r.tenantName} />;
  if (r.status === "billing_suspended") return <PublicSiteBillingSuspended tenantName={r.tenantName} />;
  const { salon } = r;
  const { menu, team } = await loadSalonCatalog(salon.tenantId);
  const bookable = menu.filter((m) => m.onlineBooking && m.staffIds.length > 0);
  return (
    <SalonShell salon={salon} bookingBar={false}>
      <div className="mx-auto max-w-[var(--content-max-width,1280px)] px-5 pb-10 pt-10 sm:px-8 sm:pt-14">
        <p className="text-[12px] font-semibold uppercase tracking-[0.28em] text-[var(--color-accent-secondary)]">{salon.tenantName}</p>
        <h1 className="mt-3 font-[family-name:var(--font-heading)] text-[48px] italic leading-none sm:text-[68px]">Prendre rendez-vous</h1>
        <p className="mt-4 max-w-xl text-[16px] text-[var(--color-text-secondary)]">Seuls les horaires réellement libres sont proposés. {salon.rules.autoConfirm ? "Votre rendez-vous est confirmé dès l'envoi." : "Le salon confirme votre demande rapidement."}</p>
        <div className="mt-12">
          <BookingFlow
            services={bookable.map((m) => ({ id: m.id, slug: m.slug, title: m.title, category: m.category, durationMinutes: m.durationMinutes, price: m.price, priceFrom: m.priceFrom, staffIds: m.staffIds }))}
            staff={team.map((t) => ({ id: t.id, name: t.name, title: t.title, photoUrl: t.photoUrl }))}
            today={utcToLocal(new Date(), salon.timezone).date}
            timezone={salon.timezone}
            initialService={searchParams.prestation ?? null}
            initialStaff={searchParams.avec ?? null}
            autoConfirm={salon.rules.autoConfirm}
            payWays={salon.payWays}
            cancelCutoffHours={salon.rules.cancelCutoffHours}
          />
        </div>
      </div>
    </SalonShell>
  );
}
