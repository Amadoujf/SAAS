import Link from "next/link";
import type { EducationContext } from "@/lib/education/education-context";
import { loadPrograms } from "@/lib/education/education-data";
import { CATEGORY_LABELS } from "@/lib/education/labels";
import { Reveal } from "@/components/store/reveal";
import { ProgramCard } from "./program-card";
import { NOTEBOOK } from "./education-shell";

/**
 * Ce que tout établissement offre, sous l'accueil (standard OU composé dans l'éditeur) :
 * les formations ouvertes, puis la marche à suivre pour inscrire un élève.
 */
export async function EducationEssentials({ school }: { school: EducationContext }) {
  const programs = await loadPrograms(school.tenantId);
  const categories = [...new Set(programs.map((p) => p.category))];
  const shown = [...programs].sort((a, b) => Number(b.featured) - Number(a.featured)).slice(0, 6);
  return (
    <>
      {shown.length > 0 && (
        <section aria-labelledby="formations" className="mx-auto mt-20 max-w-[var(--content-max-width,1240px)] px-4 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--color-secondary)]">{school.rules.academicYear ? `Rentrée ${school.rules.academicYear}` : "Inscriptions ouvertes"}</p>
              <h2 id="formations" className="mt-2 font-[family-name:var(--font-heading)] text-[38px] font-semibold leading-[1] tracking-[-0.02em] sm:text-[54px]">Nos formations</h2>
            </div>
            <Link href="/formations" className="text-[15px] font-semibold underline decoration-[var(--color-accent-primary)] decoration-2 underline-offset-8">Toutes les formations ({programs.length})</Link>
          </div>
          {categories.length > 1 && (
            <ul className="mt-6 flex flex-wrap gap-2" aria-label="Domaines">
              {categories.map((c) => (
                <li key={c}><Link href={`/formations?domaine=${c}`} className="inline-flex h-9 items-center rounded-full bg-[var(--color-surface)] px-4 text-[13.5px] font-medium ring-1 ring-inset ring-[var(--color-border)] hover:ring-[var(--color-primary)]">{CATEGORY_LABELS[c] ?? c}</Link></li>
              ))}
            </ul>
          )}
          <Reveal as="ul" className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((p, i) => <li key={p.id} className="min-w-0"><ProgramCard p={p} priority={i < 3} /></li>)}
          </Reveal>
        </section>
      )}

      <section id="inscription" aria-labelledby="inscription-titre" className="mx-auto mt-24 max-w-[var(--content-max-width,1240px)] scroll-mt-24 px-4 sm:px-8">
        <div className="overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-surface)] ring-1 ring-[var(--color-border)]" style={NOTEBOOK}>
          <div className="grid gap-10 py-10 pl-[76px] pr-6 sm:pr-10 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <h2 id="inscription-titre" className="font-[family-name:var(--font-heading)] text-[34px] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-[46px]">Inscrire un élève, <em className="text-[var(--color-secondary)]">pas à pas</em></h2>
              <p className="mt-4 max-w-md text-[16px] leading-[32px] text-[var(--color-text-secondary)]">La demande se fait en ligne en deux minutes. Rien n&apos;est payé sur internet : l&apos;établissement vous rappelle pour confirmer la classe.</p>
            </div>
            <ol className="grid gap-0">
              {[
                { t: "Choisissez la formation et la classe", d: "Horaires, places restantes, frais d'inscription et scolarité sont affichés avant toute demande." },
                { t: "Envoyez la demande", d: "Vos coordonnées et celles de l'élève. Vous recevez aussitôt votre espace famille personnel." },
                { t: "Confirmation et règlement à l'accueil", d: "Frais d'inscription puis échéances, contre un reçu numéroté. Tout apparaît dans votre espace." },
              ].map((s, i) => (
                <li key={s.t} className="grid grid-cols-[44px_1fr] gap-3 py-2">
                  <span className="font-[family-name:var(--font-heading)] text-[34px] italic leading-[32px] text-[var(--color-accent-secondary)]">{i + 1}.</span>
                  <div>
                    <h3 className="text-[17px] font-semibold leading-[32px]">{s.t}</h3>
                    <p className="text-[15px] leading-[32px] text-[var(--color-text-secondary)]">{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </>
  );
}
