"use client";

import { useState } from "react";
import { Button } from "@/components/yc/button";
import { IMPORT_LABELS, IMPORT_STAGES } from "@/lib/auto/labels";
import { Feedback, input, label, section, useAutoAction } from "./shared";

/** Étape suivante d'une importation (date d'arrivée révisable) ou annulation motivée. */
export function ImportAdvance({ importId, stage, eta }: { importId: string; stage: string; eta: string | null }) {
  const a = useAutoAction();
  const [newEta, setEta] = useState(eta ?? "");
  const [note, setNote] = useState("");
  const next = IMPORT_STAGES[IMPORT_STAGES.indexOf(stage as (typeof IMPORT_STAGES)[number]) + 1];
  if (!next) return null;
  return (
    <form className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); a.run({ action: "import_stage", importId, to: next, eta: newEta || null, note: note || undefined }, `Étape « ${IMPORT_LABELS[next]!.label} » enregistrée.`, () => setNote("")); }}>
      <label className={label}>Arrivée estimée<input type="date" value={newEta} onChange={(e) => setEta(e.target.value)} className={input} /></label>
      <label className={label}>Note <span className="font-normal text-yc-ink-soft">(facultatif)</span><input maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} className={input} placeholder="N° de déclaration, quai…" /></label>
      <div className="flex gap-2">
        <Button type="submit" variant="royal" loading={a.pending}>{IMPORT_LABELS[next]!.label} →</Button>
        <Button type="button" variant="ghost" disabled={a.pending} onClick={() => { const r = window.prompt("Motif de l'annulation de l'importation :"); if (r?.trim()) a.run({ action: "import_stage", importId, to: "canceled", note: r }, "Importation annulée."); }}>Annuler</Button>
      </div>
      <div className="sm:col-span-3"><Feedback error={a.error} notice={a.notice} /></div>
    </form>
  );
}

export function CopyLink({ url }: { url: string }) {
  const [done, setDone] = useState(false);
  return <button type="button" onClick={async () => { await navigator.clipboard.writeText(url).catch(() => {}); setDone(true); setTimeout(() => setDone(false), 2000); }} className="text-sm font-semibold text-yc-electric hover:underline">{done ? "Lien copié" : "Copier le lien de suivi client"}</button>;
}

/** Suivre l'importation d'un véhicule du stock (il passe « en arrivage » jusqu'à « prêt »). */
export function NewImport({ vehicles, initialVehicle }: { vehicles: { id: string; title: string }[]; initialVehicle: string | null }) {
  const a = useAutoAction();
  const empty = { listingId: initialVehicle ?? vehicles[0]?.id ?? "", origin: "", eta: "", vessel: "", containerRef: "", firstName: "", phone: "", note: "" };
  const [f, setF] = useState(empty);
  return (
    <section className={section} id="nouvelle" aria-labelledby="nouvelle-titre">
      <h2 id="nouvelle-titre" className="text-[17px] font-bold">Suivre une importation</h2>
      <p className="mt-1 text-sm text-yc-ink-soft">Créez d&apos;abord le véhicule dans le stock. Si un client l&apos;attend, il reçoit un lien de suivi personnel.</p>
      {vehicles.length === 0 ? <p className="mt-3 text-sm">Aucun véhicule sans importation en cours.</p> : (
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); a.run({ action: "new_import", import: { listingId: f.listingId, origin: f.origin, eta: f.eta || null, vessel: f.vessel || null, containerRef: f.containerRef || null, customer: f.firstName && f.phone ? { firstName: f.firstName, phone: f.phone } : null, note: f.note || null } }, "Importation suivie : le véhicule est « en arrivage ».", () => setF({ ...empty, listingId: "" })); }}>
          <label className={`${label} sm:col-span-2`}>Véhicule<select value={f.listingId} onChange={(e) => setF({ ...f, listingId: e.target.value })} className={input}>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}</select></label>
          <label className={label}>Provenance<input required maxLength={60} value={f.origin} onChange={(e) => setF({ ...f, origin: e.target.value })} className={input} placeholder="Belgique (Anvers)" /></label>
          <label className={label}>Arrivée estimée<input type="date" value={f.eta} onChange={(e) => setF({ ...f, eta: e.target.value })} className={input} /></label>
          <label className={label}>Navire<input maxLength={60} value={f.vessel} onChange={(e) => setF({ ...f, vessel: e.target.value })} className={input} /></label>
          <label className={label}>Conteneur<input maxLength={40} value={f.containerRef} onChange={(e) => setF({ ...f, containerRef: e.target.value })} className={input} /></label>
          <label className={label}>Client qui l&apos;attend <span className="font-normal text-yc-ink-soft">(prénom)</span><input maxLength={80} value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} className={input} /></label>
          <label className={label}>Téléphone du client<input type="tel" maxLength={30} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={input} /></label>
          <div className="sm:col-span-2"><Button type="submit" variant="royal" loading={a.pending}>Démarrer le suivi</Button><Feedback error={a.error} notice={a.notice} /></div>
        </form>
      )}
    </section>
  );
}
