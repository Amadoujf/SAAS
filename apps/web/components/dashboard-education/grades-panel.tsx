"use client";

import { useState } from "react";
import { Button } from "@/components/yc/button";
import { formatScore, shortDate } from "@/lib/education/labels";
import { Feedback, input, label, section, useEduAction } from "./shared";

type Student = { id: string; name: string };
type Assessment = { id: string; title: string; date: string; coefficient: number; maxScore: number; publishedAt: string | null; grades: Record<string, { score: number | null; absent: boolean; comment: string | null }> };

/** Nouvelle évaluation (barème par défaut de l'établissement). */
export function NewAssessment({ classGroupId, today, scale }: { classGroupId: string; today: string; scale: number }) {
  const a = useEduAction();
  const [f, setF] = useState({ title: "", date: today, coefficient: "1", maxScore: String(scale) });
  return (
    <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); a.run({ action: "new_assessment", assessment: { classGroupId, title: f.title, date: f.date, coefficient: Number(f.coefficient.replace(",", ".")), maxScore: Number(f.maxScore) } }, "Évaluation créée.", () => setF({ ...f, title: "" })); }}>
      <div className="grid gap-3 sm:grid-cols-[1.6fr_1fr_0.7fr_0.7fr]">
        <label className={label}>Intitulé<input required maxLength={120} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Devoir n° 1" className={input} /></label>
        <label className={label}>Date<input required type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className={input} /></label>
        <label className={label}>Coef.<input required inputMode="decimal" value={f.coefficient} onChange={(e) => setF({ ...f, coefficient: e.target.value })} className={input} /></label>
        <label className={label}>Sur<input required type="number" min={1} max={1000} value={f.maxScore} onChange={(e) => setF({ ...f, maxScore: e.target.value })} className={input} /></label>
      </div>
      <div><Button type="submit" variant="secondary" loading={a.pending}>Créer l&apos;évaluation</Button></div>
      <Feedback error={a.error} notice={a.notice} />
    </form>
  );
}

/**
 * Saisie des notes d'une évaluation : note entre 0 et le barème (revérifiée par le
 * serveur et la base), « Abs. » pour un élève absent. Les familles ne voient les notes
 * qu'après publication ; une fois publiées, seule l'administration les corrige.
 */
export function GradeSheet({ assessment, students, canManage }: { assessment: Assessment; students: Student[]; canManage: boolean }) {
  const a = useEduAction();
  const [rows, setRows] = useState(() => Object.fromEntries(students.map((s) => {
    const g = assessment.grades[s.id];
    return [s.id, { score: g?.score != null ? String(g.score).replace(".", ",") : "", absent: g?.absent ?? false, comment: g?.comment ?? "" }];
  })));
  const locked = !!assessment.publishedAt && !canManage;
  const entries = () => students.flatMap((s) => {
    const r = rows[s.id]!;
    if (r.absent) return [{ studentId: s.id, absent: true, comment: r.comment || null }];
    if (r.score.trim() === "") return [];
    return [{ studentId: s.id, score: Number(r.score.replace(",", ".")), absent: false, comment: r.comment || null }];
  });
  const filled = entries().length;
  return (
    <section className={section} aria-label={assessment.title}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[16px] font-bold">{assessment.title} <span className="font-normal text-yc-ink-soft">· {shortDate(assessment.date)} · coef. {formatScore(assessment.coefficient)} · sur {assessment.maxScore}</span></h3>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${assessment.publishedAt ? "bg-[rgb(4_120_87/0.1)] text-[rgb(4_120_87)]" : "bg-yc-ink/[0.06] text-yc-ink-soft"}`}>{assessment.publishedAt ? "Publiée aux familles" : "Non publiée"}</span>
      </div>
      <ul className="mt-3 divide-y divide-yc-ink/[0.06]">
        {students.map((s) => {
          const r = rows[s.id]!;
          const set = (patch: Partial<typeof r>) => setRows({ ...rows, [s.id]: { ...r, ...patch } });
          return (
            <li key={s.id} className="grid grid-cols-[1fr_88px_auto] items-center gap-2 py-2 sm:grid-cols-[1fr_96px_auto_1fr]">
              <span className="min-w-0 truncate text-sm font-medium">{s.name}</span>
              <input aria-label={`Note de ${s.name}`} inputMode="decimal" disabled={locked || r.absent} value={r.absent ? "" : r.score} onChange={(e) => set({ score: e.target.value.replace(/[^\d.,]/g, "") })} placeholder={`/${assessment.maxScore}`} className="yc-num h-10 w-full rounded-lg px-2 text-center text-sm ring-1 ring-inset ring-yc-ink/12 disabled:bg-yc-ink/[0.03]" />
              <label className="flex items-center gap-1.5 text-xs font-semibold"><input type="checkbox" disabled={locked} checked={r.absent} onChange={(e) => set({ absent: e.target.checked })} className="h-4 w-4" /> Abs.</label>
              <input aria-label={`Appréciation pour ${s.name}`} disabled={locked} maxLength={300} value={r.comment} onChange={(e) => set({ comment: e.target.value })} placeholder="Appréciation (facultatif)" className="col-span-3 h-10 w-full rounded-lg px-2 text-sm ring-1 ring-inset ring-yc-ink/12 sm:col-span-1" />
            </li>
          );
        })}
      </ul>
      {!locked && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="royal" loading={a.pending} disabled={!filled} onClick={() => a.run({ action: "grades", grades: { assessmentId: assessment.id, entries: entries() } }, `${filled} note${filled > 1 ? "s" : ""} enregistrée${filled > 1 ? "s" : ""}.`)}>Enregistrer les notes</Button>
          {!assessment.publishedAt && <Button type="button" variant="secondary" disabled={a.pending} onClick={() => window.confirm("Publier ces notes ? Les élèves et les familles les verront dans leur espace.") && a.run({ action: "publish_grades", assessmentId: assessment.id }, "Notes publiées : visibles des familles.")}>Publier aux familles</Button>}
        </div>
      )}
      {locked && <p className="mt-3 text-xs text-yc-ink-soft">Notes publiées : une correction passe par l&apos;administration.</p>}
      <Feedback error={a.error} notice={a.notice} />
    </section>
  );
}
