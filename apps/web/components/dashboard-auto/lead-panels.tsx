"use client";

import { useState } from "react";
import { Button } from "@/components/yc/button";
import { INTEREST_LABELS, LEAD_FLOW, LEAD_LABELS, SOURCE_LABELS } from "@/lib/auto/labels";
import { Feedback, input, label, parseAmount, section, useAutoAction } from "./shared";

/** Faire avancer un prospect, le déclarer perdu (motif obligatoire) ou noter un échange. */
export function LeadActions({ leadId, status }: { leadId: string; status: string }) {
  const move = useAutoAction();
  const note = useAutoAction();
  const [body, setBody] = useState("");
  const [next, setNext] = useState("");
  const closed = status === "won" || status === "lost";
  return (
    <div className="grid gap-4">
      {!closed && (
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-yc-ink-soft">Étape</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {LEAD_FLOW.map((s) => (
              <button key={s} type="button" disabled={move.pending || s === status} aria-pressed={s === status} onClick={() => move.run({ action: "lead_status", leadId, to: s }, `Prospect passé à « ${LEAD_LABELS[s]!.label} ».`)} className="rounded-full px-3 py-1.5 text-[13px] font-semibold ring-1 ring-inset ring-yc-ink/12 aria-pressed:bg-yc-night-900 aria-pressed:text-white disabled:cursor-default">
                {LEAD_LABELS[s]!.label}
              </button>
            ))}
            <button type="button" disabled={move.pending} onClick={() => {
              const why = window.prompt("Pourquoi ce prospect est-il perdu ?");
              if (why?.trim()) move.run({ action: "lead_status", leadId, to: "lost", note: why }, "Prospect classé perdu.");
            }} className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-yc-danger ring-1 ring-inset ring-yc-danger/30">Perdu…</button>
          </div>
          <p className="mt-2 text-xs text-yc-ink-soft">« Vendu » se pose tout seul à la remise des clés d&apos;un dossier de vente.</p>
          <Feedback error={move.error} notice={move.notice} />
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); note.run({ action: "lead_note", leadId, body, nextActionAt: next || undefined }, "Note ajoutée.", () => { setBody(""); setNext(""); }); }} className="grid gap-2">
        <label className={label}>Noter un échange<textarea required rows={2} maxLength={800} value={body} onChange={(e) => setBody(e.target.value)} className={`${input} h-auto py-2`} placeholder="Appelé : passe samedi avec son épouse." /></label>
        {!closed && <label className={label}>Relancer le <span className="font-normal text-yc-ink-soft">(facultatif)</span><input type="date" value={next} onChange={(e) => setNext(e.target.value)} className={input} /></label>}
        <div><Button type="submit" variant="secondary" loading={note.pending}>Ajouter la note</Button><Feedback error={note.error} notice={note.notice} /></div>
      </form>
    </div>
  );
}

/** Prospect saisi par l'équipe (appel, WhatsApp, passage au showroom). */
export function DeskLead({ vehicles }: { vehicles: { id: string; title: string }[] }) {
  const a = useAutoAction();
  const empty = { listingId: "", interest: "purchase", source: "phone", firstName: "", lastName: "", phone: "", budget: "", tradeIn: "", message: "" };
  const [f, setF] = useState(empty);
  return (
    <section className={section} aria-labelledby="nouveau-prospect">
      <h2 id="nouveau-prospect" className="text-[17px] font-bold">Nouveau prospect</h2>
      <form className="mt-4 grid gap-3" onSubmit={(e) => {
        e.preventDefault();
        a.run({ action: "desk_lead", lead: { listingId: f.listingId || null, interest: f.interest, source: f.source, customer: { firstName: f.firstName, lastName: f.lastName || null, phone: f.phone }, budget: parseAmount(f.budget), tradeIn: f.tradeIn || null, message: f.message || null } }, "Prospect enregistré (fusionné s'il était déjà suivi pour ce véhicule).", () => setF(empty));
      }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={label}>Prénom<input required maxLength={80} value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} className={input} /></label>
          <label className={label}>Téléphone<input required type="tel" maxLength={30} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={input} /></label>
          <label className={label}>Intérêt<select value={f.interest} onChange={(e) => setF({ ...f, interest: e.target.value })} className={input}>{Object.entries(INTEREST_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className={label}>Venu par<select value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} className={input}>{Object.entries(SOURCE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        </div>
        <label className={label}>Véhicule <span className="font-normal text-yc-ink-soft">(facultatif)</span><select value={f.listingId} onChange={(e) => setF({ ...f, listingId: e.target.value })} className={input}><option value="">Aucun en particulier</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}</select></label>
        {f.interest === "trade_in" && <label className={label}>Véhicule à reprendre<input maxLength={200} value={f.tradeIn} onChange={(e) => setF({ ...f, tradeIn: e.target.value })} className={input} /></label>}
        <label className={label}>Budget (FCFA) <span className="font-normal text-yc-ink-soft">(facultatif)</span><input inputMode="numeric" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value.replace(/[^\d\s]/g, "") })} className={input} /></label>
        <label className={label}>Message<input maxLength={800} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} className={input} /></label>
        <div><Button type="submit" variant="royal" loading={a.pending}>Enregistrer</Button><Feedback error={a.error} notice={a.notice} /></div>
      </form>
    </section>
  );
}
