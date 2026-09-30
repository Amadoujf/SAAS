import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { resolveCourier } from "@/lib/courier/courier-context";
import { getTrackingForGuest } from "@/lib/courier/public-pipeline";
import { JOB_LABELS, TRACK_STEPS, dateTimeIn, formatXof } from "@/lib/courier/labels";
import { CourierShell } from "@/components/courier/courier-shell";
import { CopyLink } from "@/components/courier/copy-link";
import { PublicSiteSuspended } from "@/components/public-site-suspended";
import { PublicSiteBillingSuspended } from "@/components/public-site-billing-suspended";

export const metadata: Metadata = { title: "Suivi du colis", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const STEP_LABEL: Record<string, string> = { pending: "Enregistrée", assigned: "Livreur désigné", picked_up: "Colis pris", in_transit: "En route", delivered: "Livré" };

/** Suivi par lien : l'expéditeur voit l'avancement et l'historique ; le destinataire, son code de remise. */
export default async function TrackingPage({ params, searchParams }: { params: { token: string }; searchParams: Record<string, string | string[] | undefined> }) {
  const r = await resolveCourier(`/colis/${params.token}`);
  if (r.status === "suspended") return <PublicSiteSuspended tenantName={r.tenantName} />;
  if (r.status === "billing_suspended") return <PublicSiteBillingSuspended tenantName={r.tenantName} />;
  const { company } = r;
  const t = await getTrackingForGuest(company.tenantId, params.token);
  if (!t) notFound();
  const st = JOB_LABELS[t.status] ?? { label: t.status, tone: "neutral", guest: "" };
  const reached = TRACK_STEPS.indexOf(t.status as (typeof TRACK_STEPS)[number]);
  const offTrack = reached < 0;
  const host = (await headers()).get("host") ?? "";
  const recipientUrl = t.recipientToken ? `${host.startsWith("localhost") ? "http" : "https"}://${host}/colis/${t.recipientToken}` : null;
  return (
    <CourierShell company={company}>
      <div className="mx-auto max-w-3xl px-4 pt-10 sm:px-8">
        {searchParams.nouvelle === "1" && (
          <p role="status" className="mb-6 rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--color-success)_12%,white)] p-4 text-[15px] font-medium text-[var(--color-success)]">Course enregistrée. Gardez ce lien pour la suivre. Rien n&apos;a été payé en ligne.</p>
        )}
        <p className="yc-num text-[13px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent-secondary)]">{t.reference} · {t.role === "recipient" ? "Vous recevez un colis" : "Votre envoi"}</p>
        <h1 className="mt-2 font-[family-name:var(--font-heading)] text-[44px] leading-[1] tracking-[-0.03em] sm:text-[60px]">{st.label}</h1>
        <p className="mt-3 text-[17px]" aria-live="polite">{st.guest}{t.status === "failed" && t.failureReason ? ` Motif : ${t.failureReason}.` : ""}</p>

        {t.role === "recipient" && t.code && (
          <div className="mt-8 rounded-[var(--radius-lg)] bg-[var(--color-primary)] p-6 text-white">
            <p className="text-[13px] font-bold uppercase tracking-[0.16em] text-[var(--color-accent-primary)]">Votre code de remise</p>
            <p className="yc-num mt-2 font-[family-name:var(--font-heading)] text-[64px] leading-none tracking-[0.2em]">{t.code}</p>
            <p className="mt-3 text-[15px] text-white/75">Donnez-le au livreur seulement quand vous avez le colis en main.{t.toCollect > 0 ? ` Somme à régler au livreur : ${formatXof(t.toCollect)}.` : " Rien à payer au livreur."}</p>
          </div>
        )}

        <ol className="mt-10 grid gap-0" aria-label="Étapes">
          {TRACK_STEPS.map((s, i) => {
            const done = !offTrack && i <= reached;
            const ev = [...t.events].reverse().find((e) => e.status === s);
            return (
              <li key={s} className="grid grid-cols-[28px_1fr] gap-4">
                <span className="flex flex-col items-center">
                  <span className={`grid h-7 w-7 place-items-center rounded-full ring-2 ${done ? "bg-[var(--color-accent-primary)] ring-[var(--color-accent-primary)]" : "bg-[var(--color-surface)] ring-[var(--color-border)]"}`}>{done && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="3" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>}</span>
                  {i < TRACK_STEPS.length - 1 && <span className={`w-0 flex-1 border-l-[2.5px] border-dashed ${done && i < reached ? "border-[var(--color-primary)]" : "border-[var(--color-border)]"}`} style={{ minHeight: 34 }} />}
                </span>
                <span className="pb-6">
                  <span className={`block text-[16px] font-bold ${done ? "" : "text-[var(--color-text-muted)]"}`}>{STEP_LABEL[s]}{s === "assigned" && t.delivererFirstName && done ? ` · ${t.delivererFirstName}` : ""}</span>
                  {ev && <span className="yc-num text-[13.5px] text-[var(--color-text-muted)]">{dateTimeIn(ev.at, company.timezone)}</span>}
                </span>
              </li>
            );
          })}
        </ol>
        {offTrack && <p className="rounded-[var(--radius-md)] bg-[var(--color-surface-muted)] p-4 text-[15px]">{st.guest}</p>}

        <dl className="yc-num mt-6 grid gap-2 rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-5 text-[15px] ring-1 ring-[var(--color-border)]">
          <div className="flex justify-between gap-3"><dt className="text-[var(--color-text-muted)]">Colis</dt><dd className="text-right font-semibold">{t.packageDescription}</dd></div>
          {t.role === "sender" && <div className="flex justify-between gap-3"><dt className="text-[var(--color-text-muted)]">Destinataire</dt><dd className="text-right font-semibold">{t.recipientName}{t.dropoffCommune ? ` · ${t.dropoffCommune}` : ""}</dd></div>}
          <div className="flex justify-between gap-3"><dt className="text-[var(--color-text-muted)]">Tarif</dt><dd className="font-semibold">{formatXof(t.fee)} <span className="font-normal text-[var(--color-text-muted)]">({t.feePaidBy === "recipient" ? "payé par le destinataire" : "à la charge de l'expéditeur"})</span></dd></div>
          {t.codAmount > 0 && <div className="flex justify-between gap-3"><dt className="text-[var(--color-text-muted)]">Encaissé à la livraison</dt><dd className="font-semibold">{formatXof(t.codAmount)}</dd></div>}
          {t.deliveredAt && <div className="flex justify-between gap-3"><dt className="text-[var(--color-text-muted)]">Remis</dt><dd className="font-semibold">{dateTimeIn(t.deliveredAt, company.timezone)} · {t.proofType === "code" ? "code vérifié" : "remis en main propre"}</dd></div>}
        </dl>

        {recipientUrl && !["delivered", "returned", "canceled"].includes(t.status) && (
          <div className="mt-6 rounded-[var(--radius-lg)] bg-[var(--color-accent-primary)] p-5 text-[var(--color-primary)]">
            <p className="font-bold">Lien du destinataire</p>
            <p className="mt-1 text-[14px]">Il contient son code de remise. Transmettez-le au destinataire (les messages automatiques ne sont envoyés que si la messagerie de la société est branchée).</p>
            <CopyLink url={recipientUrl} />
          </div>
        )}

        {t.role === "sender" && t.events.some((e) => e.note) && (
          <details className="mt-6">
            <summary className="cursor-pointer text-[15px] font-semibold">Historique détaillé</summary>
            <ul className="yc-num mt-3 grid gap-1.5 text-[14px]">
              {t.events.map((e, i) => <li key={i} className="flex justify-between gap-3 border-b border-dashed border-[var(--color-border)] pb-1.5"><span>{JOB_LABELS[e.status]?.label ?? e.status}{e.note ? ` — ${e.note}` : ""}</span><span className="shrink-0 text-[var(--color-text-muted)]">{dateTimeIn(e.at, company.timezone)}</span></li>)}
            </ul>
          </details>
        )}
      </div>
    </CourierShell>
  );
}
