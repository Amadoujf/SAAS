import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveEducation } from "@/lib/education/education-context";
import { getStudentForGuest } from "@/lib/education/public-pipeline";
import { ATTENDANCE_LABELS, formatScore, shortDate } from "@/lib/education/labels";
import { EducationShell } from "@/components/education/education-shell";
import { Timetable } from "@/components/education/timetable";
import { PublicSiteSuspended } from "@/components/public-site-suspended";
import { PublicSiteBillingSuspended } from "@/components/public-site-billing-suspended";

export const metadata: Metadata = { title: "Espace élève", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Espace élève par lien personnel : ses classes, son emploi du temps, ses présences et notes publiées. */
export default async function StudentPage({ params }: { params: { token: string } }) {
  const r = await resolveEducation(`/eleve/${params.token}`);
  if (r.status === "suspended") return <PublicSiteSuspended tenantName={r.tenantName} />;
  if (r.status === "billing_suspended") return <PublicSiteBillingSuspended tenantName={r.tenantName} />;
  const { school } = r;
  const s = await getStudentForGuest(school.tenantId, params.token);
  if (!s) notFound();
  return (
    <EducationShell school={school}>
      <div className="mx-auto max-w-4xl px-4 pt-10 sm:px-8">
        <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--color-secondary)]">Espace élève</p>
        <h1 className="mt-2 font-[family-name:var(--font-heading)] text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-[52px]">{s.student.firstName} {s.student.lastName}</h1>

        <section aria-labelledby="mes-classes" className="mt-8">
          <h2 id="mes-classes" className="font-[family-name:var(--font-heading)] text-[28px] font-semibold">Mes classes</h2>
          {s.classes.length ? (
            <ul className="mt-4 grid gap-4">
              {s.classes.map((c, i) => (
                <li key={i} className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-5 ring-1 ring-[var(--color-border)]">
                  <p className="text-[17px] font-semibold">{c.program}{c.className ? ` · ${c.className}` : ""}</p>
                  <p className="text-[14px] text-[var(--color-text-muted)]">{[c.teacher && `Enseignant : ${c.teacher}`, c.room].filter(Boolean).join(" · ") || "Classe à confirmer"}</p>
                  <div className="mt-4"><Timetable schedule={c.schedule} /></div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[15px] text-[var(--color-text-secondary)]">Aucune classe en cours.</p>
          )}
        </section>

        <section aria-labelledby="mes-notes" className="mt-10">
          <h2 id="mes-notes" className="font-[family-name:var(--font-heading)] text-[28px] font-semibold">Mes notes</h2>
          {s.report.lines.some((l) => l.assessments.length) ? (
            s.report.lines.filter((l) => l.assessments.length).map((l) => (
              <div key={l.classGroupId} className="mt-4 rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-5 ring-1 ring-[var(--color-border)]">
                <p className="flex flex-wrap justify-between gap-2 text-[16px] font-semibold"><span>{l.className}</span>{l.average != null && <span className="yc-num">Moyenne {formatScore(l.average)}/{s.report.scale}</span>}</p>
                <ul className="yc-num mt-2 grid gap-1.5 text-[14.5px]">
                  {l.assessments.map((a) => <li key={a.id} className="flex justify-between gap-2 border-b border-dashed border-[var(--color-border)] pb-1.5"><span className="min-w-0">{a.title} <span className="text-[var(--color-text-muted)]">· {shortDate(a.date)} · coef. {formatScore(a.coefficient)}</span>{a.comment && <span className="block text-[13px] italic text-[var(--color-text-muted)]">« {a.comment} »</span>}</span><span className="shrink-0 font-semibold">{a.absent ? "Absent" : a.score == null ? "Non noté" : `${formatScore(a.score)}/${a.maxScore}`}</span></li>)}
                </ul>
              </div>
            ))
          ) : (
            <p className="mt-3 text-[15px] text-[var(--color-text-secondary)]">Aucune note publiée pour le moment.</p>
          )}
        </section>

        <section aria-labelledby="mes-presences" className="mt-10">
          <h2 id="mes-presences" className="font-[family-name:var(--font-heading)] text-[28px] font-semibold">Présences récentes</h2>
          {s.attendance.length ? (
            <ul className="mt-4 flex flex-wrap gap-2">
              {s.attendance.map((a, i) => {
                const l = ATTENDANCE_LABELS[a.status];
                return <li key={`${a.date}-${i}`} className="yc-num rounded-[var(--radius-md)] bg-[var(--color-surface)] px-3 py-2 text-[13.5px] ring-1 ring-[var(--color-border)]"><span className="block font-semibold">{shortDate(a.date)}</span><span className={a.status === "absent" ? "text-[var(--color-danger)]" : a.status === "late" ? "text-[var(--color-warning)]" : "text-[var(--color-text-muted)]"}>{l?.label ?? a.status}</span></li>;
              })}
            </ul>
          ) : (
            <p className="mt-3 text-[15px] text-[var(--color-text-secondary)]">Aucun appel enregistré pour le moment.</p>
          )}
        </section>
      </div>
    </EducationShell>
  );
}
