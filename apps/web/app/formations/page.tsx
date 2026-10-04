import type { Metadata } from "next";
import Link from "next/link";
import { resolveEducation } from "@/lib/education/education-context";
import { loadPrograms } from "@/lib/education/education-data";
import { CATEGORY_LABELS } from "@/lib/education/labels";
import { EducationShell } from "@/components/education/education-shell";
import { ProgramCard } from "@/components/education/program-card";
import { PublicSiteSuspended } from "@/components/public-site-suspended";
import { PublicSiteBillingSuspended } from "@/components/public-site-billing-suspended";

export async function generateMetadata(): Promise<Metadata> {
  const r = await resolveEducation("/formations");
  return r.status === "ok" ? { title: `Formations — ${r.school.tenantName}` } : {};
}
export const dynamic = "force-dynamic";

/** Toutes les formations publiées, filtrables par domaine (lien partageable, sans JavaScript). */
export default async function ProgramsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const r = await resolveEducation("/formations");
  if (r.status === "suspended") return <PublicSiteSuspended tenantName={r.tenantName} />;
  if (r.status === "billing_suspended") return <PublicSiteBillingSuspended tenantName={r.tenantName} />;
  const { school } = r;
  const all = await loadPrograms(school.tenantId);
  const domain = typeof searchParams.domaine === "string" && CATEGORY_LABELS[searchParams.domaine] ? searchParams.domaine : null;
  const programs = domain ? all.filter((p) => p.category === domain) : all;
  const categories = [...new Set(all.map((p) => p.category))];
  return (
    <EducationShell school={school}>
      <div className="mx-auto max-w-[var(--content-max-width,1240px)] px-4 pt-10 sm:px-8">
        <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--color-secondary)]">{school.rules.academicYear ? `Année ${school.rules.academicYear}` : "Inscriptions"}</p>
        <h1 className="mt-2 font-[family-name:var(--font-heading)] text-[42px] font-semibold leading-[1] tracking-[-0.02em] sm:text-[60px]">{domain ? CATEGORY_LABELS[domain] : "Toutes nos formations"}</h1>
        {categories.length > 1 && (
          <nav aria-label="Domaines" className="mt-6 flex flex-wrap gap-2">
            <Link href="/formations" aria-current={!domain ? "page" : undefined} className="inline-flex h-10 items-center rounded-full px-4 text-[14px] font-medium ring-1 ring-inset ring-[var(--color-border)] aria-[current=page]:bg-[var(--color-primary)] aria-[current=page]:text-white aria-[current=page]:ring-[var(--color-primary)]">Toutes ({all.length})</Link>
            {categories.map((c) => (
              <Link key={c} href={`/formations?domaine=${c}`} aria-current={domain === c ? "page" : undefined} className="inline-flex h-10 items-center rounded-full px-4 text-[14px] font-medium ring-1 ring-inset ring-[var(--color-border)] aria-[current=page]:bg-[var(--color-primary)] aria-[current=page]:text-white aria-[current=page]:ring-[var(--color-primary)]">
                {CATEGORY_LABELS[c] ?? c} ({all.filter((p) => p.category === c).length})
              </Link>
            ))}
          </nav>
        )}
        {programs.length ? (
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {programs.map((p, i) => <li key={p.id} className="min-w-0"><ProgramCard p={p} priority={i < 3} /></li>)}
          </ul>
        ) : (
          <p className="mt-10 rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-8 text-center text-[16px] text-[var(--color-text-secondary)] ring-1 ring-[var(--color-border)]">Aucune formation n&apos;est ouverte pour le moment. Appelez-nous pour la prochaine rentrée.</p>
        )}
      </div>
    </EducationShell>
  );
}
