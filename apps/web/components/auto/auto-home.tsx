import type { AutoContext } from "@/lib/auto/auto-context";
import { loadFacets, loadVehicles } from "@/lib/auto/auto-data";
import { BODY_LABELS, formatNumber } from "@/lib/auto/labels";
import { AutoShell } from "./auto-shell";
import { AutoEssentials } from "./auto-essentials";

const isDefaultHero = (s: AutoContext["content"]["hero"]["slides"][number] | undefined) => !s || (s.id === "accueil" && s.ctaHref === "/catalogue");
const BUDGETS = [5_000_000, 10_000_000, 15_000_000, 20_000_000, 30_000_000, 50_000_000];

/** Accueil d'une concession : véhicule vedette sur la piste, recherche rapide, stock, services. */
export async function AutoHome({ auto }: { auto: AutoContext }) {
  const [vehicles, facets] = await Promise.all([loadVehicles(auto.tenantId, {}), loadFacets(auto.tenantId)]);
  const slide = auto.content.hero.slides[0];
  const custom = !isDefaultHero(slide);
  const star = vehicles.find((v) => v.featured && v.images[0] && v.stockStatus === "available") ?? vehicles.find((v) => v.images[0]);
  const heroImg = (custom && slide?.imageUrl) || star?.images[0]?.url || null;
  const heroDemo = custom ? !!slide?.demo : !!star?.images[0]?.demo;
  const available = vehicles.filter((v) => v.stockStatus === "available").length;
  const incoming = vehicles.filter((v) => v.stockStatus === "incoming").length;
  const select = "h-12 w-full appearance-none rounded-none bg-white px-3 text-[15px] font-semibold text-[var(--color-text-primary)] ring-1 ring-inset ring-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]";
  return (
    <AutoShell auto={auto}>
      <section className="relative overflow-hidden bg-[var(--color-primary)] text-white">
        <div className="mx-auto grid max-w-[var(--content-max-width,1320px)] items-end gap-6 px-4 pt-10 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:pt-16">
          <div className="relative z-10 pb-4 lg:pb-20">
            <p className="text-[12px] font-extrabold uppercase tracking-[0.2em] text-[var(--color-accent-primary)]">{(custom && slide?.eyebrow) || auto.contact.address || "Concession automobile"}</p>
            <h1 className="mt-3 break-words text-[46px] font-black uppercase leading-[0.86] tracking-[-0.045em] sm:text-[78px] lg:text-[92px]">{(custom && slide?.title) || auto.tenantName}</h1>
            <p className="mt-5 max-w-md text-[16.5px] leading-relaxed text-white/70">{(custom && slide?.subtitle) || "Véhicules contrôlés, essai sur rendez-vous, reprise et importation sur commande."}</p>
          </div>
          {heroImg && (
            <div className="relative -mx-4 sm:mx-0">
              <div className="relative aspect-[16/10]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={heroImg} alt={(custom && slide?.imageAlt) || star?.title || auto.tenantName} className="absolute inset-0 h-full w-full object-cover [mask-image:linear-gradient(180deg,#000_75%,transparent)]" />
                {heroDemo && <span className="absolute right-3 top-3 bg-black/55 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">Visuel de démonstration</span>}
              </div>
              {star && !custom && (
                <p className="absolute bottom-[10%] left-4 bg-[var(--color-primary)]/85 px-3 py-2 text-[13px] font-bold backdrop-blur sm:left-6">
                  {star.title}
                </p>
              )}
            </div>
          )}
        </div>

        <form action="/vehicules" method="get" aria-label="Trouver un véhicule" className="relative z-10 mx-auto -mb-px grid max-w-[var(--content-max-width,1320px)] gap-px bg-[var(--color-border)] sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <label className="bg-white px-4 pb-3 pt-2.5 text-[var(--color-text-primary)]"><span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Marque</span>
            <select name="marque" className={select} defaultValue=""><option value="">Toutes ({facets.count})</option>{facets.makes.map((m) => <option key={m}>{m}</option>)}</select>
          </label>
          <label className="bg-white px-4 pb-3 pt-2.5 text-[var(--color-text-primary)]"><span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Carrosserie</span>
            <select name="carrosserie" className={select} defaultValue=""><option value="">Toutes</option>{facets.bodyTypes.map((b) => <option key={b} value={b}>{BODY_LABELS[b] ?? b}</option>)}</select>
          </label>
          <label className="bg-white px-4 pb-3 pt-2.5 text-[var(--color-text-primary)]"><span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Budget maximum</span>
            <select name="prix_max" className={select} defaultValue=""><option value="">Sans limite</option>{BUDGETS.filter((b) => !facets.priceMax || b / 2 < facets.priceMax).map((b) => <option key={b} value={b}>{formatNumber(b)} FCFA</option>)}</select>
          </label>
          <button type="submit" className="flex min-h-[64px] items-center justify-center bg-[var(--color-accent-primary)] px-8 text-[15px] font-extrabold uppercase tracking-[0.06em] text-[var(--color-primary)] hover:brightness-105 sm:col-span-2 lg:col-span-1">Voir les véhicules</button>
        </form>
      </section>

      <section aria-label="La concession en chiffres" className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <dl className="mx-auto grid max-w-[var(--content-max-width,1320px)] grid-cols-2 px-4 sm:px-8 lg:grid-cols-4">
          {[
            { k: "Disponibles à l'essai", v: String(available) },
            { k: "En arrivage", v: String(incoming) },
            { k: "Durée d'un essai", v: `${auto.rules.testDriveMinutes} min` },
            { k: "Marques en stock", v: String(facets.makes.length) },
          ].map((s, i) => (
            <div key={s.k} className={`py-6 ${i % 2 ? "pl-5" : "pr-5"} ${i > 0 ? "lg:border-l lg:border-[var(--color-border)] lg:pl-6" : ""} ${i > 1 ? "border-t border-[var(--color-border)] lg:border-t-0" : ""}`}>
              <dt className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{s.k}</dt>
              <dd className="yc-num mt-1 truncate text-[26px] font-black tracking-[-0.03em] sm:text-[32px]">{s.v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <AutoEssentials auto={auto} />
    </AutoShell>
  );
}
