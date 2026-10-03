"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/yc/button";
import { SETTLEMENT_METHOD_LABELS, formatNumber } from "@/lib/courier/labels";
import { Feedback, input, label, parseAmount, section, useCourierAction } from "./shared";

/** Nouveau livreur : son lien personnel est créé aussitôt. */
export function NewCourier() {
  const a = useCourierAction();
  const [f, setF] = useState({ name: "", phone: "", vehicleType: "Moto" });
  return (
    <form className={`${section} grid gap-3`} onSubmit={(e) => { e.preventDefault(); a.run({ action: "save_courier", delivererId: null, courier: f }, "Livreur ajouté : copiez-lui son lien.", () => setF({ name: "", phone: "", vehicleType: "Moto" })); }}>
      <h2 className="text-[17px] font-bold">Ajouter un livreur</h2>
      <label className={label}>Nom<input required maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={input} /></label>
      <label className={label}>Téléphone<input required type="tel" maxLength={30} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={input} /></label>
      <label className={label}>Véhicule<select value={f.vehicleType} onChange={(e) => setF({ ...f, vehicleType: e.target.value })} className={input}>{["Moto", "Vélo", "Voiture", "Tricycle", "À pied"].map((v) => <option key={v}>{v}</option>)}</select></label>
      <div><Button type="submit" variant="royal" loading={a.pending}>Ajouter</Button></div>
      <Feedback error={a.error} notice={a.notice} />
    </form>
  );
}

export function CourierLink({ delivererId, url, isActive }: { delivererId: string; url: string; isActive: boolean }) {
  const a = useCourierAction();
  const [copied, setCopied] = useState(false);
  return (
    <div className="grid gap-1.5">
      <p className="truncate rounded-lg bg-yc-ivory-50 px-3 py-1.5 font-mono text-xs ring-1 ring-yc-ink/[0.06]">{url}</p>
      <div className="flex flex-wrap gap-3 text-xs font-semibold">
        <button type="button" onClick={() => navigator.clipboard?.writeText(url).then(() => setCopied(true))} className="text-yc-electric hover:underline">{copied ? "Copié" : "Copier le lien"}</button>
        <button type="button" disabled={a.pending} onClick={() => window.confirm("Renouveler le lien ? L'ancien cessera aussitôt de fonctionner.") && a.run({ action: "renew_courier_link", delivererId }, "Lien renouvelé.")} className="text-yc-danger hover:underline">Renouveler</button>
        <button type="button" disabled={a.pending} onClick={() => a.run({ action: "save_courier", delivererId, courier: { isActive: !isActive } }, isActive ? "Livreur désactivé." : "Livreur réactivé.")} className="text-yc-ink-soft hover:underline">{isActive ? "Désactiver" : "Réactiver"}</button>
      </div>
      <Feedback error={a.error} notice={a.notice} />
    </div>
  );
}

/** Versement des espèces d'un livreur au bureau : écart motivé, reçu VER-. */
export function RemitForm({ delivererId, expected }: { delivererId: string; expected: number }) {
  const a = useCourierAction();
  const router = useRouter();
  const [amount, setAmount] = useState(formatNumber(expected));
  const [note, setNote] = useState("");
  const received = parseAmount(amount);
  const gap = received == null ? 0 : received - expected;
  return (
    <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); a.run({ action: "remit", remittance: { delivererId, receivedAmount: received ?? -1, discrepancyNote: note || null } }, "Versement enregistré.", (d) => router.replace(`/dashboard/caisse?recu=${(d as { receiptNumber: string }).receiptNumber}`)); }}>
      <div className="flex flex-wrap items-end gap-2">
        <label className={`${label} w-40`}>Reçu (FCFA)<input required inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d\s]/g, ""))} className={input} /></label>
        <Button type="submit" variant="royal" loading={a.pending}>Enregistrer le versement</Button>
      </div>
      {gap !== 0 && <label className={label}><span className={gap < 0 ? "text-yc-danger" : ""}>Écart de {formatNumber(gap)} FCFA : motif obligatoire</span><input required maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} className={input} /></label>}
      <Feedback error={a.error} notice={a.notice} />
    </form>
  );
}

