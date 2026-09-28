import Link from "next/link";
import type { AutoContext } from "@/lib/auto/auto-context";
import { loadVehicles } from "@/lib/auto/auto-data";
import { Reveal } from "@/components/store/reveal";
import { VehicleCard } from "./vehicle-card";
import { LeadForm } from "./lead-form";

/**
 * Ce que toute concession offre, sous l'accueil (standard OU composé dans l'éditeur) :
 * le stock du moment, les arrivages, puis reprise / financement / importation.
 */
export async function AutoEssentials({ auto, showStock = true }: { auto: AutoContext; showStock?: boolean }) {
  const all = showStock ? await loadVehicles(auto.tenantId, {}) : [];
  // Disponibles d'abord (mis en avant en tête), puis réservés ; les arrivages ont leur bande.
  const rank = (v: (typeof all)[number]) => (v.stockStatus === "available" ? 0 : 2) + (v.featured ? 0 : 1);
  const featured = all.filter((v) => v.stockStatus !== "incoming").sort((a, b) => rank(a) - rank(b)).slice(0, 6);
  const incoming = all.filter((v) => v.stockStatus === "incoming").slice(0, 4);
  return (
    <>
      {featured.length > 0 && (
        <section aria-labelledby="stock" className="mx-auto mt-20 max-w-[var(--content-max-width,1320px)] px-4 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-[var(--color-primary)] pb-4">
            <h2 id="stock" className="text-[34px] font-black uppercase leading-[0.9] tracking-[-0.035em] sm:text-[56px]">En stock<span className="text-[var(--color-accent-primary)]">.</span></h2>
            <Link href="/vehicules" className="text-[14px] font-extrabold uppercase tracking-[0.06em] underline-offset-4 hover:underline">Tout le stock ({all.filter((v) => v.stockStatus !== "incoming").length}) →</Link>
          </div>
          <Reveal as="ul" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((v, i) => <li key={v.id}><VehicleCard v={v} priority={i < 3} /></li>)}
          </Reveal>
        </section>
      )}

      {incoming.length > 0 && auto.rules.importTracking && (
        <section aria-labelledby="arrivages" className="mt-20 bg-[var(--color-primary)] py-14 text-white">
          <div className="mx-auto max-w-[var(--content-max-width,1320px)] px-4 sm:px-8">
            <p className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-[var(--color-accent-secondary)]">Bientôt au showroom</p>
            <h2 id="arrivages" className="mt-2 text-[34px] font-black uppercase leading-[0.9] tracking-[-0.035em] sm:text-[52px]">Arrivages</h2>
            <p className="mt-3 max-w-xl text-[15.5px] text-white/65">Ces véhicules sont en route. Réservez votre place : nous vous appelons dès qu&apos;ils sont prêts à l&apos;essai.</p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {incoming.map((v) => <li key={v.id} className="text-[var(--color-text-primary)]"><VehicleCard v={v} /></li>)}
            </ul>
          </div>
        </section>
      )}

      <section id="services" aria-labelledby="services-titre" className="mx-auto mt-20 grid max-w-[var(--content-max-width,1320px)] scroll-mt-20 gap-10 px-4 sm:px-8 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <h2 id="services-titre" className="text-[34px] font-black uppercase leading-[0.9] tracking-[-0.035em] sm:text-[52px]">Reprise, financement, importation</h2>
          <ol className="mt-8 grid border-t border-[var(--color-border)]">
            {[
              { n: "01", t: "Reprise de votre véhicule", d: "Décrivez-le : nous l'estimons au showroom et déduisons la reprise du prix convenu, par écrit." },
              { n: "02", t: "Financement", d: "Apport, durée : on étudie votre dossier avec vous et votre banque. Aucun engagement en ligne." },
              { n: "03", t: "Importation sur commande", d: "Le modèle que vous cherchez, acheté pour vous et suivi étape par étape jusqu'au showroom." },
            ].map((s) => (
              <li key={s.n} className="grid grid-cols-[56px_1fr] gap-4 border-b border-[var(--color-border)] py-5">
                <span className="yc-num text-[28px] font-black leading-none text-[var(--color-accent-primary)]">{s.n}</span>
                <div>
                  <h3 className="text-[18px] font-extrabold tracking-[-0.01em]">{s.t}</h3>
                  <p className="mt-1 text-[15px] leading-relaxed text-[var(--color-text-secondary)]">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="bg-[var(--color-primary)] p-6 text-white sm:p-8">
          <p className="text-[20px] font-extrabold tracking-[-0.01em]">Parlons de votre projet</p>
          <p className="mt-1 text-[14.5px] text-white/60">Un conseiller vous rappelle{auto.contact.phone ? ` — ou appelez le ${auto.contact.phone}` : ""}.</p>
          <div className="mt-6"><LeadForm initial="trade_in" choices={auto.rules.importTracking ? ["trade_in", "financing", "import_request", "purchase"] : ["trade_in", "financing", "purchase"]} dark /></div>
        </div>
      </section>
    </>
  );
}
