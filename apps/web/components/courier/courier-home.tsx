import type { CourierContext } from "@/lib/courier/courier-context";
import { loadZones } from "@/lib/courier/courier-data";
import { CourierShell, RouteLine } from "./courier-shell";
import { CourierEssentials } from "./courier-essentials";
import { QuoteWidget } from "./quote-widget";

const isDefaultHero = (s: CourierContext["content"]["hero"]["slides"][number] | undefined) => !s || (s.id === "accueil" && s.ctaHref === "/catalogue");

/** Accueil d'une société de livraison : la promesse, le tarif instantané, le trajet. */
export async function CourierHome({ company }: { company: CourierContext }) {
  const zones = await loadZones(company.tenantId);
  const slide = company.content.hero.slides[0];
  const custom = !isDefaultHero(slide);
  const img = custom ? slide?.imageUrl : null;
  return (
    <CourierShell company={company}>
      <section className="relative overflow-hidden bg-[var(--color-primary)] text-white">
        {img && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} alt={slide?.imageAlt ?? ""} className="absolute inset-0 h-full w-full object-cover opacity-35" />
            {slide?.demo && <span className="absolute right-3 top-3 rounded bg-black/55 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">Visuel de démonstration</span>}
          </>
        )}
        <div className="relative mx-auto grid max-w-[var(--content-max-width,1240px)] items-center gap-10 px-4 py-12 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:py-20">
          <div>
            <p className="text-[13px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent-primary)]">{(custom && slide?.eyebrow) || company.contact.address || "Livraison et coursiers"}</p>
            <h1 className="mt-3 break-words font-[family-name:var(--font-heading)] text-[46px] leading-[0.95] tracking-[-0.03em] sm:text-[72px]">{(custom && slide?.title) || company.tenantName}</h1>
            <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-white/75">{(custom && slide?.subtitle) || "Vos colis livrés dans la journée, suivis étape par étape, remis contre un code. L'argent encaissé pour vous vous est reversé avec un reçu."}</p>
            <RouteLine dark className="ml-2 mt-8 h-12 max-w-md" />
          </div>
          <QuoteWidget zones={zones.map((z) => ({ id: z.id, label: z.label, fee: z.fee }))} />
        </div>
      </section>
      <CourierEssentials company={company} />
    </CourierShell>
  );
}
