"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FAILURE_REASONS, JOB_LABELS, SIZE_LABELS, formatXof } from "@/lib/courier/labels";

export interface DriverJob {
  id: string;
  reference: string;
  status: string;
  pickupName: string;
  pickupPhone: string;
  pickupAddress: string;
  pickupCommune: string | null;
  recipientName: string;
  recipientPhone: string;
  dropoffAddress: string;
  dropoffCommune: string | null;
  instructions: string | null;
  packageDescription: string;
  size: string;
  toCollect: number;
  collectedAmount: number | null;
  failureReason: string | null;
  attempts: number;
}

const tel = (p: string) => `tel:${p.replace(/\s/g, "")}`;

/**
 * Espace livreur : une carte par course, l'action suivante en grand. Remise : le code du
 * destinataire (ou son nom, à défaut) et la somme exacte à encaisser — vérifiés par le serveur.
 */
export function DriverBoard({ token, jobs }: { token: string; jobs: DriverJob[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<string | null>(null);
  const [mode, setMode] = useState<"deliver" | "fail" | null>(null);
  const [code, setCode] = useState("");
  const [byName, setByName] = useState(false);
  const [name, setName] = useState("");
  const [cash, setCash] = useState("");
  const [reason, setReason] = useState(FAILURE_REASONS[0]!);
  const [msg, setMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null);
  const act = (jobId: string, action: Record<string, unknown>, success: string) =>
    start(async () => {
      setMsg(null);
      const res = await fetch("/api/storefront/courier/driver", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, action: { ...action, jobId } }) });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) return setMsg({ id: jobId, ok: false, text: j.error ?? "Action impossible." });
      setMsg({ id: jobId, ok: true, text: success });
      setMode(null);
      setCode("");
      setName("");
      setCash("");
      router.refresh();
    });
  const active = jobs.filter((j) => ["assigned", "picked_up", "in_transit", "returning"].includes(j.status));
  const done = jobs.filter((j) => !active.includes(j));
  const big = "flex min-h-[56px] w-full items-center justify-center rounded-full text-[16px] font-bold disabled:opacity-60";
  return (
    <div className="grid gap-4">
      {active.length === 0 && <p className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-6 text-center text-[16px] ring-1 ring-[var(--color-border)]">Aucune course en cours. Le bureau vous en affectera.</p>}
      {active.map((j) => {
        const isOpen = open === j.id;
        const going = j.status === "picked_up" || j.status === "in_transit";
        return (
          <article key={j.id} className="overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-surface)] ring-1 ring-[var(--color-border)]">
            <button type="button" onClick={() => { setOpen(isOpen ? null : j.id); setMode(null); }} aria-expanded={isOpen} className="flex w-full items-start justify-between gap-3 p-4 text-left">
              <span className="min-w-0">
                <span className="yc-num block text-[12.5px] font-bold text-[var(--color-text-muted)]">{j.reference}{j.attempts ? ` · tentative ${j.attempts + 1}` : ""}</span>
                <span className="block truncate text-[18px] font-bold">{j.status === "assigned" ? j.pickupName : j.status === "returning" ? `Retour : ${j.pickupName}` : j.recipientName}</span>
                <span className="block truncate text-[14.5px] text-[var(--color-text-secondary)]">{j.status === "assigned" || j.status === "returning" ? j.pickupAddress : j.dropoffAddress}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block rounded-full bg-[var(--color-accent-primary)] px-2.5 py-0.5 text-[12px] font-bold text-[var(--color-primary)]">{JOB_LABELS[j.status]?.label}</span>
                {j.toCollect > 0 && j.status !== "returning" && <span className="yc-num mt-1 block text-[14px] font-bold">{formatXof(j.toCollect)}</span>}
              </span>
            </button>
            {isOpen && (
              <div className="grid gap-3 border-t border-dashed border-[var(--color-border)] p-4">
                <dl className="grid gap-1.5 text-[14.5px]">
                  <div><dt className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">Retrait</dt><dd>{j.pickupName} · {j.pickupAddress}{j.pickupCommune ? `, ${j.pickupCommune}` : ""} · <a href={tel(j.pickupPhone)} className="yc-num font-semibold underline">{j.pickupPhone}</a></dd></div>
                  <div><dt className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">Remise</dt><dd>{j.recipientName} · {j.dropoffAddress}{j.dropoffCommune ? `, ${j.dropoffCommune}` : ""} · <a href={tel(j.recipientPhone)} className="yc-num font-semibold underline">{j.recipientPhone}</a></dd></div>
                  <div><dt className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">Colis</dt><dd>{j.packageDescription} · {SIZE_LABELS[j.size]?.label}</dd></div>
                  {j.instructions && <div><dt className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">Consignes</dt><dd>{j.instructions}</dd></div>}
                  {j.failureReason && <div><dt className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">Dernier échec</dt><dd>{j.failureReason}</dd></div>}
                </dl>
                {j.status === "assigned" && <button type="button" disabled={pending} onClick={() => act(j.id, { action: "picked_up" }, "Colis pris en charge.")} className={`${big} bg-[var(--color-primary)] text-white`}>J&apos;ai pris le colis</button>}
                {j.status === "picked_up" && <button type="button" disabled={pending} onClick={() => act(j.id, { action: "in_transit" }, "En route : le destinataire est prévenu.")} className={`${big} bg-[var(--color-primary)] text-white`}>Je pars livrer</button>}
                {j.status === "returning" && <button type="button" disabled={pending} onClick={() => act(j.id, { action: "returned" }, "Colis rendu à l'expéditeur.")} className={`${big} bg-[var(--color-primary)] text-white`}>Colis rendu à l&apos;expéditeur</button>}
                {going && mode === null && (
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => { setMode("deliver"); setCash(j.toCollect ? String(j.toCollect) : "0"); }} className={`${big} bg-[var(--color-accent-primary)] text-[var(--color-primary)]`}>Livré</button>
                    <button type="button" onClick={() => setMode("fail")} className={`${big} bg-[var(--color-surface-muted)]`}>Échec</button>
                  </div>
                )}
                {going && mode === "deliver" && (
                  <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); act(j.id, { action: "delivered", proof: byName ? { type: "name", name } : { type: "code", code }, collectedAmount: Number(cash.replace(/\s/g, "")) }, "Livraison enregistrée."); }}>
                    {!byName ? (
                      <label className="block text-[14px] font-semibold">Code donné par le destinataire
                        <input required inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="yc-num mt-1.5 h-14 w-full rounded-[var(--radius-md)] bg-white text-center text-[28px] tracking-[0.4em] ring-1 ring-inset ring-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                      </label>
                    ) : (
                      <label className="block text-[14px] font-semibold">Nom de la personne qui reçoit
                        <input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 h-12 w-full rounded-[var(--radius-md)] bg-white px-3 text-[16px] ring-1 ring-inset ring-[var(--color-border)]" />
                      </label>
                    )}
                    <button type="button" onClick={() => setByName(!byName)} className="justify-self-start text-[13.5px] font-semibold underline">{byName ? "Utiliser le code" : "Le destinataire n'a pas de code"}</button>
                    <label className="block text-[14px] font-semibold">Espèces encaissées (FCFA)
                      <input required inputMode="numeric" value={cash} onChange={(e) => setCash(e.target.value.replace(/[^\d]/g, ""))} className="yc-num mt-1.5 h-12 w-full rounded-[var(--radius-md)] bg-white px-3 text-[18px] ring-1 ring-inset ring-[var(--color-border)]" />
                      <span className="mt-1 block text-[13px] font-normal text-[var(--color-text-muted)]">Attendu : {formatXof(j.toCollect)}. S&apos;il ne peut pas payer, déclarez un échec.</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setMode(null)} className={`${big} bg-[var(--color-surface-muted)]`}>Retour</button>
                      <button type="submit" disabled={pending} className={`${big} bg-[var(--color-accent-primary)] text-[var(--color-primary)]`}>Confirmer</button>
                    </div>
                  </form>
                )}
                {going && mode === "fail" && (
                  <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); act(j.id, { action: "failed", reason }, "Échec enregistré : le bureau décide de la suite."); }}>
                    <fieldset className="grid gap-2">
                      <legend className="text-[14px] font-semibold">Motif</legend>
                      {FAILURE_REASONS.map((r) => (
                        <label key={r} className={`flex min-h-[48px] items-center gap-3 rounded-[var(--radius-md)] px-3 ring-1 ring-inset ${reason === r ? "bg-white ring-2 ring-[var(--color-primary)]" : "ring-[var(--color-border)]"}`}>
                          <input type="radio" name={`motif-${j.id}`} checked={reason === r} onChange={() => setReason(r)} className="h-4 w-4" />{r}
                        </label>
                      ))}
                    </fieldset>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setMode(null)} className={`${big} bg-[var(--color-surface-muted)]`}>Retour</button>
                      <button type="submit" disabled={pending} className={`${big} bg-[var(--color-danger)] text-white`}>Déclarer l&apos;échec</button>
                    </div>
                  </form>
                )}
                {msg?.id === j.id && <p role={msg.ok ? "status" : "alert"} className={`text-[15px] font-semibold ${msg.ok ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>{msg.text}</p>}
              </div>
            )}
          </article>
        );
      })}
      {msg && !active.some((j) => j.id === msg.id) && <p role="status" className="text-center text-[15px] font-semibold text-[var(--color-success)]">{msg.text}</p>}
      {done.length > 0 && (
        <section aria-label="Terminées aujourd'hui" className="mt-2">
          <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">Terminées</h2>
          <ul className="mt-2 grid gap-1.5">
            {done.map((j) => (
              <li key={j.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] bg-[var(--color-surface)] px-4 py-3 text-[14.5px] ring-1 ring-[var(--color-border)]">
                <span className="min-w-0 truncate"><span className="yc-num font-semibold">{j.reference}</span> · {j.recipientName}</span>
                <span className="shrink-0 text-right"><span className="block font-semibold">{JOB_LABELS[j.status]?.label}</span>{j.collectedAmount ? <span className="yc-num text-[13px] text-[var(--color-text-muted)]">{formatXof(j.collectedAmount)}</span> : null}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
