import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { defaultInstallmentPlan } from "@yamacommerce/database";
import { resolveEducation } from "@/lib/education/education-context";
import { loadProgram } from "@/lib/education/education-data";
import { AUDIENCE_LABELS, CATEGORY_LABELS, FORMAT_LABELS, dateLabel, formatXof } from "@/lib/education/labels";
import { EducationShell, NOTEBOOK } from "@/components/education/education-shell";
import { Timetable } from "@/components/education/timetable";
import { EnrollmentForm } from "@/components/education/enrollment-form";
import { PublicSiteSuspended } from "@/components/public-site-suspended";
import { PublicSiteBillingSuspended } from "@/components/public-site-billing-suspended";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const r = await resolveEducation(`/formations/${params.slug}`);
  if (r.status !== "ok") return {};
  const p = await loadProgram(r.school.tenantId, params.slug);
  return p ? { title: `${p.program.title} — ${r.school.tenantName}`, description: p.program.summary ?? undefined } : {};
}
export const dynamic = "force-dynamic";

/** Fiche d'une formation PUBLIÉE : programme, classes et places, frais détaillés, inscription. */
export default async function ProgramPage({ params }: { params: { slug: string } }) {
  const r = await resolveEducation(`/formations/${params.slug}`);
  if (r.status === "suspended") return <PublicSiteSuspended tenantName={r.tenantName} />;
  if (r.status === "billing_suspended") return <PublicSiteBillingSuspended tenantName={r.tenantName} />;
  const { school } = r;
  const data = await loadProgram(school.tenantId, params.slug);
  if (!data) notFound();
  const { program: p, classes } = data;
  const img = p.images[0];
  const today = new Date().toISOString().slice(0, 10);
  // Échéancier INDICATIF calculé par le même moteur que l'inscription (aucun montant saisi).
  const plan = p.tuition != null ? defaultInstallmentPlan({ registrationFee: p.registrationFee, tuition: p.tuition, discountAmount: 0, count: p.defaultInstallments, firstDueDate: classes[0] && classes[0].startDate > today ? classes[0].startDate : today, enrollmentDate: today }) : [];
  const facts = [
    { k: "Domaine", v: CATEGORY_LABELS[p.category] ?? p.category },
    ...(p.level ? [{ k: "Niveau", v: p.level }] : []),
    ...(p.durationLabel ? [{ k: "Durée", v: p.durationLabel }] : []),
    { k: "Format", v: FORMAT_LABELS[p.format] ?? p.format },
    { k: "Public", v: AUDIENCE_LABELS[p.audience] ?? p.audience },
  ];
  return (
    <EducationShell school={school}>
      <nav aria-label="Fil d'Ariane" className="mx-auto max-w-[var(--content-max-width,1240px)] px-4 pt-6 text-[14px] text-[var(--color-text-muted)] sm:px-8">
        <Link href="/formations" className="font-medium hover:text-[var(--color-text-primary)]">← Toutes les formations</Link>
      </nav>
      <div className="mx-auto grid max-w-[var(--content-max-width,1240px)] gap-10 px-4 pt-4 sm:px-8 lg:grid-cols-[1.2fr_1fr]">
        <div className="min-w-0">
          <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--color-secondary)]">{CATEGORY_LABELS[p.category] ?? p.category}</p>
          <h1 className="mt-2 break-words font-[family-name:var(--font-heading)] text-[40px] font-semibold leading-[1.02] tracking-[-0.02em] sm:text-[56px]">{p.title}</h1>
          {p.summary && <p className="mt-4 max-w-2xl text-[18px] leading-relaxed text-[var(--color-text-secondary)]">{p.summary}</p>}
          {img && (
            <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-[var(--radius-lg)] ring-1 ring-[var(--color-border)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.alt} className="h-full w-full object-cover" />
              {img.demo && <span className="absolute right-3 top-3 rounded bg-black/55 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">Visuel de démonstration</span>}
            </div>
          )}
          <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-border)] ring-1 ring-[var(--color-border)] sm:grid-cols-3">
            {facts.map((f) => (
              <div key={f.k} className="bg-[var(--color-surface)] px-4 py-3.5">
                <dt className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{f.k}</dt>
                <dd className="mt-0.5 text-[16px] font-semibold">{f.v}</dd>
              </div>
            ))}
          </dl>
          {p.description && <div className="mt-8 whitespace-pre-line text-[16px] leading-[1.75] text-[var(--color-text-secondary)]">{p.description}</div>}

          <section aria-labelledby="classes" className="mt-12">
            <h2 id="classes" className="font-[family-name:var(--font-heading)] text-[30px] font-semibold tracking-[-0.01em]">Classes et horaires</h2>
            {classes.length ? (
              <ul className="mt-5 grid gap-4">
                {classes.map((c) => (
                  <li key={c.id} className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-5 ring-1 ring-[var(--color-border)]">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-[18px] font-semibold">{c.name}</h3>
                      <p className={`text-[14px] font-semibold ${c.remaining ? (c.remaining <= 3 ? "text-[var(--color-warning)]" : "text-[var(--color-success)]") : "text-[var(--color-text-muted)]"}`}>{c.remaining ? `${c.remaining} place${c.remaining > 1 ? "s" : ""} sur ${c.capacity}` : "Complet"}</p>
                    </div>
                    <p className="yc-num mt-1 text-[14px] text-[var(--color-text-muted)]">Du {dateLabel(c.startDate)} au {dateLabel(c.endDate)}{c.room ? ` · ${c.room}` : ""}</p>
                    <div className="mt-4"><Timetable schedule={c.schedule} /></div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-[15.5px] text-[var(--color-text-secondary)]">Les classes de la prochaine session seront bientôt ouvertes. Vous pouvez déjà envoyer une demande.</p>
            )}
          </section>
        </div>

        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] py-6 pl-[76px] pr-6 ring-1 ring-[var(--color-border)]" style={NOTEBOOK}>
            <h2 className="font-[family-name:var(--font-heading)] text-[26px] font-semibold leading-[32px]">Frais</h2>
            <dl className="yc-num text-[15.5px] leading-[32px]">
              <div className="flex justify-between gap-3"><dt>Frais d&apos;inscription</dt><dd className="font-semibold">{formatXof(p.registrationFee)}</dd></div>
              <div className="flex justify-between gap-3"><dt>Scolarité</dt><dd className="font-semibold">{formatXof(p.tuition)}</dd></div>
              {p.tuition != null && <div className="flex justify-between gap-3 border-t border-[var(--color-primary)]/30"><dt className="font-semibold">Total</dt><dd className="font-bold">{formatXof(p.registrationFee + p.tuition)}</dd></div>}
            </dl>
            {plan.length > 1 && (
              <>
                <p className="mt-4 text-[13px] font-semibold uppercase leading-[32px] tracking-[0.12em] text-[var(--color-secondary)]">Échéancier indicatif</p>
                <ol className="yc-num text-[14.5px] leading-[32px]">
                  {plan.map((i) => <li key={i.label} className="flex justify-between gap-3"><span>{i.label}</span><span>{formatXof(i.amount)}</span></li>)}
                </ol>
              </>
            )}
            <p className="mt-3 text-[13px] leading-[1.6] text-[var(--color-text-muted)]">Montants fixés par l&apos;établissement. Règlement à l&apos;accueil contre reçu ; rien n&apos;est payé en ligne.</p>
          </div>
          <div id="demande" className="mt-6 scroll-mt-24 rounded-[var(--radius-lg)] bg-[var(--color-surface-muted)] p-5 sm:p-6">
            <h2 className="font-[family-name:var(--font-heading)] text-[26px] font-semibold">Demande d&apos;inscription</h2>
            {school.rules.onlineEnrollment && p.tuition != null ? (
              <div className="mt-4"><EnrollmentForm listingId={p.id} classes={classes.map((c) => ({ id: c.id, name: c.name, schedule: c.schedule, startDate: c.startDate, remaining: c.remaining }))} /></div>
            ) : (
              <p className="mt-3 text-[15.5px] text-[var(--color-text-secondary)]">Les inscriptions se font à l&apos;accueil{school.contact.phone ? ` ou au ${school.contact.phone}` : ""}.</p>
            )}
          </div>
        </aside>
      </div>
    </EducationShell>
  );
}
