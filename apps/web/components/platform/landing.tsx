import { ycFontVariables } from "@/lib/yc-fonts";
import Link from "next/link";
import { YcLogo } from "@/components/yc/logo";
import {
  IconArrowRight, IconBell, IconCard, IconChart, IconCheck, IconGlobe, IconMapPin, IconReceipt, IconSettings, IconShield, IconSparkles, IconStack, IconTruck, IconWallet,
} from "@/components/yc/icons";
import { PlatformHeader } from "./site-header";
import { HeroStage } from "./hero-stage";
import { BuilderDemo } from "./builder-demo";
import { TemplateShowcase } from "./template-showcase";
import { SectorUniverses } from "./sector-universes";
import { QuoteForm } from "./quote-form";
import { planPerks, FICHE_DEFINITIONS, NEVER_COUNTED } from "@/lib/billing/plan-catalog";

export interface LandingPlan { name: string; priceMonthly: number; priceYearly: number; trialDays: number; maxProducts: number; maxEmployees: number; maxCustomDomains: number; maxAIGenerationsPerMonth: number; isQuoteOnly: boolean }

const fmt = (n: number) => new Intl.NumberFormat("fr-SN").format(n);

const primaryBtn = "inline-flex items-center justify-center gap-2 rounded-lg bg-yc-royal px-6 py-3.5 text-[15px] font-semibold text-white shadow-[0_12px_24px_-12px_rgb(12_61_186/0.9)] transition-colors hover:bg-yc-royal-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yc-royal focus-visible:ring-offset-2 focus-visible:ring-offset-yc-paper";
const outlineBtn = "inline-flex items-center justify-center gap-2 rounded-lg border border-yc-royal/80 bg-transparent px-6 py-3.5 text-[15px] font-semibold text-yc-royal transition-colors hover:bg-yc-royal/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yc-royal focus-visible:ring-offset-2 focus-visible:ring-offset-yc-paper";
const eyebrow = "text-[11px] font-semibold uppercase tracking-[0.24em] text-yc-ink-soft";

/** Site public YamaCommerce — direction éditoriale : papier ivoire, serif de
 *  magazine, encre marine, photographie. Tous les faits affichés sont vrais
 *  (formules réelles en base, moyens de paiement branchés) ; les secteurs et
 *  fonctions non ouverts sont marqués « bientôt ». */
