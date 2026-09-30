"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/yc/button";
import { PAYMENT_METHOD_LABELS, formatNumber } from "@/lib/education/labels";
import { Feedback, input, label, parseAmount, postEdu, section, useEduAction } from "./shared";

type ProgramOpt = { id: string; title: string; tuition: number | null; registrationFee: number; classes: { id: string; name: string; remaining: number }[] };
type GuardianOpt = { id: string; name: string; students: { id: string; name: string }[] };

/**
 * Inscription au bureau : formation, classe (places restantes), responsable existant ou
 * nouveau, élève, remise motivée. Le montant est calculé par le serveur à partir de la
 * fiche de la formation.
 */
export function NewEnrollment({ programs, guardians, initialProgram }: { programs: ProgramOpt[]; guardians: GuardianOpt[]; initialProgram: string | null }) {
  const router = useRouter();
  const [f, setF] = useState({ listingId: initialProgram ?? programs[0]?.id ?? "", classGroupId: "", guardianId: "", studentId: "", relation: "parent", gFirst: "", gLast: "", phone: "", email: "", sFirst: "", sLast: "", birthDate: "", discount: "", reason: "", note: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const p = programs.find((x) => x.id === f.listingId);
  const g = guardians.find((x) => x.id === f.guardianId);
  const discount = parseAmount(f.discount) ?? 0;
  const total = p?.tuition != null ? p.tuition + p.registrationFee - discount : null;
  const self = f.relation === "self";
  return (
    <section className={section} id="inscrire" aria-labelledby="inscrire-titre">
      <h2 id="inscrire-titre" className="text-[17px] font-bold">Inscrire un élève</h2>
      {programs.length === 0 ? <p className="mt-3 text-sm">Créez d&apos;abord une formation.</p> : (
        <form className="mt-4 grid gap-3" onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          setError(null);
          try {
            const data = await postEdu<{ id: string }>({
              action: "enroll",
              enrollment: {
                listingId: f.listingId,
                classGroupId: f.classGroupId || null,
                guardianId: f.guardianId || null,
                guardian: f.guardianId ? null : { firstName: f.gFirst, lastName: f.gLast || null, phone: f.phone, email: f.email || null },
                studentId: f.studentId || null,
                student: f.studentId ? null : { firstName: self && !f.guardianId ? f.gFirst : f.sFirst, lastName: self && !f.guardianId ? f.gLast : f.sLast, birthDate: f.birthDate || null },
                relation: f.relation,
                discountAmount: discount,
                discountReason: f.reason || null,
                note: f.note || null,
              },
            });
            router.push(`/dashboard/inscriptions/${data.id}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Inscription impossible.");
            setPending(false);
          }
        }}>
          <label className={label}>Formation<select value={f.listingId} onChange={(e) => setF({ ...f, listingId: e.target.value, classGroupId: "" })} className={input}>{programs.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select></label>
          <label className={label}>Classe<select value={f.classGroupId} onChange={(e) => setF({ ...f, classGroupId: e.target.value })} className={input}><option value="">À affecter plus tard (demande à confirmer)</option>{p?.classes.map((c) => <option key={c.id} value={c.id} disabled={!c.remaining}>{c.name} — {c.remaining ? `${c.remaining} place${c.remaining > 1 ? "s" : ""}` : "complète"}</option>)}</select></label>
          <label className={label}>Responsable<select value={f.guardianId} onChange={(e) => setF({ ...f, guardianId: e.target.value, studentId: "" })} className={input}><option value="">Nouveau responsable</option>{guardians.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          {!f.guardianId && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={label}>Lien avec l&apos;élève<select value={f.relation} onChange={(e) => setF({ ...f, relation: e.target.value })} className={input}><option value="parent">Parent</option><option value="guardian">Tuteur</option><option value="self">L&apos;élève lui-même (majeur)</option></select></label>
              <label className={label}>Téléphone<input required type="tel" maxLength={30} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={input} /></label>
              <label className={label}>Prénom{self ? "" : " du responsable"}<input required maxLength={80} value={f.gFirst} onChange={(e) => setF({ ...f, gFirst: e.target.value })} className={input} /></label>
              <label className={label}>Nom{self ? "" : " du responsable"}<input required={self} maxLength={80} value={f.gLast} onChange={(e) => setF({ ...f, gLast: e.target.value })} className={input} /></label>
              <label className={`${label} sm:col-span-2`}>E-mail <span className="font-normal text-yc-ink-soft">(facultatif)</span><input type="email" maxLength={160} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={input} /></label>
            </div>
          )}
          {g && g.students.length > 0 && (
            <label className={label}>Élève<select value={f.studentId} onChange={(e) => setF({ ...f, studentId: e.target.value })} className={input}><option value="">Nouvel élève</option>{g.students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          )}
          {!f.studentId && !(self && !f.guardianId) && (
            <div className="grid gap-3 sm:grid-cols-3">
              <label className={label}>Prénom de l&apos;élève<input required maxLength={80} value={f.sFirst} onChange={(e) => setF({ ...f, sFirst: e.target.value })} className={input} /></label>
              <label className={label}>Nom de l&apos;élève<input required maxLength={80} value={f.sLast} onChange={(e) => setF({ ...f, sLast: e.target.value })} className={input} /></label>
              <label className={label}>Naissance<input type="date" value={f.birthDate} onChange={(e) => setF({ ...f, birthDate: e.target.value })} className={input} /></label>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>Remise (FCFA)<input inputMode="numeric" value={f.discount} onChange={(e) => setF({ ...f, discount: e.target.value.replace(/[^\d\s]/g, "") })} placeholder="0" className={input} /></label>
            {discount > 0 && <label className={label}>Motif de la remise<input required maxLength={200} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="Bourse, fratrie, accord…" className={input} /></label>}
          </div>
          {total != null ? (
            <p className="rounded-lg bg-yc-ivory-50 px-3 py-2 text-sm ring-1 ring-yc-ink/[0.06]">Montant dû : <strong className="yc-num">{formatNumber(total)} FCFA</strong> <span className="text-yc-ink-soft">(inscription {formatNumber(p!.registrationFee)} + scolarité {formatNumber(p!.tuition!)}{discount ? ` − remise ${formatNumber(discount)}` : ""})</span></p>
          ) : <p className="text-sm text-yc-danger">Scolarité sur devis : fixez d&apos;abord le tarif de la formation.</p>}
          <div><Button type="submit" variant="royal" loading={pending} disabled={total == null}>Inscrire</Button>{error && <p role="alert" className="mt-3 text-sm font-medium text-yc-danger">{error}</p>}</div>
        </form>
      )}
    </section>
  );
}

/** Affecter / changer de classe (confirme une demande en ligne). */
export function AssignClass({ reservationId, classes, current, pending: requested }: { reservationId: string; classes: { id: string; name: string; remaining: number }[]; current: string | null; pending: boolean }) {
  const a = useEduAction();
  const [c, setC] = useState(current ?? classes.find((x) => x.remaining > 0)?.id ?? "");
  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        <label className={`${label} min-w-[200px] flex-1`}>Classe<select value={c} onChange={(e) => setC(e.target.value)} className={input}>{classes.map((x) => <option key={x.id} value={x.id} disabled={!x.remaining && x.id !== current}>{x.name} — {x.id === current ? (requested ? "demandée" : "actuelle") : x.remaining ? `${x.remaining} place${x.remaining > 1 ? "s" : ""}` : "complète"}</option>)}</select></label>
        <Button type="button" variant="royal" disabled={!c || (!requested && c === current)} loading={a.pending} onClick={() => a.run({ action: "assign_class", reservationId, classGroupId: c }, requested ? "Inscription confirmée dans la classe." : "Classe changée.")}>{requested ? "Confirmer dans cette classe" : "Changer de classe"}</Button>
      </div>
      <Feedback error={a.error} notice={a.notice} />
    </div>
  );
}

type Installment = { label: string; dueDate: string; amount: number };

/** Remise motivée et échéancier : les échéances totalisent toujours le montant dû. */
export function PlanEditor({ reservationId, gross, discount, reason, installments, paid }: { reservationId: string; gross: number; discount: number; reason: string | null; installments: Installment[]; paid: number }) {
  const a = useEduAction();
  const [d, setD] = useState({ amount: discount ? String(discount) : "", reason: reason ?? "" });
  const [rows, setRows] = useState(installments.map((i) => ({ ...i, amount: String(i.amount) })));
  const [custom, setCustom] = useState(false);
  const newDiscount = parseAmount(d.amount) ?? 0;
  const total = gross - newDiscount;
  const sum = rows.reduce((s, r) => s + (parseAmount(r.amount) ?? 0), 0);
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>Remise (FCFA)<input inputMode="numeric" value={d.amount} onChange={(e) => setD({ ...d, amount: e.target.value.replace(/[^\d\s]/g, "") })} placeholder="0" className={input} /></label>
        <label className={label}>Motif<input maxLength={200} value={d.reason} onChange={(e) => setD({ ...d, reason: e.target.value })} placeholder="Bourse, fratrie…" className={input} /></label>
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={custom} onChange={(e) => setCustom(e.target.checked)} className="h-4 w-4" /> Échéancier personnalisé (sinon, plan par défaut de la formation)</label>
      {custom && (
        <div className="grid gap-2">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1.3fr_1fr_1fr_auto] items-end gap-2">
              <input aria-label="Libellé" maxLength={60} value={r.label} onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} className={input} />
              <input aria-label="Date" type="date" value={r.dueDate} onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, dueDate: e.target.value } : x)))} className={input} />
              <input aria-label="Montant" inputMode="numeric" value={r.amount} onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, amount: e.target.value.replace(/[^\d\s]/g, "") } : x)))} className={input} />
              <button type="button" aria-label="Retirer" onClick={() => setRows(rows.filter((_, k) => k !== i))} className="h-11 px-2 font-bold text-yc-danger">×</button>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="secondary" onClick={() => setRows([...rows, { label: `Échéance ${rows.length + 1}`, dueDate: rows.at(-1)?.dueDate ?? new Date().toISOString().slice(0, 10), amount: String(Math.max(0, total - sum)) }])}>Ajouter une échéance</Button>
            <p className={`yc-num text-sm font-semibold ${sum === total ? "text-[rgb(4_120_87)]" : "text-yc-danger"}`}>{formatNumber(sum)} / {formatNumber(total)} FCFA</p>
          </div>
        </div>
      )}
      {total < paid && <p className="text-sm text-yc-danger">Déjà encaissé : {formatNumber(paid)} FCFA — le total ne peut pas descendre en dessous.</p>}
      <div><Button type="button" variant="royal" loading={a.pending} onClick={() => a.run({ action: "plan", reservationId, plan: { discountAmount: newDiscount, discountReason: d.reason || null, installments: custom ? rows.map((r) => ({ label: r.label, dueDate: r.dueDate, amount: parseAmount(r.amount) ?? 0 })) : null } }, "Échéancier mis à jour.")}>Enregistrer</Button></div>
      <Feedback error={a.error} notice={a.notice} />
    </div>
  );
}

/** Encaissement de scolarité : reçu numéroté, jamais plus que le reste à payer. */
export function EnrollmentPayment({ reservationId, remaining, nextDue }: { reservationId: string; remaining: number; nextDue: number | null }) {
  const a = useEduAction();
  const [f, setF] = useState({ amount: "", method: "wave", reference: "" });
  return (
    <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); a.run({ action: "payment", payment: { reservationId, amount: parseAmount(f.amount) ?? 0, method: f.method, reference: f.reference || null } }, "Encaissement enregistré.", () => setF({ ...f, amount: "", reference: "" })); }}>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={label}>Montant reçu (FCFA)<input required inputMode="numeric" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d\s]/g, "") })} placeholder={formatNumber(nextDue ?? remaining)} className={input} /></label>
        <label className={label}>Moyen<select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} className={input}>{Object.entries(PAYMENT_METHOD_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className={label}>Référence <span className="font-normal text-yc-ink-soft">(facultatif)</span><input maxLength={80} value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} className={input} /></label>
      </div>
      <p className="text-xs text-yc-ink-soft">Enregistrez uniquement un paiement réellement reçu et vérifié. Il est affecté automatiquement aux échéances, dans l&apos;ordre.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="royal" loading={a.pending}>Enregistrer l&apos;encaissement</Button>
        {nextDue != null && nextDue < remaining && <Button type="button" variant="secondary" onClick={() => setF({ ...f, amount: formatNumber(nextDue) })}>Prochaine échéance</Button>}
        <Button type="button" variant="secondary" onClick={() => setF({ ...f, amount: formatNumber(remaining) })}>Solde complet</Button>
      </div>
      <Feedback error={a.error} notice={a.notice} />
    </form>
  );
}

export function VoidPayment({ paymentId }: { paymentId: string }) {
  const a = useEduAction();
  return (
    <span>
      <button type="button" disabled={a.pending} onClick={() => { const r = window.prompt("Motif de l'annulation de cet encaissement (remboursement, erreur de saisie…) :"); if (r?.trim()) a.run({ action: "void_payment", paymentId, reason: r }, "Encaissement annulé."); }} className="text-xs font-semibold text-yc-danger hover:underline">Annuler</button>
      {a.error && <span role="alert" className="block text-xs text-yc-danger">{a.error}</span>}
    </span>
  );
}

export function EnrollmentClose({ reservationId, status, canCancel }: { reservationId: string; status: string; canCancel: boolean }) {
  const a = useEduAction();
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {status === "confirmed" && <Button type="button" variant="secondary" loading={a.pending} onClick={() => window.confirm("Clôturer cette inscription (formation terminée) ?") && a.run({ action: "complete", reservationId }, "Inscription clôturée.")}>Formation terminée</Button>}
        {canCancel && <Button type="button" variant="danger" disabled={a.pending} onClick={() => { const r = window.prompt("Motif de la désinscription (abandon, déménagement…) :"); if (r?.trim()) a.run({ action: "withdraw", reservationId, reason: r }, "Inscription annulée : la place est libérée."); }}>Désinscrire</Button>}
      </div>
      <p className="mt-2 text-xs text-yc-ink-soft">Les encaissements déjà reçus restent au journal ; un remboursement s&apos;enregistre en annulant l&apos;encaissement, avec son motif.</p>
      <Feedback error={a.error} notice={a.notice} />
    </div>
  );
}

/** Liens personnels (famille, élève) : à copier ou renouveler si partagés par erreur. */
export function PersonalLinks({ origin, familyToken, customerId, studentToken, studentId }: { origin: string; familyToken: string | null; customerId: string; studentToken: string; studentId: string }) {
  const a = useEduAction();
  const [copied, setCopied] = useState<string | null>(null);
  const links = [
    ...(familyToken ? [{ k: "famille", label: "Espace famille", url: `${origin}/famille/${familyToken}`, renew: { action: "renew_family_link", customerId } }] : []),
    { k: "eleve", label: "Espace élève", url: `${origin}/eleve/${studentToken}`, renew: { action: "renew_student_link", studentId } },
  ];
  return (
    <div className="grid gap-3">
      {links.map((l) => (
        <div key={l.k} className="min-w-0">
          <p className="text-[13px] font-semibold">{l.label}</p>
          <p className="mt-1 truncate rounded-lg bg-yc-ivory-50 px-3 py-2 font-mono text-xs ring-1 ring-yc-ink/[0.06]">{l.url}</p>
          <div className="mt-1.5 flex gap-3 text-xs font-semibold">
            <button type="button" onClick={() => navigator.clipboard?.writeText(l.url).then(() => setCopied(l.k))} className="text-yc-electric hover:underline">{copied === l.k ? "Copié" : "Copier"}</button>
            <button type="button" disabled={a.pending} onClick={() => window.confirm("Renouveler ce lien ? L'ancien cessera immédiatement de fonctionner.") && a.run(l.renew, "Lien renouvelé.")} className="text-yc-danger hover:underline">Renouveler</button>
          </div>
        </div>
      ))}
      <Feedback error={a.error} notice={a.notice} />
    </div>
  );
}

/** Réglages de l'établissement : année scolaire, barème, seuil d'absences, inscriptions en ligne. */
export function SchoolSettings({ initial }: { initial: { academicYear: string; gradeScale: number; absenceAlert: number; onlineEnrollment: boolean } }) {
  const a = useEduAction();
  const [f, setF] = useState(initial);
  return (
    <form className={`${section} grid gap-4`} onSubmit={(e) => { e.preventDefault(); a.run({ action: "settings", settings: f }, "Réglages enregistrés."); }}>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={label}>Année scolaire<input maxLength={20} value={f.academicYear} onChange={(e) => setF({ ...f, academicYear: e.target.value })} placeholder="2026-2027" className={input} /></label>
        <label className={label}>Barème des notes<select value={f.gradeScale} onChange={(e) => setF({ ...f, gradeScale: Number(e.target.value) })} className={input}><option value={10}>Sur 10</option><option value={20}>Sur 20</option><option value={100}>Sur 100</option></select></label>
        <label className={label}>Alerte après … absences<input type="number" min={1} max={100} value={f.absenceAlert} onChange={(e) => setF({ ...f, absenceAlert: Number(e.target.value) })} className={input} /></label>
      </div>
      <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={f.onlineEnrollment} onChange={(e) => setF({ ...f, onlineEnrollment: e.target.checked })} className="h-4 w-4" /> Demandes d&apos;inscription en ligne ouvertes</label>
      <div><Button type="submit" variant="royal" loading={a.pending}>Enregistrer</Button></div>
      <Feedback error={a.error} notice={a.notice} />
    </form>
  );
}
