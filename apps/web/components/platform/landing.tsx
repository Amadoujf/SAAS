import { ycFontVariables } from "@/lib/yc-fonts";
import Link from "next/link";
import { YcLogo } from "@/components/yc/logo";
import { buttonClasses } from "@/components/yc/button";
import {
  IconArrowRight, IconBell, IconBrush, IconCheck, IconGlobe, IconPhone, IconReceipt, IconShield, IconStack, IconTruck, IconWallet,
} from "@/components/yc/icons";
import { PlatformHeader } from "./site-header";
import { HeroStage } from "./hero-stage";
import { BuilderDemo } from "./builder-demo";
import { TemplateShowcase } from "./template-showcase";

export interface LandingPlan { name: string; priceMonthly: number; priceYearly: number; trialDays: number; maxProducts: number; customDomainAllowed: boolean; features: string[] }

const FEATURE_LABELS: Record<string, string> = {
  catalog: "Catalogue & stock", orders: "Commandes & livraisons", invoices: "Factures", cod_payment: "Paiement à la livraison",
  online_payment: "Paiement en ligne", whatsapp: "Notifications WhatsApp", advanced_reports: "Rapports avancés", loyalty: "Fidélité",
  multi_shop: "Plusieurs boutiques", own_merchant_credentials: "Votre compte marchand",
};

const fmt = (n: number) => new Intl.NumberFormat("fr-SN").format(n);

/** Vitrine publique YamaCommerce — l'univers « spectaculaire, immersif,
 *  émotionnel ». Tous les chiffres affichés sont des faits du produit (régions,
 *  moyens de paiement, formules réelles en base) — aucune statistique inventée. */
