"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/yc/button";
import { FAILURE_REASONS, SIZE_LABELS, formatNumber } from "@/lib/courier/labels";
import { Feedback, input, label, parseAmount, postCourier, section, useCourierAction } from "./shared";

type Zone = { id: string; label: string; fee: number };
type Courier = { id: string; name: string };
type Sender = { id: string; name: string; phone: string | null };

/** Course saisie au bureau (appel, WhatsApp) : même tarif serveur que le site. */
export function NewJob({ zones, couriers, senders, surcharges }: { zones: Zone[]; couriers: Courier[]; senders: Sender[]; surcharges: { medium: number; large: number } }) {
  const router = useRouter();
  const [f, setF] = useState({ senderId: "", senderName: "", senderPhone: "", pickupName: "", pickupPhone: "", pickupAddress: "", recipientName: "", recipientPhone: "", dropoffAddress: "", zoneId: zones[0]?.id ?? "", packageDescription: "", size: "small", feePaidBy: "sender", cod: "", instructions: "", channel: "phone", delivererId: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const zone = zones.find((z) => z.id === f.zoneId);
  const fee = zone ? zone.fee + (f.size === "large" ? surcharges.large : f.size === "medium" ? surcharges.medium : 0) : 0;
  const sender = senders.find((s) => s.id === f.senderId);
  return (
    <section className={section} id="nouvelle" aria-labelledby="nouvelle-titre">
      <h2 id="nouvelle-titre" className="text-[17px] font-bold">Nouvelle course</h2>
      {zones.length === 0 ? <p className="mt-3 text-sm">Créez d&apos;abord vos zones et tarifs.</p> : (
        <form className="mt-4 grid gap-3" onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          setError(null);
          try {
            const data = await postCourier<{ id: string }>({
              action: "new_job",
              job: {
                senderId: f.senderId || null,
                sender: f.senderId ? null : { firstName: f.senderName, phone: f.senderPhone },
                pickupName: f.pickupName || sender?.name || f.senderName,
                pickupPhone: f.pickupPhone || sender?.phone || f.senderPhone,
                pickupAddress: f.pickupAddress,
                recipientName: f.recipientName,
                recipientPhone: f.recipientPhone,
                dropoffAddress: f.dropoffAddress,
                zoneId: f.zoneId,
                packageDescription: f.packageDescription,
                size: f.size,
                feePaidBy: f.feePaidBy,
                codAmount: parseAmount(f.cod) ?? 0,
                instructions: f.instructions || null,
                channel: f.channel,
                delivererId: f.delivererId || null,
              },
            });
            router.push(`/dashboard/courses/${data.id}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Création impossible.");
            setPending(false);
          }
        }}>
          <label className={label}>Expéditeur<select value={f.senderId} onChange={set("senderId")} className={input}><option value="">Nouveau client</option>{senders.map((s) => <option key={s.id} value={s.id}>{s.name}{s.phone ? ` · ${s.phone}` : ""}</option>)}</select></label>
          {!f.senderId && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={label}>Nom / boutique<input required maxLength={80} value={f.senderName} onChange={set("senderName")} className={input} /></label>
              <label className={label}>Téléphone<input required type="tel" maxLength={30} value={f.senderPhone} onChange={set("senderPhone")} className={input} /></label>
            </div>
          )}
          <label className={label}>Adresse de retrait<input required maxLength={200} value={f.pickupAddress} onChange={set("pickupAddress")} className={input} /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>Destinataire<input required maxLength={80} value={f.recipientName} onChange={set("recipientName")} className={input} /></label>
            <label className={label}>Téléphone du destinataire<input required type="tel" maxLength={30} value={f.recipientPhone} onChange={set("recipientPhone")} className={input} /></label>
          </div>
          <label className={label}>Adresse de livraison<input required maxLength={200} value={f.dropoffAddress} onChange={set("dropoffAddress")} className={input} /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>Zone<select value={f.zoneId} onChange={set("zoneId")} className={input}>{zones.map((z) => <option key={z.id} value={z.id}>{z.label} — {formatNumber(z.fee)} F</option>)}</select></label>
            <label className={label}>Format<select value={f.size} onChange={set("size")} className={input}>{Object.entries(SIZE_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
            <label className={label}>Contenu<input required maxLength={160} value={f.packageDescription} onChange={set("packageDescription")} className={input} /></label>
            <label className={label}>À encaisser (FCFA)<input inputMode="numeric" value={f.cod} onChange={(e) => setF({ ...f, cod: e.target.value.replace(/[^\d\s]/g, "") })} placeholder="0" className={input} /></label>
            <label className={label}>Tarif payé par<select value={f.feePaidBy} onChange={set("feePaidBy")} className={input}><option value="sender">L&apos;expéditeur</option><option value="recipient">Le destinataire</option></select></label>
            <label className={label}>Reçue par<select value={f.channel} onChange={set("channel")} className={input}><option value="phone">Téléphone</option><option value="whatsapp">WhatsApp</option><option value="dashboard">Au bureau</option></select></label>
          </div>
          <label className={label}>Consignes <span className="font-normal text-yc-ink-soft">(facultatif)</span><input maxLength={300} value={f.instructions} onChange={set("instructions")} className={input} /></label>
          <label className={label}>Affecter tout de suite<select value={f.delivererId} onChange={set("delivererId")} className={input}><option value="">Plus tard</option>{couriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <p className="rounded-lg bg-yc-ivory-50 px-3 py-2 text-sm ring-1 ring-yc-ink/[0.06]">Tarif : <strong className="yc-num">{formatNumber(fee)} FCFA</strong> · le livreur encaissera <strong className="yc-num">{formatNumber((parseAmount(f.cod) ?? 0) + (f.feePaidBy === "recipient" ? fee : 0))} FCFA</strong> <span className="text-yc-ink-soft">(recalculé par le serveur)</span></p>
          <div><Button type="submit" variant="royal" loading={pending}>Créer la course</Button>{error && <p role="alert" className="mt-3 text-sm font-medium text-yc-danger">{error}</p>}</div>
        </form>
      )}
    </section>
  );
}

/** Actions du bureau sur une course, selon son statut. */
export function JobActions({ jobId, status, toCollect, couriers, currentCourier, canAssign, canUpdate }: { jobId: string; status: string; toCollect: number; couriers: Courier[]; currentCourier: string | null; canAssign: boolean; canUpdate: boolean }) {
  const a = useCourierAction();
  const [courier, setCourier] = useState(currentCourier ?? couriers[0]?.id ?? "");
  const [deliver, setDeliver] = useState(false);
  const [proof, setProof] = useState({ byName: false, code: "", name: "", cash: String(toCollect) });
  const [reason, setReason] = useState(FAILURE_REASONS[0]!);
  const going = status === "picked_up" || status === "in_transit";
  return (
    <div className="grid gap-4">
      {canAssign && ["pending", "assigned", "failed"].includes(status) && (
        <div className="flex flex-wrap items-end gap-2">
          <label className={`${label} min-w-[200px] flex-1`}>{status === "failed" ? "Nouvelle tentative avec" : "Livreur"}<select value={courier} onChange={(e) => setCourier(e.target.value)} className={input}>{couriers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <Button type="button" variant="royal" disabled={!courier || (status === "assigned" && courier === currentCourier)} loading={a.pending} onClick={() => a.run({ action: "assign", jobId, delivererId: courier }, "Livreur affecté.")}>{status === "assigned" ? "Réaffecter" : "Affecter"}</Button>
          {status === "failed" && <Button type="button" variant="secondary" disabled={a.pending} onClick={() => a.run({ action: "start_return", jobId, delivererId: courier || null }, "Retour à l'expéditeur lancé.")}>Retourner à l&apos;expéditeur</Button>}
        </div>
      )}
      {canUpdate && status === "assigned" && <Button type="button" variant="secondary" disabled={a.pending} onClick={() => a.run({ action: "progress", jobId, to: "picked_up" }, "Colis pris en charge.")}>Colis pris en charge</Button>}
      {canUpdate && status === "picked_up" && <Button type="button" variant="secondary" disabled={a.pending} onClick={() => a.run({ action: "progress", jobId, to: "in_transit" }, "En route.")}>En route</Button>}
      {canUpdate && status === "returning" && <Button type="button" variant="secondary" disabled={a.pending} onClick={() => a.run({ action: "progress", jobId, to: "returned" }, "Colis rendu à l'expéditeur.")}>Colis rendu à l&apos;expéditeur</Button>}
      {canUpdate && going && !deliver && (
        <div className="flex flex-wrap items-end gap-2">
          <Button type="button" variant="royal" onClick={() => setDeliver(true)}>Saisir la remise</Button>
          <label className={`${label} min-w-[200px] flex-1`}>Échec<select value={reason} onChange={(e) => setReason(e.target.value)} className={input}>{FAILURE_REASONS.map((r) => <option key={r}>{r}</option>)}</select></label>
          <Button type="button" variant="danger" disabled={a.pending} onClick={() => a.run({ action: "fail", jobId, reason }, "Échec enregistré.")}>Déclarer l&apos;échec</Button>
        </div>
      )}
      {canUpdate && going && deliver && (
        <form className="grid gap-3 rounded-lg bg-yc-ivory-50 p-4 ring-1 ring-yc-ink/[0.06]" onSubmit={(e) => { e.preventDefault(); a.run({ action: "deliver", jobId, delivery: { proof: proof.byName ? { type: "name", name: proof.name } : { type: "code", code: proof.code }, collectedAmount: parseAmount(proof.cash) ?? -1 } }, "Livraison enregistrée."); }}>
          {proof.byName ? <label className={label}>Nom de la personne qui a reçu<input required maxLength={80} value={proof.name} onChange={(e) => setProof({ ...proof, name: e.target.value })} className={input} /></label> : <label className={label}>Code du destinataire<input required inputMode="numeric" maxLength={4} value={proof.code} onChange={(e) => setProof({ ...proof, code: e.target.value.replace(/\D/g, "") })} className={`${input} yc-num tracking-[0.3em]`} /></label>}
          <button type="button" onClick={() => setProof({ ...proof, byName: !proof.byName })} className="justify-self-start text-xs font-semibold text-yc-electric hover:underline">{proof.byName ? "Utiliser le code" : "Pas de code : saisir le nom"}</button>
          <label className={label}>Espèces encaissées (FCFA)<input required inputMode="numeric" value={proof.cash} onChange={(e) => setProof({ ...proof, cash: e.target.value.replace(/[^\d\s]/g, "") })} className={input} /><span className="mt-1 text-xs font-normal text-yc-ink-soft">Attendu : {formatNumber(toCollect)} FCFA exactement.</span></label>
          <div className="flex gap-2"><Button type="submit" variant="royal" loading={a.pending}>Confirmer la remise</Button><Button type="button" variant="secondary" onClick={() => setDeliver(false)}>Annuler</Button></div>
        </form>
      )}
      {canAssign && (status === "pending" || status === "assigned") && (
        <button type="button" disabled={a.pending} onClick={() => { const r = window.prompt("Motif de l'annulation :"); if (r?.trim()) a.run({ action: "cancel", jobId, reason: r }, "Course annulée."); }} className="justify-self-start text-sm font-semibold text-yc-danger hover:underline">Annuler la course</button>
      )}
      <Feedback error={a.error} notice={a.notice} />
    </div>
  );
}
