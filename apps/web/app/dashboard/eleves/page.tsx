import type { Metadata } from "next";
import Link from "next/link";
import { withTenant, listStudents } from "@yamacommerce/database";
import { requireEducationPage } from "@/lib/education/guard";
import { RELATION_LABELS, dateLabel } from "@/lib/education/labels";
import { PageHeader, Panel } from "@/components/yc/panel";
import { EmptyState } from "@/components/yc/empty-state";

export const metadata: Metadata = { title: "Élèves — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Élèves et leurs responsables : classes en cours, contact, dossiers d'inscription. */
export default async function StudentsPage({ searchParams }: { searchParams: { q?: string } }) {
  const membership = await requireEducationPage("customers.view");
  const tenantId = membership.tenantId;
  const [students, open] = await withTenant(tenantId, async (tx) => [
    await listStudents(tx, tenantId, { search: searchParams.q }),
    await tx.reservation.findMany({ where: { tenantId, moduleKey: "enrollments", status: { in: ["requested", "confirmed"] } }, select: { id: true, enrollment: { select: { studentId: true } } } }),
  ] as const);
  const dossier = new Map(open.map((r) => [r.enrollment?.studentId, r.id]));
  return (
    <>
      <PageHeader eyebrow="Pilotage" title="Élèves" description="Chaque élève est rattaché à son responsable (parent, tuteur, ou lui-même s'il est majeur)." />
      <form className="mb-4"><input name="q" defaultValue={searchParams.q ?? ""} placeholder="Nom, prénom, téléphone du responsable" aria-label="Rechercher" className="h-10 w-full rounded-lg bg-white px-3 text-sm ring-1 ring-inset ring-yc-ink/12 sm:w-80" /></form>
      <Panel className="overflow-hidden">
        {students.length === 0 ? <EmptyState title="Aucun élève" description="Les élèves apparaissent à leur première inscription." /> : (
          <ul className="divide-y divide-yc-ink/[0.06]">
            {students.map((s) => {
              const id = dossier.get(s.id);
              const inner = (
                <>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{s.lastName.toUpperCase()} {s.firstName}{s.birthDate ? <span className="font-normal text-yc-ink-soft"> · {dateLabel(s.birthDate)}</span> : null}</span>
                    <span className="block truncate text-sm text-yc-ink-soft">{RELATION_LABELS[s.guardianRelation]} : {s.guardian.firstName} {s.guardian.lastName ?? ""} · {s.guardian.phone ?? "sans téléphone"}</span>
                  </span>
                  <span className="text-sm text-yc-ink-soft">{s.enrollments.map((e) => e.classGroup?.name ?? "classe à affecter").join(", ") || "Aucune inscription en cours"}</span>
                </>
              );
              return <li key={s.id}>{id ? <Link href={`/dashboard/inscriptions/${id}`} className="grid gap-1 px-5 py-3.5 hover:bg-yc-ivory-50 sm:grid-cols-[1fr_auto] sm:items-center">{inner}</Link> : <div className="grid gap-1 px-5 py-3.5 sm:grid-cols-[1fr_auto] sm:items-center">{inner}</div>}</li>;
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}
