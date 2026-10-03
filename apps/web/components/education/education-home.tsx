import Link from "next/link";
import type { EducationContext } from "@/lib/education/education-context";
import { loadPrograms } from "@/lib/education/education-data";
import { CATEGORY_LABELS } from "@/lib/education/labels";
import { EducationShell, NOTEBOOK } from "./education-shell";
import { EducationEssentials } from "./education-essentials";

const isDefaultHero = (s: EducationContext["content"]["hero"]["slides"][number] | undefined) => !s || (s.id === "accueil" && s.ctaHref === "/catalogue");

/** Accueil d'un établissement : le cahier ouvert, les formations, la marche à suivre. */
export async function EducationHome({ school }: { school: EducationContext }) {
  const programs = await loadPrograms(school.tenantId);
  const slide = school.content.hero.slides[0];
  const custom = !isDefaultHero(slide);
  const lead = programs.find((p) => p.featured && p.images[0]) ?? programs.find((p) => p.images[0]);
  const heroImg = (custom && slide?.imageUrl) || lead?.images[0]?.url || null;
  const heroDemo = custom ? !!slide?.demo : !!lead?.images[0]?.demo;
  const domains = [...new Set(programs.map((p) => CATEGORY_LABELS[p.category] ?? p.category))];
  return (
    <EducationShell school={school}>
      <section className="mx-auto grid max-w-[var(--content-max-width,1240px)] items-center gap-10 px-4 pt-10 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:pt-16">
        <div className="relative rounded-[var(--radius-lg)] bg-[var(--color-surface)] py-8 pl-[76px] pr-6 ring-1 ring-[var(--color-border)] sm:py-10" style={NOTEBOOK}>
          <p className="text-[13px] font-semibold uppercase leading-[32px] tracking-[0.16em] text-[var(--color-secondary)]">{(custom && slide?.eyebrow) || (school.rules.academicYear ? `Année ${school.rules.academicYear}` : "Établissement privé")}</p>
          <h1 className="break-words font-[family-name:var(--font-heading)] text-[44px] font-semibold leading-[64px] tracking-[-0.02em] sm:text-[60px]">
            {(custom && slide?.title) || school.tenantName}
          </h1>
          <p className="mt-2 max-w-lg text-[17px] leading-[32px] text-[var(--color-text-secondary)]">{(custom && slide?.subtitle) || "Des classes à taille humaine, un suivi des présences et des notes partagé avec les familles, des frais clairs et payables en plusieurs fois."}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={(custom && slide?.ctaHref) || "/formations"} className="inline-flex h-12 items-center rounded-[var(--radius-md)] bg-[var(--color-primary)] px-6 text-[15px] font-semibold text-white hover:-translate-y-0.5">{(custom && slide?.ctaLabel) || "Voir les formations"}</Link>
            <Link href="/#inscription" className="inline-flex h-12 items-center rounded-[var(--radius-md)] px-6 text-[15px] font-semibold ring-1 ring-inset ring-[var(--color-border)] hover:ring-[var(--color-primary)]">Comment s&apos;inscrire</Link>
          </div>
        </div>
        {heroImg && (
          <figure className="relative">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-lg)] ring-1 ring-[var(--color-border)] [transform:rotate(1.2deg)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={heroImg} alt={(custom && slide?.imageAlt) || lead?.title || school.tenantName} className="h-full w-full object-cover" />
              {heroDemo && <span className="absolute right-3 top-3 rounded bg-black/55 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">Visuel de démonstration</span>}
            </div>
            {lead && !custom && <figcaption className="absolute -bottom-4 left-4 rounded-[var(--radius-md)] bg-[var(--color-accent-primary)] px-4 py-2 text-[14px] font-semibold text-[var(--color-primary)] shadow-[var(--shadow-sm)]">{lead.title}</figcaption>}
          </figure>
        )}
      </section>

      <section id="etablissement" aria-label="L'établissement en bref" className="mx-auto mt-16 max-w-[var(--content-max-width,1240px)] scroll-mt-24 px-4 sm:px-8">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-border)] ring-1 ring-[var(--color-border)] lg:grid-cols-4">
          {[
            { k: "Formations ouvertes", v: String(programs.length) },
            { k: "Domaines", v: domains.length ? domains.slice(0, 2).join(", ") : "—" },
            { k: "Paiement", v: "En plusieurs fois" },
            { k: "Suivi", v: "Espace famille" },
          ].map((s) => (
            <div key={s.k} className="bg-[var(--color-surface)] px-5 py-5">
              <dt className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">{s.k}</dt>
              <dd className="mt-1 break-words font-[family-name:var(--font-heading)] text-[19px] font-semibold leading-tight sm:text-[28px]">{s.v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <EducationEssentials school={school} />
    </EducationShell>
  );
}
