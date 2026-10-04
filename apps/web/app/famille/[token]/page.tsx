import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveEducation } from "@/lib/education/education-context";
import { getFamilyForGuest } from "@/lib/education/public-pipeline";
import { ATTENDANCE_LABELS, ENROLLMENT_LABELS, INSTALLMENT_LABELS, PAYMENT_METHOD_LABELS, dateLabel, dateTimeIn, formatScore, formatXof, shortDate } from "@/lib/education/labels";
import { EducationShell } from "@/components/education/education-shell";
import { PublicSiteSuspended } from "@/components/public-site-suspended";
import { PublicSiteBillingSuspended } from "@/components/public-site-billing-suspended";

export const metadata: Metadata = { title: "Espace famille", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const TONE: Record<string, string> = {
  success: "bg-[color-mix(in_srgb,var(--color-success)_14%,white)] text-[var(--color-success)]",
  danger: "bg-[color-mix(in_srgb,var(--color-danger)_12%,white)] text-[var(--color-danger)]",
  warning: "bg-[color-mix(in_srgb,var(--color-warning)_14%,white)] text-[var(--color-warning)]",
  info: "bg-[color-mix(in_srgb,var(--color-secondary)_14%,white)] text-[var(--color-secondary)]",
  neutral: "bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)]",
};
const Pill = ({ tone, children }: { tone: string; children: React.ReactNode }) => <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold ${TONE[tone] ?? TONE.neutral}`}>{children}</span>;

/**
 * Espace famille par lien personnel : SES enfants, leurs inscriptions, échéances (état
 * déduit des encaissements réels), reçus, présences et notes PUBLIÉES. Jamais ceux d'une
 * autre famille ; rien n'y est payable en ligne.
 */
export default async function FamilyPage({ params, searchParams }: { params: { token: string }; searchParams: Record<string, string | string[] | undefined> }) {
  const r = await resolveEducation(`/famille/${params.token}`);
  if (r.status === "suspended") return <PublicSiteSuspended tenantName={r.tenantName} />;
  if (r.status === "billing_suspended") return <PublicSiteBillingSuspended tenantName={r.tenantName} />;
  const { school } = r;
  const family = await getFamilyForGuest(school.tenantId, params.token);
  if (!family) notFound();
  const justSent = searchParams.demande === "1";
  return (
    <EducationShell school={school}>
      <div className="mx-auto max-w-4xl px-4 pt-10 sm:px-8">
        <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--color-secondary)]">Espace famille</p>
        <h1 className="mt-2 font-[family-name:var(--font-heading)] text-[40px] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-[52px]">Bonjour {family.guardian.firstName}</h1>
        {justSent && (
          <p role="status" className="mt-5 rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--color-success)_12%,white)] p-4 text-[15.5px] font-medium text-[var(--color-success)]">
            Demande d&apos;inscription envoyée. L&apos;établissement vous recontacte pour confirmer la classe. Rien n&apos;a été payé en ligne. Gardez ce lien : il vous donne accès à cet espace.
          </p>
        )}
        <p className="mt-3 text-[15px] text-[var(--color-text-secondary)]">Ce lien est personnel. S&apos;il a été partagé par erreur, demandez à l&apos;établissement de le renouveler.</p>

        {family.children.map(({ student, enrollments, attendance, report }) => (
          <section key={student.id} aria-labelledby={`eleve-${student.id}`} className="mt-10 rounded-[var(--radius-lg)] bg-[var(--color-surface)] ring-1 ring-[var(--color-border)]">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4 sm:px-6">
              <h2 id={`eleve-${student.id}`} className="font-[family-name:var(--font-heading)] text-[28px] font-semibold">{student.firstName} {student.lastName}</h2>
              <Link href={`/eleve/${student.accessToken}`} className="text-[14px] font-semibold underline decoration-[var(--color-accent-primary)] decoration-2 underline-offset-4">Espace de l&apos;élève →</Link>
            </header>

            {enrollments.map((e) => {
              const st = ENROLLMENT_LABELS[e.status] ?? { label: e.status, tone: "neutral", guest: "" };
              const paid = e.receipts.reduce((s, p) => s + p.amount, 0);
              const remaining = Math.max(0, e.totalAmount - paid);
              return (
                <div key={e.id} className="border-b border-[var(--color-border)] px-5 py-5 last:border-b-0 sm:px-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-[17px] font-semibold">{e.program}{e.className ? <span className="font-normal text-[var(--color-text-muted)]"> · {e.className}</span> : null}</p>
                    <Pill tone={st.tone}>{st.label}</Pill>
                  </div>
                  <p className="mt-1 text-[14px] text-[var(--color-text-muted)]">Dossier {e.reference} — {st.guest}</p>
                  <dl className="yc-num mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-border)] text-center ring-1 ring-[var(--color-border)]">
                    <div className="bg-white px-2 py-2.5"><dt className="text-[11.5px] uppercase tracking-[0.1em] text-[var(--color-text-muted)]">Total</dt><dd className="text-[15.5px] font-semibold">{formatXof(e.totalAmount)}</dd></div>
                    <div className="bg-white px-2 py-2.5"><dt className="text-[11.5px] uppercase tracking-[0.1em] text-[var(--color-text-muted)]">Réglé</dt><dd className="text-[15.5px] font-semibold text-[var(--color-success)]">{formatXof(paid)}</dd></div>
                    <div className="bg-white px-2 py-2.5"><dt className="text-[11.5px] uppercase tracking-[0.1em] text-[var(--color-text-muted)]">Reste</dt><dd className="text-[15.5px] font-semibold">{formatXof(remaining)}</dd></div>
                  </dl>
                  {e.discountAmount > 0 && <p className="mt-2 text-[13.5px] text-[var(--color-text-muted)]">Remise accordée : {formatXof(e.discountAmount)}</p>}
                  {e.installments.length > 0 && (
                    <table className="yc-num mt-4 w-full text-left text-[14.5px]">
                      <caption className="sr-only">Échéances</caption>
                      <thead><tr className="text-[12px] uppercase tracking-[0.1em] text-[var(--color-text-muted)]"><th className="py-1.5 font-semibold">Échéance</th><th className="hidden py-1.5 font-semibold sm:table-cell">Date</th><th className="py-1.5 text-right font-semibold">Montant</th><th className="py-1.5 text-right font-semibold">État</th></tr></thead>
                      <tbody>
                        {e.installments.map((i) => (
                          <tr key={i.id} className="border-t border-[var(--color-border)]">
                            <td className="py-2">{i.label}<span className="block text-[12.5px] text-[var(--color-text-muted)] sm:hidden">{shortDate(i.dueDate)}</span></td>
                            <td className="hidden py-2 sm:table-cell">{dateLabel(i.dueDate)}</td>
                            <td className="py-2 text-right">{formatXof(i.amount)}{i.state === "partial" || (i.state === "overdue" && i.covered > 0) ? <span className="block text-[12px] text-[var(--color-text-muted)]">dont {formatXof(i.covered)} réglés</span> : null}</td>
                            <td className="py-2 text-right"><Pill tone={INSTALLMENT_LABELS[i.state]!.tone}>{INSTALLMENT_LABELS[i.state]!.label}</Pill></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {e.receipts.length > 0 && (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-[14px] font-semibold">Reçus ({e.receipts.length})</summary>
                      <ul className="yc-num mt-2 grid gap-1.5 text-[14px]">
                        {e.receipts.map((p) => <li key={p.receiptNumber} className="flex flex-wrap justify-between gap-2 border-b border-dashed border-[var(--color-border)] pb-1.5"><span>{p.receiptNumber} · {dateTimeIn(p.paidAt, school.timezone)}</span><span>{formatXof(p.amount)} · {PAYMENT_METHOD_LABELS[p.method] ?? p.method}</span></li>)}
                      </ul>
                      <p className="mt-2 text-[12.5px] text-[var(--color-text-muted)]">Encaissements enregistrés par l&apos;établissement (aucun paiement en ligne).</p>
                    </details>
                  )}
                </div>
              );
            })}

            <div className="grid gap-6 px-5 py-5 sm:grid-cols-[1fr_1.4fr] sm:px-6">
              <div>
                <h3 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">Présences</h3>
                <ul className="mt-2 grid grid-cols-2 gap-2">
                  {(["present", "absent", "late", "excused"] as const).map((k) => (
                    <li key={k} className="rounded-[var(--radius-md)] bg-white px-3 py-2 ring-1 ring-inset ring-[var(--color-border)]"><span className="yc-num block text-[20px] font-semibold">{attendance[k] ?? 0}</span><span className="text-[12.5px] text-[var(--color-text-muted)]">{ATTENDANCE_LABELS[k]!.label}</span></li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">Notes publiées</h3>
                {report.lines.some((l) => l.assessments.length) ? (
                  report.lines.filter((l) => l.assessments.length).map((l) => (
                    <div key={l.classGroupId} className="mt-2">
                      <p className="flex justify-between text-[14.5px] font-semibold"><span>{l.className}</span>{l.average != null && <span className="yc-num">Moyenne {formatScore(l.average)}/{report.scale}</span>}</p>
                      <ul className="yc-num mt-1 grid gap-1 text-[14px]">
                        {l.assessments.map((a) => <li key={a.id} className="flex justify-between gap-2 border-b border-dashed border-[var(--color-border)] pb-1"><span className="min-w-0 truncate">{a.title} <span className="text-[var(--color-text-muted)]">· coef. {formatScore(a.coefficient)}</span></span><span className="shrink-0 font-semibold">{a.absent ? "Absent" : a.score == null ? "Non noté" : `${formatScore(a.score)}/${a.maxScore}`}</span></li>)}
                      </ul>
                    </div>
                  ))
                ) : (
                  <p className="mt-2 text-[14px] text-[var(--color-text-muted)]">Aucune note publiée pour le moment.</p>
                )}
              </div>
            </div>
          </section>
        ))}
      </div>
    </EducationShell>
  );
}
