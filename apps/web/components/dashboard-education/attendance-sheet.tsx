"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/yc/button";
import { ATTENDANCE_LABELS } from "@/lib/education/labels";
import { Feedback, section, useEduAction } from "./shared";

type Student = { id: string; name: string };
const STATUSES = ["present", "absent", "late", "excused"] as const;
type Status = (typeof STATUSES)[number];
const TONE: Record<Status, string> = {
  present: "bg-[rgb(4_120_87)] text-white ring-[rgb(4_120_87)]",
  absent: "bg-yc-danger text-white ring-yc-danger",
  late: "bg-[#B45309] text-white ring-[#B45309]",
  excused: "bg-yc-electric text-white ring-yc-electric",
};

/**
 * Feuille d'appel d'une séance : un geste par élève (P / A / R / J), tous présents par
 * défaut. Seuls les élèves inscrits dans la classe apparaissent ; le serveur le revérifie.
 */
export function AttendanceSheet({ classGroupId, date, today, minDate, maxDate, students, recorded }: { classGroupId: string; date: string; today: string; minDate: string; maxDate: string; students: Student[]; recorded: Record<string, Status> }) {
  const router = useRouter();
  const a = useEduAction();
  const [marks, setMarks] = useState<Record<string, Status>>(() => Object.fromEntries(students.map((s) => [s.id, recorded[s.id] ?? "present"])));
  const already = Object.keys(recorded).length > 0;
  const counts = STATUSES.map((k) => ({ k, n: Object.values(marks).filter((v) => v === k).length }));
  return (
    <section className={section} aria-labelledby="appel">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="appel" className="text-[17px] font-bold">Appel</h2>
          <p className="text-sm text-yc-ink-soft">{already ? "Appel déjà fait pour cette date : vous pouvez le corriger." : "Tous présents par défaut : touchez un élève absent ou en retard."}</p>
        </div>
        <label className="grid text-[13px] font-semibold">Séance du
          <input type="date" value={date} min={minDate} max={maxDate < today ? maxDate : today} onChange={(e) => e.target.value && router.push(`?date=${e.target.value}#appel`)} className="mt-1 h-10 rounded-lg px-3 text-sm ring-1 ring-inset ring-yc-ink/12" />
        </label>
      </div>
      {students.length === 0 ? <p className="mt-4 text-sm text-yc-ink-soft">Aucun élève inscrit dans cette classe.</p> : (
        <>
          <ul className="mt-4 divide-y divide-yc-ink/[0.06]">
            {students.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="min-w-0 font-medium">{s.name}</span>
                <span role="radiogroup" aria-label={`Présence de ${s.name}`} className="flex gap-1">
                  {STATUSES.map((k) => (
                    <button key={k} type="button" role="radio" aria-checked={marks[s.id] === k} title={ATTENDANCE_LABELS[k]!.label} onClick={() => setMarks({ ...marks, [s.id]: k })} className={`h-10 w-10 rounded-lg text-sm font-bold ring-1 ring-inset ${marks[s.id] === k ? TONE[k] : "bg-white text-yc-ink-soft ring-yc-ink/12"}`}>
                      {ATTENDANCE_LABELS[k]!.short}
                      <span className="sr-only"> — {ATTENDANCE_LABELS[k]!.label}</span>
                    </button>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-yc-ink-soft">{counts.map((c) => `${ATTENDANCE_LABELS[c.k]!.label} : ${c.n}`).join(" · ")} — P présent, A absent, R retard, J absence justifiée.</p>
          <Button type="button" variant="royal" className="mt-3" loading={a.pending} onClick={() => a.run({ action: "attendance", attendance: { classGroupId, sessionDate: date, entries: students.map((s) => ({ studentId: s.id, status: marks[s.id] })) } }, "Appel enregistré.")}>Enregistrer l&apos;appel</Button>
          <Feedback error={a.error} notice={a.notice} />
        </>
      )}
    </section>
  );
}