/** Reversement à l'expéditeur : montant calculé par le serveur, reçu REV-. */
export function SettleForm({ senderId, amount }: { senderId: string; amount: number }) {
  const a = useCourierAction();
  const router = useRouter();
  const [method, setMethod] = useState("wave");
  const [reference, setReference] = useState("");
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); a.run({ action: "settle", settlement: { senderId, method, reference: reference || null } }, amount >= 0 ? "Reversement enregistré." : "Règlement de l'expéditeur enregistré.", (d) => router.replace(`/dashboard/caisse?recu=${(d as { receiptNumber: string }).receiptNumber}`)); }}>
      <label className={`${label} w-36`}>Moyen<select value={method} onChange={(e) => setMethod(e.target.value)} className={input}>{Object.entries(SETTLEMENT_METHOD_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      <label className={`${label} w-36`}>Référence<input maxLength={80} value={reference} onChange={(e) => setReference(e.target.value)} className={input} /></label>
      <Button type="submit" variant="royal" loading={a.pending}>{(amount >= 0 ? `Reverser ${formatNumber(amount)} F` : `Encaisser ${formatNumber(-amount)} F`).replace(/\u202f/g, "\u00a0")}</Button>
      <div className="w-full"><Feedback error={a.error} notice={a.notice} /></div>
    </form>
  );
}

export function CourierSettingsForm({ initial }: { initial: { mediumSurcharge: number; largeSurcharge: number; maxCod: number; maxAttempts: number; publicRequests: boolean } }) {
  const a = useCourierAction();
  const [f, setF] = useState({ ...initial, mediumSurcharge: String(initial.mediumSurcharge), largeSurcharge: String(initial.largeSurcharge), maxCod: String(initial.maxCod) });
  return (
    <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); a.run({ action: "settings", settings: { mediumSurcharge: parseAmount(f.mediumSurcharge) ?? 0, largeSurcharge: parseAmount(f.largeSurcharge) ?? 0, maxCod: parseAmount(f.maxCod) ?? 0, maxAttempts: Number(f.maxAttempts), publicRequests: f.publicRequests } }, "Règles enregistrées."); }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>Supplément colis moyen (FCFA)<input inputMode="numeric" value={f.mediumSurcharge} onChange={(e) => setF({ ...f, mediumSurcharge: e.target.value })} className={input} /></label>
        <label className={label}>Supplément grand colis (FCFA)<input inputMode="numeric" value={f.largeSurcharge} onChange={(e) => setF({ ...f, largeSurcharge: e.target.value })} className={input} /></label>
        <label className={label}>Plafond à encaisser par course (FCFA)<input inputMode="numeric" value={f.maxCod} onChange={(e) => setF({ ...f, maxCod: e.target.value })} className={input} /></label>
        <label className={label}>Tentatives avant retour<input type="number" min={1} max={10} value={f.maxAttempts} onChange={(e) => setF({ ...f, maxAttempts: Number(e.target.value) })} className={input} /></label>
      </div>
      <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={f.publicRequests} onChange={(e) => setF({ ...f, publicRequests: e.target.checked })} className="h-4 w-4" /> Demandes de course en ligne ouvertes</label>
      <div><Button type="submit" variant="royal" loading={a.pending}>Enregistrer</Button></div>
      <Feedback error={a.error} notice={a.notice} />
    </form>
  );
}

type ZoneRow = { id: string; name: string | null; region: string; commune: string | null; fee: number; estimatedDays: number | null; isActive: boolean };

