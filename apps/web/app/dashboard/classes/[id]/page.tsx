import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { withTenant, absenceSummary, getAttendanceSheet, getClassRoster, getEducationSettings, isIsoDate, EducationError } from "@yamacommerce/database";
import { requireEducationPage } from "@/lib/education/guard";
import { dateLabel, scheduleText, type Slot } from "@/lib/education/labels";
import { PageHeader, Panel, PanelHeader } from "@/components/yc/panel";
import { AttendanceSheet } from "@/components/dashboard-education/attendance-sheet";
import { GradeSheet, NewAssessment } from "@/components/dashboard-education/grades-panel";
import { ClassForm } from "@/components/dashboard-education/class-form";
import { section } from "@/components/dashboard-education/shared";

export const metadata: Metadata = { title: "Classe — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Une classe : liste des élèves inscrits, appel de la séance, absences cumulées,
 * évaluations et notes. Un enseignant n'ouvre que SES classes (portée vérifiée par le
 * registre : une autre classe est « introuvable »).
 */
export default async function ClassPage({ params, searchParams }: { params: { id: string }; searchParams: { date?: string } }) {
  const membership = await requireEducationPage("academics.view");
  if (!/^[0-9a-f-]{36}$/.test(params.id)) notFound();
  const tenantId = membership.tenantId;
  const scope = membership.scope;
  const data = await withTenant(tenantId, async (tx) => {
    try {
      const roster = await getClassRoster(tx, tenantId, params.id, scope);
      const tz = (await tx.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } }))?.timezone || "Africa/Dakar";
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
      const start = roster.classGroup.startDate.toISOString().slice(0, 10);
      const end = roster.classGroup.endDate.toISOString().slice(0, 10);
      const wanted = searchParams.date && isIsoDate(searchParams.date) ? searchParams.date : today;
      const date = wanted < start ? start : wanted > end ? end : wanted > today ? today : wanted;
      return {
        roster,
        today,
        date,
        sheet: await getAttendanceSheet(tx, tenantId, params.id, date, scope),
        absences: await absenceSummary(tx, tenantId, params.id, scope),
        settings: await getEducationSettings(tx, tenantId),
        teachers: scope.all ? await tx.tenantUser.findMany({ where: { tenantId, status: "ACTIVE" }, include: { user: { select: { id: true, fullName: true } } } }) : [],
      };
    } catch (error) {
      if (error instanceof EducationError) return null;
      throw error;
    }
  });
  if (!data) notFound();
  const { roster } = data;
  const c = roster.classGroup;
  const students = roster.students.map((s) => ({ id: s.id, name: `${s.lastName.toUpperCase()} ${s.firstName}` }));
  const recorded = Object.fromEntries(data.sheet.map((r) => [r.studentId, r.status as "present" | "absent" | "late" | "excused"]));
  const alerts = students.filter((s) => (data.absences.byStudent.get(s.id)?.absent ?? 0) >= data.absences.threshold);
  const started = c.startDate.toISOString().slice(0, 10) <= data.today;
  return (
    <>
      <PageHeader eyebrow={<Link href="/dashboard/classes">← {scope.all ? "Classes" : "Mes classes"}</Link>} title={`${c.name}`} description={`${roster.program?.title ?? ""} · ${scheduleText(c.schedule as unknown as Slot[])} · du ${dateLabel(c.startDate)} au ${dateLabel(c.endDate)}`} />
      {alerts.length > 0 && (
        <p role="status" className="mb-5 rounded-xl bg-[#FFF4E5] px-4 py-3 text-sm font-medium text-[#8A4B00] ring-1 ring-[#F5C27A]">
          {alerts.length} élève{alerts.length > 1 ? "s ont" : " a"} atteint le seuil de {data.absences.threshold} absences non justifiées : {alerts.map((s) => s.name).join(", ")}.
        </p>
      )}
      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <div className="grid content-start gap-5">
          {started ? (
            <AttendanceSheet key={data.date} classGroupId={c.id} date={data.date} today={data.today} minDate={c.startDate.toISOString().slice(0, 10)} maxDate={c.endDate.toISOString().slice(0, 10)} students={students} recorded={recorded} />
          ) : (
            <section className={section}><h2 className="text-[17px] font-bold">Appel</h2><p className="mt-1 text-sm text-yc-ink-soft">La classe commence le {dateLabel(c.startDate)}.</p></section>
          )}
          <Panel className="overflow-hidden">
            <PanelHeader title={`Élèves (${students.length}/${c.capacity})`} />
            {students.length === 0 ? <p className="px-5 pb-5 text-sm text-yc-ink-soft">Aucun élève inscrit.</p> : (
              <table className="w-full text-left text-sm">
                <thead><tr className="text-xs uppercase tracking-[0.08em] text-yc-ink-soft"><th className="px-5 py-2 font-semibold">Élève</th><th className="px-2 py-2 text-center font-semibold">Abs.</th><th className="px-2 py-2 text-center font-semibold">Ret.</th><th className="px-5 py-2 text-center font-semibold">Just.</th></tr></thead>
                <tbody className="divide-y divide-yc-ink/[0.06]">
                  {students.map((s) => {
                    const m = data.absences.byStudent.get(s.id);
                    return (
                      <tr key={s.id}>
                        <td className="px-5 py-2.5 font-medium">{s.name}</td>
                        <td className={`yc-num px-2 py-2.5 text-center ${(m?.absent ?? 0) >= data.absences.threshold ? "font-bold text-yc-danger" : ""}`}>{m?.absent ?? 0}</td>
                        <td className="yc-num px-2 py-2.5 text-center">{m?.late ?? 0}</td>
                        <td className="yc-num px-5 py-2.5 text-center">{m?.excused ?? 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Panel>
          {scope.all && (
            <ClassForm
              listingId={c.listingId}
              classGroupId={c.id}
              title="Réglages de la classe"
              teachers={data.teachers.map((t) => ({ id: t.user.id, name: t.user.fullName }))}
              initial={{ name: c.name, teacherUserId: c.teacherUserId ?? "", room: c.room ?? "", startDate: c.startDate.toISOString().slice(0, 10), endDate: c.endDate.toISOString().slice(0, 10), capacity: String(c.capacity), schedule: c.schedule as unknown as Slot[], isActive: c.isActive }}
            />
          )}
        </div>
        <div className="grid content-start gap-5">
          <section className={section} aria-labelledby="evaluations">
            <h2 id="evaluations" className="text-[17px] font-bold">Évaluations</h2>
            <p className="mb-4 mt-1 text-sm text-yc-ink-soft">Barème de l&apos;établissement : sur {data.settings.gradeScale}. Les familles voient les notes une fois publiées.</p>
            <NewAssessment classGroupId={c.id} today={data.today} scale={data.settings.gradeScale} />
          </section>
          {roster.assessments.map((a) => (
            <GradeSheet
              key={a.id}
              students={students}
              canManage={scope.all}
              assessment={{ id: a.id, title: a.title, date: a.date.toISOString().slice(0, 10), coefficient: Number(a.coefficient), maxScore: a.maxScore, publishedAt: a.publishedAt?.toISOString() ?? null, grades: Object.fromEntries(a.grades.map((g) => [g.studentId, { score: g.score == null ? null : Number(g.score), absent: g.absent, comment: g.comment }])) }}
            />
          ))}
        </div>
      </div>
    </>
  );
}
