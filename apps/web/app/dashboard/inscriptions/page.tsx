import type { Metadata } from "next";
import Link from "next/link";
import { withTenant, allocateInstallments, listClasses, listEnrollments, listPrograms } from "@yamacommerce/database";
import { hasPermission } from "@yamacommerce/auth";
import { requireEducationPage } from "@/lib/education/guard";
import { ENROLLMENT_LABELS, formatNumber } from "@/lib/education/labels";
import { PageHeader, Panel } from "@/components/yc/panel";
import { Pill } from "@/components/yc/status-pill";
import { EmptyState } from "@/components/yc/empty-state";
import { NewEnrollment } from "@/components/dashboard-education/enrollment-panels";

export const metadata: Metadata = { title: "Inscriptions — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const FILES = [
  { key: "", label: "En cours" },
  { key: "a-confirmer", label: "À confirmer" },
  { key: "retards", label: "Échéances en retard" },
  { key: "closes", label: "Closes" },
];
const uuid = (v?: string) => (v && /^[0-9a-f-]{36}$/.test(v) ? v : null);

/** Inscriptions : demandes en ligne à confirmer, dossiers en cours, retards de paiement, inscription au bureau. */
export default async function EnrollmentsPage({ searchParams }: { searchParams: { file?: string; q?: string; formation?: string } }) {
  const membership = await requireEducationPage("reservations.view");
  const tenantId = membership.tenantId;
  const file = FILES.some((f) => f.key === searchParams.file) ? searchParams.file! : "";
  const data = await withTenant(tenantId, async (tx) => {
    const tz = (await tx.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } }))?.timezone || "Africa/Dakar";
    return {
      today: new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date()),
      rows: await listEnrollments(tx, tenantId, { status: file === "closes" ? ["completed", "canceled", "no_show"] : file === "a-confirmer" ? ["requested"] : ["requested", "confirmed"], search: searchParams.q }),
      programs: await listPrograms(tx, tenantId),
      classes: await listClasses(tx, tenantId, { userId: null, all: true }, { activeOnly: true }),
      guardians: await tx.customer.findMany({ where: { tenantId, students: { some: {} } }, include: { students: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { firstName: "asc" }, take: 500 }),
    };
  });
  const rows = data.rows
    .map((r) => {
      const inst = allocateInstallments(r.enrollment?.installments ?? [], r.payments, data.today);
      const paid = r.payments.filter((p) => !p.voidedAt).reduce((s, p) => s + p.amount, 0);
      return { r, paid, late: inst.filter((i) => i.state === "overdue").reduce((s, i) => s + i.amount - i.covered, 0) };
    })
    .filter((x) => file !== "retards" || x.late > 0);
  return (
    <>
      <PageHeader eyebrow="Pilotage" title="Inscriptions" description="Montants calculés à partir de la formation, échéances affectées automatiquement aux encaissements réels. Rien n'est payé en ligne." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILES.map((f) => (
          <Link key={f.key} href={f.key ? `/dashboard/inscriptions?file=${f.key}` : "/dashboard/inscriptions"} aria-current={file === f.key ? "page" : undefined} className="rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold ring-1 ring-yc-ink/10 aria-[current=page]:bg-yc-night-900 aria-[current=page]:text-white">{f.label}</Link>
        ))}
        <form className="ml-auto w-full sm:w-auto"><input name="q" defaultValue={searchParams.q ?? ""} placeholder="Élève, dossier, téléphone" aria-label="Rechercher" className="h-10 w-full rounded-lg bg-white px-3 text-sm ring-1 ring-inset ring-yc-ink/12 sm:w-64" /><input type="hidden" name="file" value={file} /></form>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_440px]">
        <Panel className="overflow-hidden">
          {rows.length === 0 ? <EmptyState title="Aucune inscription ici" description="" /> : (
            <ul className="divide-y divide-yc-ink/[0.06]">
              {rows.map(({ r, paid, late }) => {
                const total = r.totalAmount ?? 0;
                const st = ENROLLMENT_LABELS[r.status] ?? { label: r.status, tone: "neutral" as const };
                return (
                  <li key={r.id}>
                    <Link href={`/dashboard/inscriptions/${r.id}`} className="grid gap-2 px-5 py-4 hover:bg-yc-ivory-50 sm:grid-cols-[1fr_190px_auto] sm:items-center">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{r.enrollment?.student.firstName} {r.enrollment?.student.lastName}</span>
                        <span className="block truncate text-sm text-yc-ink-soft">{r.listing?.title} · {r.enrollment?.classGroup?.name ?? "classe à affecter"} · {r.reference}</span>
                      </span>
                      <span className="text-sm">
                        <span className="yc-num font-semibold">{formatNumber(paid)}</span> / <span className="yc-num">{formatNumber(total)}</span> F
                        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-yc-ink/[0.08]"><span className="block h-full bg-[rgb(4_120_87)]" style={{ width: `${total ? Math.min(100, (paid / total) * 100) : 0}%` }} /></span>
                        {late > 0 && <span className="yc-num mt-1 block text-xs font-semibold text-yc-danger">{formatNumber(late)} F en retard</span>}
                      </span>
                      <Pill tone={st.tone}>{st.label}</Pill>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        {hasPermission(membership.permissions, "reservations.update_status") && (
          <NewEnrollment
            initialProgram={uuid(searchParams.formation)}
            programs={data.programs.filter((p) => p.program).map((p) => ({ id: p.id, title: p.title, tuition: p.price, registrationFee: p.program!.registrationFee, classes: data.classes.filter((c) => c.listingId === p.id).map((c) => ({ id: c.id, name: c.name, remaining: Math.max(0, c.capacity - c.enrolled) })) }))}
            guardians={data.guardians.map((g) => ({ id: g.id, name: `${g.firstName} ${g.lastName ?? ""} · ${g.phone ?? ""}`.trim(), students: g.students.map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}` })) }))}
          />
        )}
      </div>
    </>
  );
}