export function Landing({ plans, sectorOptions, availableSectors }: { plans: LandingPlan[]; sectorOptions: { key: string; name: string }[]; availableSectors: string[] }) {
  return (
    <div className={`${ycFontVariables} bg-yc-paper font-ui text-yc-navy-ink antialiased`}>
      <PlatformHeader availableSectors={availableSectors} />

      {/* HÉROS — la composition photo déborde jusqu'au bord droit de l'écran. */}
      <section className="relative overflow-x-clip">
        <div className="mx-auto grid max-w-[1200px] gap-10 px-4 pb-12 pt-8 sm:px-8 sm:pt-12 lg:grid-cols-2 lg:gap-8 lg:pb-6 lg:pt-0">
          <div className="yc-rise lg:self-center lg:py-14">
            <p className={eyebrow}>Créez. Gérez. Développez.</p>
            <h1 className="mt-5 font-editorial text-[46px] leading-[1.02] sm:text-[62px] lg:text-[52px] xl:text-[64px]">
              Votre ambition.<br />
              Un site <br className="sm:hidden" /><em className="text-yc-royal">à sa hauteur.</em>
            </h1>
            <p className="mt-5 max-w-md text-[17px] leading-relaxed text-yc-navy-ink/80">
              Des sites remarquables. <br className="sm:hidden" />Des outils pour votre activité.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/creer-ma-boutique" className={primaryBtn}>Créer mon site <IconArrowRight size={18} /></Link>
              <a href="#templates" className={outlineBtn}>Explorer les templates</a>
            </div>
            <ul className="mt-10 grid max-w-md grid-cols-3 gap-3 text-[13px] leading-snug text-yc-ink-soft">
              {[
                { icon: <IconMapPin size={22} />, text: ["Pensé pour", "le Sénégal"] },
                { icon: <IconCard size={22} />, text: ["Paiements", "locaux"] },
                { icon: <IconChart size={22} />, text: ["Tout pour", "grandir"] },
              ].map((f) => (
                <li key={f.text[0]} className="flex items-center gap-2.5">
                  <span className="shrink-0 text-yc-navy">{f.icon}</span>
                  <span>{f.text[0]}<br />{f.text[1]}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="yc-rise -mx-4 pb-16 [animation-delay:120ms] sm:mx-0 lg:-mr-8 lg:pb-14 xl:-mt-[72px] xl:mr-[calc(568px-50vw)]">
            <HeroStage />
          </div>
        </div>
      </section>

      {/* UNIVERS PAR SECTEUR */}
      <section id="univers" className="bg-yc-paper pb-20 sm:pb-24">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-8">
          <SectorUniverses availableSectors={availableSectors} />
        </div>
      </section>

      {/* BANDEAU MARINE */}
      <section className="bg-yc-navy text-yc-paper">
        <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-14 sm:px-8 lg:grid-cols-[0.95fr_2.05fr] lg:items-center lg:py-16">
          <h2 className="font-editorial text-[40px] leading-[1.02] sm:text-[48px] lg:text-[44px] xl:text-[48px]">Bien plus qu’un beau site.</h2>
          <ul className="grid gap-8 sm:grid-cols-3 lg:gap-10">
            {[
              { icon: <IconCard size={26} />, title: "Paiements locaux", text: "Wave, Orange Money et paiement à la livraison, vérifiés avant d'être comptés comme payés." },
              { icon: <IconSettings size={26} />, title: "Gestion simplifiée", text: "Produits, stock, commandes, livreurs et factures, depuis un seul espace." },
              { icon: <IconSparkles size={26} />, title: "Assistant IA", text: "Générer vos textes et fiches produits pour gagner du temps.", soon: true },
            ].map((f) => (
              <li key={f.title} className="flex gap-4">
                <span className="mt-0.5 shrink-0 text-yc-paper/90">{f.icon}</span>
                <span>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-editorial text-[21px] leading-tight">
                    {f.title}
                    {f.soon && <span className="rounded-full border border-yc-paper/30 px-2 py-0.5 font-ui text-[10px] font-semibold uppercase tracking-wider text-yc-paper/70">Bientôt</span>}
                  </span>
                  <span className="mt-1.5 block text-[13px] leading-relaxed text-yc-paper/70">{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* DE L'IDÉE À LA PREMIÈRE VENTE */}
      <section id="demo" className="bg-yc-paper-deep/60 py-20 sm:py-28">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-8">
          <div className="mb-12 grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-end">
            <div>
              <p className={eyebrow}>De l&apos;idée à la première vente</p>
              <h2 className="mt-4 font-editorial text-[40px] leading-[1.02] sm:text-[56px]">Quatre étapes. <em className="text-yc-royal">Une boutique qui vous ressemble.</em></h2>
            </div>
            <p className="max-w-md text-[15px] leading-relaxed text-yc-ink-soft lg:justify-self-end">Choisissez votre secteur et votre style, ajoutez vos produits, publiez. Votre adresse en ligne est offerte, votre essai est gratuit.</p>
          </div>
          <BuilderDemo />
        </div>
      </section>

      {/* TEMPLATES */}
      <section id="templates" className="scroll-mt-20 py-20 sm:py-28">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-8">
          <div className="mb-12 grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-end">
            <div>
              <p className={eyebrow}>Templates commerce</p>
              <h2 className="mt-4 font-editorial text-[40px] leading-[1.02] sm:text-[56px]">Cinq directions artistiques. <em className="text-yc-royal">Aucune ne se ressemble.</em></h2>
            </div>
            <p className="max-w-md text-[15px] leading-relaxed text-yc-ink-soft lg:justify-self-end">Compositions, typographies, menus et fiches produit propres à chaque template — pas une simple couleur changée. Ouvrez-les : ce sont de vraies boutiques de démonstration.</p>
          </div>
          <TemplateShowcase />
        </div>
      </section>

      {/* TOUT LE CYCLE DE VENTE */}
      <section id="fonctionnalites" className="border-t border-yc-navy/10 py-20 sm:py-28">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-8">
          <div className="max-w-2xl">
            <p className={eyebrow}>Tout le cycle de vente</p>
            <h2 className="mt-4 font-editorial text-[40px] leading-[1.02] sm:text-[56px]">De la commande à la livraison, <em className="text-yc-royal">sans rien bricoler.</em></h2>
          </div>
          <ul className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: <IconReceipt size={24} />, title: "Commandes pilotées", text: "Files « à préparer », « preuves à vérifier », « en livraison ». Un bouton pour l'étape suivante, un historique que personne ne réécrit." },
              { icon: <IconWallet size={24} />, title: "Paiements vérifiés", text: "Preuve Wave ou Orange Money à valider, paiement à la livraison, ou prestataire en ligne. Une commande en attente n'est jamais affichée comme payée." },
              { icon: <IconTruck size={24} />, title: "Livraison par zones", text: "Tarifs, délais, livraison offerte dès un montant, retrait en boutique et livreurs affectés — recalculés par le serveur." },
              { icon: <IconStack size={24} />, title: "Stock exact", text: "Réservation au moment de la commande : deux clients ne peuvent jamais acheter le dernier article en même temps." },
              { icon: <IconGlobe size={24} />, title: "Votre adresse en ligne", text: "Sous-domaine offert dès la création, ou votre propre nom de domaine avec certificat HTTPS." },
              { icon: <IconBell size={24} />, title: "Clients informés", text: "Chaque étape crée une notification ; son envoi réel est suivi honnêtement, jamais supposé." },
            ].map((f) => (
              <li key={f.title} className="border-t border-yc-navy/15 pt-6">
                <span className="text-yc-royal">{f.icon}</span>
                <h3 className="mt-4 font-editorial text-[26px] leading-tight">{f.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-yc-ink-soft">{f.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* TARIFS — formules réelles (base de données) */}
      <section id="tarifs" className="scroll-mt-20 bg-yc-paper-deep/60 py-20 sm:py-28">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-8">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <p className={eyebrow}>Tarifs</p>
            <h2 className="mt-4 font-editorial text-[40px] leading-[1.02] sm:text-[56px]">La même qualité, <em className="text-yc-royal">à chaque formule.</em></h2>
            <p className="mt-4 text-[15px] text-yc-ink-soft">Toutes les formules ont un site premium et animé. Elles se distinguent par les fonctions, les quotas et l&apos;accompagnement. Essai gratuit, renouvellement manuel : jamais de prélèvement automatique.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {plans.map((p) => {
              const featured = p.name === "Business";
              return (
                <div key={p.name} className={`relative flex flex-col rounded-xl p-7 ${featured ? "bg-yc-navy text-yc-paper shadow-[0_30px_60px_-30px_rgb(12_22_48/0.6)]" : "bg-white ring-1 ring-yc-navy/10"}`}>
                  {featured && <span className="absolute -top-3 left-7 rounded-full bg-yc-royal px-3 py-1 text-[11px] font-semibold text-white">Le plus choisi</span>}
                  <p className="font-editorial text-[28px] leading-none">{p.name}</p>
                  {p.isQuoteOnly ? (
                    <>
                      <p className="mt-5 text-[34px] font-semibold tracking-tight">Sur devis</p>
                      <p className={`mt-1 text-xs ${featured ? "text-yc-paper/60" : "text-yc-ink-soft"}`}>Adapté à votre organisation</p>
                    </>
                  ) : (
                    <>
                      <p className="mt-5 flex items-baseline gap-1.5"><span className="text-[34px] font-semibold tracking-tight yc-num">{fmt(p.priceMonthly)}</span><span className={`text-sm ${featured ? "text-yc-paper/70" : "text-yc-ink-soft"}`}>FCFA / mois</span></p>
                      <p className={`mt-1 text-xs ${featured ? "text-yc-paper/60" : "text-yc-ink-soft"}`}>ou {fmt(p.priceYearly)} FCFA / an · {p.trialDays} jours d&apos;essai</p>
                    </>
                  )}
                  <ul className={`mt-6 flex-1 space-y-2.5 border-t pt-6 text-sm ${featured ? "border-yc-paper/15 text-yc-paper/90" : "border-yc-navy/10"}`}>
                    {planPerks(p.name, p).map((perk) => (
                      <li key={perk.label} className="flex gap-2">
                        <IconCheck size={17} className={`mt-0.5 shrink-0 ${perk.soon ? "opacity-40" : ""} ${featured ? "text-[#8FA9EE]" : "text-yc-royal"}`} />
                        <span>
                          {perk.label}
                          {perk.soon && <span className={`ml-1.5 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${featured ? "bg-white/15" : "bg-yc-navy/[0.07] text-yc-ink-soft"}`}>À venir</span>}
                          {perk.note && <span className={`block text-xs ${featured ? "text-yc-paper/60" : "text-yc-ink-soft"}`}>{perk.note}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Link href={p.isQuoteOnly ? "#devis" : `/creer-ma-boutique?formule=${encodeURIComponent(p.name)}`}
                    className={`mt-7 inline-flex w-full items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold transition-colors ${featured ? "bg-white text-yc-navy hover:bg-yc-paper" : "border border-yc-royal/80 text-yc-royal hover:bg-yc-royal/5"}`}>
                    {p.isQuoteOnly ? "Demander un devis" : "Commencer l'essai"}
                  </Link>
                </div>
              );
            })}
          </div>

          <details className="group mx-auto mt-10 max-w-3xl rounded-xl bg-white ring-1 ring-yc-navy/10">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 font-semibold">
              Qu&apos;est-ce qu&apos;une « fiche » ?
              <span className="text-yc-royal transition-transform group-open:rotate-45" aria-hidden="true">+</span>
            </summary>
            <div className="px-6 pb-6 text-sm">
              <p className="text-yc-ink-soft">Une fiche est un élément publiable de votre catalogue. Selon votre secteur :</p>
              <dl className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
                {FICHE_DEFINITIONS.map((d) => (
                  <div key={d.sector} className="contents">
                    <dt className="font-semibold">{d.sector}</dt>
                    <dd className="text-yc-ink-soft">{d.fiche}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-yc-ink-soft">{NEVER_COUNTED}</p>
              <p className="mt-2 text-yc-ink-soft">La connexion d&apos;un domaine personnalisé n&apos;inclut ni son achat ni son renouvellement auprès d&apos;un registraire.</p>
            </div>
          </details>
        </div>
      </section>

      {/* DEVIS SUR MESURE */}
      <section id="devis" className="scroll-mt-20 py-20 sm:py-28">
        <div className="mx-auto grid max-w-[1200px] gap-10 px-4 sm:px-8 lg:grid-cols-[1fr_1.3fr] lg:items-start">
          <div>
            <p className={eyebrow}>Sur mesure</p>
            <h2 className="mt-4 font-editorial text-[40px] leading-[1.02] sm:text-[52px]">Plusieurs établissements ? <em className="text-yc-royal">Parlons-en.</em></h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-yc-ink-soft">Intégrations spécifiques, quotas adaptés, accompagnement dédié : décrivez votre besoin, l&apos;équipe vous répond avec une proposition.</p>
          </div>
          <QuoteForm sectors={sectorOptions} />
        </div>
      </section>

      {/* APPEL FINAL */}
      <section className="px-4 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-[1200px] text-center">
          <p className={eyebrow}>Prêt quand vous l&apos;êtes</p>
          <h2 className="mx-auto mt-5 max-w-3xl font-editorial text-[44px] leading-[1] sm:text-[72px]">Votre prochaine commande peut arriver <em className="text-yc-royal">ce soir.</em></h2>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/creer-ma-boutique" className={primaryBtn}>Créer mon site gratuitement <IconArrowRight size={18} /></Link>
            <Link href="/connexion" className={outlineBtn}>J&apos;ai déjà un compte</Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-yc-navy/10">
        <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-12 text-sm text-yc-ink-soft sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <YcLogo />
            <p className="mt-4 max-w-xs leading-relaxed">Des sites remarquables et des outils de vente pensés pour les entreprises du Sénégal.</p>
          </div>
          <ul className="space-y-2.5">
            <li><a href="#univers" className="hover:text-yc-royal">Solutions</a></li>
            <li><a href="#templates" className="hover:text-yc-royal">Templates</a></li>
            <li><a href="#tarifs" className="hover:text-yc-royal">Tarifs</a></li>
            <li><Link href="/connexion" className="hover:text-yc-royal">Connexion</Link></li>
          </ul>
          <ul className="space-y-2.5">
            <li className="flex items-center gap-2"><IconShield size={16} /> Données isolées par entreprise</li>
            <li className="flex items-center gap-2"><IconWallet size={16} /> Paiements vérifiés côté serveur</li>
            <li className="flex items-center gap-2"><IconMapPin size={16} /> Conçu à Dakar</li>
          </ul>
        </div>
      </footer>
    </div>
  );
}