export function Landing({ plans }: { plans: LandingPlan[] }) {
  return (
    <div className={`${ycFontVariables} bg-yc-night-950 font-ui text-white`}>
      <PlatformHeader />

      {/* HÉROS */}
      <section className="relative overflow-hidden pb-20 pt-32 sm:pt-36 lg:pb-28">
        <div className="pointer-events-none absolute inset-0 yc-glow" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0 yc-grid" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[1.1fr_1fr]">
          <div className="yc-rise">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3.5 py-1.5 text-xs font-semibold text-white/80 ring-1 ring-inset ring-white/15">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yc-cyan" /> Conçu à Dakar, pour les commerçants africains
            </p>
            <h1 className="mt-6 font-display text-[44px] font-semibold leading-[0.98] tracking-[-0.035em] sm:text-[64px] lg:text-[76px]">
              Votre boutique<br />
              <span className="yc-text-gradient">vend pendant<br className="sm:hidden" /> que vous dormez.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/65">
              Créez un site marchand magnifique, encaissez par <strong className="font-semibold text-white">Wave</strong>, <strong className="font-semibold text-white">Orange Money</strong> ou <strong className="font-semibold text-white">à la livraison</strong>, et pilotez commandes, stock et livreurs depuis un seul tableau de bord.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/creer-ma-boutique" className={buttonClasses("glow", "lg", "rounded-full")}>Créer ma boutique <IconArrowRight size={18} /></Link>
              <a href="#demo" className={buttonClasses("inverse", "lg", "rounded-full")}>Voir comment ça marche</a>
            </div>
            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/60">
              {["Essai gratuit, sans carte bancaire", "Paiements vérifiés, jamais supposés", "100 % pensé pour le mobile"].map((t) => (
                <li key={t} className="flex items-center gap-2"><IconCheck size={16} className="text-yc-cyan" /> {t}</li>
              ))}
            </ul>
          </div>
          <HeroStage />
        </div>
      </section>

      {/* BANDEAU PAIEMENTS */}
      <section id="paiements" className="border-y border-white/10 bg-white/[0.02]">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-5 py-8 sm:flex-row sm:justify-between sm:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/45">Vos clients paient comme ils veulent</p>
          <ul className="flex flex-wrap items-center justify-center gap-3">
            {[
              { name: "Wave", cls: "from-[#1dc4ff] to-[#1a8cff]" },
              { name: "Orange Money", cls: "from-[#ff8a00] to-[#ff5c00]" },
              { name: "À la livraison", cls: "from-emerald-400 to-teal-500" },
              { name: "Carte & PSP", cls: "from-yc-electric to-yc-violet" },
            ].map((p) => (
              <li key={p.name} className="flex items-center gap-2.5 rounded-full bg-white/[0.05] py-1.5 pl-1.5 pr-4 text-sm font-semibold ring-1 ring-inset ring-white/10">
                <span className={`h-7 w-7 rounded-full bg-gradient-to-br ${p.cls}`} aria-hidden="true" /> {p.name}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* DÉMO ANIMÉE — sur ivoire : changement de rythme */}
      <section id="demo" className="bg-yc-ivory-100 py-24 text-yc-ink sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mb-14 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-yc-electric">De l&apos;idée à la première vente</p>
            <h2 className="mt-3 font-display text-4xl font-semibold leading-[1.02] tracking-[-0.03em] sm:text-5xl">Quatre étapes. Une boutique qui vous ressemble.</h2>
          </div>
          <BuilderDemo />
        </div>
      </section>

      {/* FONCTIONNALITÉS — bento */}
      <section id="fonctionnalites" className="relative py-24 sm:py-32">
        <div className="pointer-events-none absolute inset-0 yc-glow opacity-40" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mb-14 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-yc-cyan">Tout le cycle de vente</p>
            <h2 className="mt-3 font-display text-4xl font-semibold leading-[1.02] tracking-[-0.03em] sm:text-5xl">De la commande à la livraison, sans rien bricoler.</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
            <Bento className="md:col-span-4" icon={<IconReceipt size={22} />} title="Commandes pilotées au doigt" text="Files « à préparer », « preuves à vérifier », « en livraison ». Un bouton pour l'étape suivante, un historique que personne ne peut réécrire.">
              <div className="mt-6 grid gap-2 sm:grid-cols-3">
                {[["À préparer", "3", "from-yc-violet/30"], ["Preuves Wave", "1", "from-amber-400/30"], ["En livraison", "2", "from-yc-cyan/30"]].map(([l, v, c]) => (
                  <div key={l} className={`rounded-2xl bg-gradient-to-br ${c} to-transparent p-4 ring-1 ring-inset ring-white/10`}><p className="text-xs text-white/60">{l}</p><p className="font-display text-3xl font-semibold">{v}</p></div>
                ))}
              </div>
            </Bento>
            <Bento className="md:col-span-2" icon={<IconWallet size={22} />} title="Paiements vérifiés" text="Wave et Orange Money avec preuve à valider, paiement à la livraison, ou prestataire en ligne. Une commande en attente n'est jamais affichée comme payée." />
            <Bento className="md:col-span-2" icon={<IconTruck size={22} />} title="Livraison par zones" text="Tarifs, délais, livraison offerte dès un montant, retrait en boutique, livreurs affectés — recalculés côté serveur." />
            <Bento className="md:col-span-2" icon={<IconStack size={22} />} title="Stock en temps réel" text="Réservation atomique : deux clients ne peuvent jamais acheter le dernier article en même temps." />
            <Bento className="md:col-span-2" icon={<IconBrush size={22} />} title="Éditeur visuel" text="Sections glisser-déposer, prévisualisation téléphone, publication datée et retour arrière." />
            <Bento className="md:col-span-3" icon={<IconGlobe size={22} />} title="Votre nom de domaine" text="Sous-domaine offert, ou votre propre domaine avec certificat HTTPS automatique." />
            <Bento className="md:col-span-3" icon={<IconBell size={22} />} title="Clients tenus informés" text="Chaque étape crée une notification ; son envoi réel est suivi honnêtement, jamais supposé." />
          </div>
        </div>
      </section>

      {/* TEMPLATES */}
      <section id="templates" className="border-t border-white/10 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-yc-cyan">Directions artistiques</p>
              <h2 className="mt-3 font-display text-4xl font-semibold leading-[1.02] tracking-[-0.03em] sm:text-5xl">Cinq univers. Aucun ne ressemble aux autres.</h2>
            </div>
            <p className="max-w-sm text-white/60">Compositions, typographies, menus et fiches produit propres à chaque template — pas une simple couleur changée.</p>
          </div>
          <TemplateShowcase />
        </div>
      </section>

      {/* FAITS */}
      <section className="bg-yc-ivory-50 py-20 text-yc-ink">
        <dl className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-5 sm:px-8 lg:grid-cols-4">
          {[
            { v: "14", l: "régions du Sénégal configurables en zones de livraison" },
            { v: "3", l: "façons d'encaisser : mobile money, livraison, en ligne" },
            { v: "4", l: "étapes de commande, pensées pour le pouce" },
            { v: "0", l: "commande « payée » sans vérification réelle" },
          ].map((s) => (
            <div key={s.l} className="border-l-2 border-yc-electric pl-5">
              <dt className="font-display text-6xl font-semibold tracking-tight">{s.v}</dt>
              <dd className="mt-2 text-sm text-yc-ink-soft">{s.l}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* TARIFS — formules réelles */}
      <section id="tarifs" className="relative py-24 sm:py-32">
        <div className="pointer-events-none absolute inset-0 yc-glow opacity-50" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mb-14 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-yc-cyan">Tarifs</p>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">Une formule pour chaque étape de croissance.</h2>
            <p className="mx-auto mt-4 max-w-xl text-white/60">Essai gratuit inclus. Renouvellement manuel : jamais de prélèvement automatique surprise.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {plans.map((p, i) => {
              const featured = i === 1;
              return (
                <div key={p.name} className={`relative flex flex-col rounded-[28px] p-7 ring-1 ring-inset ${featured ? "bg-white text-yc-ink ring-white shadow-[0_40px_100px_-30px_rgb(34_211_238/0.6)]" : "bg-white/[0.04] ring-white/10"}`}>
                  {featured && <span className="absolute -top-3 left-7 rounded-full bg-gradient-to-r from-yc-cyan to-yc-violet px-3 py-1 text-xs font-bold text-white">Le plus choisi</span>}
                  <p className="font-display text-xl font-semibold">{p.name}</p>
                  <p className="mt-4 flex items-baseline gap-1"><span className="font-display text-4xl font-semibold tracking-tight yc-num">{fmt(p.priceMonthly)}</span><span className={featured ? "text-yc-ink-soft" : "text-white/50"}>FCFA / mois</span></p>
                  <p className={`mt-1 text-xs ${featured ? "text-yc-ink-soft" : "text-white/45"}`}>ou {fmt(p.priceYearly)} FCFA / an · {p.trialDays} jours d&apos;essai</p>
                  <ul className={`mt-6 flex-1 space-y-2.5 text-sm ${featured ? "text-yc-ink" : "text-white/75"}`}>
                    <li className="flex gap-2"><IconCheck size={17} className={featured ? "text-yc-electric" : "text-yc-cyan"} /> Jusqu&apos;à {fmt(p.maxProducts)} produits</li>
                    {p.customDomainAllowed && <li className="flex gap-2"><IconCheck size={17} className={featured ? "text-yc-electric" : "text-yc-cyan"} /> Votre nom de domaine</li>}
                    {p.features.slice(0, 6).map((f) => FEATURE_LABELS[f] ? <li key={f} className="flex gap-2"><IconCheck size={17} className={featured ? "text-yc-electric" : "text-yc-cyan"} /> {FEATURE_LABELS[f]}</li> : null)}
                  </ul>
                  <Link href={`/creer-ma-boutique?formule=${encodeURIComponent(p.name)}`} className={buttonClasses(featured ? "primary" : "inverse", "md", "mt-7 w-full rounded-full")}>Commencer l&apos;essai</Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* APPEL FINAL */}
      <section className="px-5 pb-24 sm:px-8">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[36px] bg-gradient-to-br from-yc-electric via-[#5b3df5] to-yc-violet px-6 py-16 text-center sm:px-16 sm:py-20">
          <div className="pointer-events-none absolute inset-0 yc-grid opacity-70" aria-hidden="true" />
          <h2 className="relative mx-auto max-w-3xl font-display text-4xl font-semibold leading-[1.02] tracking-[-0.03em] sm:text-6xl">Votre prochaine commande peut arriver ce soir.</h2>
          <div className="relative mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/creer-ma-boutique" className={buttonClasses("inverse", "lg", "rounded-full bg-white text-yc-night-950 hover:bg-white/90")}>Créer ma boutique gratuitement</Link>
            <Link href="/connexion" className={buttonClasses("inverse", "lg", "rounded-full")}>J&apos;ai déjà un compte</Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-10 text-sm text-white/50 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <YcLogo tone="light" />
          <p className="flex items-center gap-2"><IconShield size={16} /> Données isolées par entreprise · paiements vérifiés côté serveur</p>
          <p className="flex items-center gap-2"><IconPhone size={16} /> Fait pour le mobile, au Sénégal</p>
        </div>
      </footer>
    </div>
  );
}

function Bento({ className = "", icon, title, text, children }: { className?: string; icon: React.ReactNode; title: string; text: string; children?: React.ReactNode }) {
  return (
    <article className={`group relative overflow-hidden rounded-[28px] bg-white/[0.04] p-7 ring-1 ring-inset ring-white/10 transition-colors duration-500 hover:bg-white/[0.07] ${className}`}>
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-yc-cyan/25 to-yc-violet/25 text-yc-cyan ring-1 ring-inset ring-white/10 transition-transform duration-500 group-hover:scale-110">{icon}</span>
      <h3 className="mt-5 font-display text-xl font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-white/60">{text}</p>
      {children}
    </article>
  );
}