/** Zones tarifaires : tarif de base d'une course vers chaque zone (petit colis). */
export function ZoneEditor({ zones, regions }: { zones: ZoneRow[]; regions: string[] }) {
  const a = useCourierAction();
  const empty = { name: "", region: regions[0] ?? "Dakar", commune: "", fee: "", estimatedDays: "0" };
  const [edit, setEdit] = useState<string | null>(null);
  const [f, setF] = useState(empty);
  const start = (z: ZoneRow | null) => { setEdit(z?.id ?? "new"); setF(z ? { name: z.name ?? "", region: z.region, commune: z.commune ?? "", fee: String(z.fee), estimatedDays: z.estimatedDays == null ? "" : String(z.estimatedDays) } : empty); };
  const save = (zoneId: string | null, extra: Record<string, unknown> = {}) => a.run({ action: "save_zone", zoneId, zone: { name: f.name, region: f.region, commune: f.commune || null, fee: parseAmount(f.fee) ?? -1, estimatedDays: f.estimatedDays === "" ? null : Number(f.estimatedDays), ...extra } }, "Zone enregistrée.", () => setEdit(null));
  return (
    <div className="grid gap-3">
      <ul className="divide-y divide-yc-ink/[0.06] rounded-lg ring-1 ring-yc-ink/[0.07]">
        {zones.map((z) => (
          <li key={z.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
            <span className={z.isActive ? "" : "text-yc-ink-soft line-through"}><span className="font-semibold">{z.name ?? z.commune ?? z.region}</span> · {z.region}{z.estimatedDays != null ? ` · ${z.estimatedDays === 0 ? "dans la journée" : `${z.estimatedDays} j`}` : ""}</span>
            <span className="flex items-center gap-3"><span className="yc-num font-semibold">{formatNumber(z.fee)} F</span><button type="button" onClick={() => start(z)} className="text-xs font-semibold text-yc-electric hover:underline">Modifier</button><button type="button" disabled={a.pending} onClick={() => a.run({ action: "save_zone", zoneId: z.id, zone: { name: z.name ?? z.region, region: z.region, commune: z.commune, fee: z.fee, estimatedDays: z.estimatedDays, isActive: !z.isActive } }, z.isActive ? "Zone désactivée." : "Zone réactivée.")} className="text-xs font-semibold text-yc-ink-soft hover:underline">{z.isActive ? "Désactiver" : "Réactiver"}</button></span>
          </li>
        ))}
        {zones.length === 0 && <li className="px-4 py-3 text-sm text-yc-ink-soft">Aucune zone : ajoutez-en une pour ouvrir les demandes.</li>}
      </ul>
      {edit ? (
        <form className="grid gap-3 rounded-lg bg-yc-ivory-50 p-4 ring-1 ring-yc-ink/[0.06] sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save(edit === "new" ? null : edit); }}>
          <label className={label}>Nom affiché<input required maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Dakar Plateau" className={input} /></label>
          <label className={label}>Région<select value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })} className={input}>{regions.map((r) => <option key={r}>{r}</option>)}</select></label>
          <label className={label}>Commune <span className="font-normal text-yc-ink-soft">(facultatif)</span><input maxLength={60} value={f.commune} onChange={(e) => setF({ ...f, commune: e.target.value })} className={input} /></label>
          <label className={label}>Tarif petit colis (FCFA)<input required inputMode="numeric" value={f.fee} onChange={(e) => setF({ ...f, fee: e.target.value.replace(/[^\d\s]/g, "") })} className={input} /></label>
          <label className={label}>Délai (jours, 0 = dans la journée)<input type="number" min={0} max={30} value={f.estimatedDays} onChange={(e) => setF({ ...f, estimatedDays: e.target.value })} className={input} /></label>
          <div className="flex items-end gap-2"><Button type="submit" variant="royal" loading={a.pending}>Enregistrer</Button><Button type="button" variant="secondary" onClick={() => setEdit(null)}>Annuler</Button></div>
        </form>
      ) : <div><Button type="button" variant="secondary" onClick={() => start(null)}>Ajouter une zone</Button></div>}
      <Feedback error={a.error} notice={a.notice} />
    </div>
  );
}
