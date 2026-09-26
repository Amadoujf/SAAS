"use client";

import { useState } from "react";
import { Button } from "@/components/yc/button";
import { Field, Input, Select, Textarea } from "@/components/yc/field";
import { Pill } from "@/components/yc/status-pill";
import { EmptyState } from "@/components/yc/empty-state";
import { IconPlus, IconTruck } from "@/components/yc/icons";
import { Dialog } from "@/components/dashboard-orders/dialog";
import { Feedback } from "./feedback";
import { Toggle } from "./toggle";
import { useSettingsAction } from "./use-settings-action";

export interface ZoneView {
  id: string; name: string | null; region: string; commune: string | null; fee: number; freeThreshold: number | null;
  bulkySurcharge: number; estimatedDays: number | null; isActive: boolean; excludedCategoryIds: string[];
}

const fmt = (n: number) => new Intl.NumberFormat("fr-SN").format(n);

export function ZonesManager({ zones, regions, categories }: { zones: ZoneView[]; regions: string[]; categories: { id: string; name: string }[] }) {
  const [editing, setEditing] = useState<ZoneView | "new" | null>(null);
  const { run, pending, error, success } = useSettingsAction();
  const current = editing === "new" ? null : editing;
  const [form, setForm] = useState<Record<string, string>>({});
  const [excluded, setExcluded] = useState<string[]>([]);

  function open(zone: ZoneView | "new") {
    const z = zone === "new" ? null : zone;
    setForm({
      name: z?.name ?? "", region: z?.region ?? "Dakar", commune: z?.commune ?? "", fee: String(z?.fee ?? 1500),
      freeThreshold: z?.freeThreshold !== null && z?.freeThreshold !== undefined ? String(z.freeThreshold) : "",
      bulkySurcharge: String(z?.bulkySurcharge ?? 0), estimatedDays: z?.estimatedDays !== null && z?.estimatedDays !== undefined ? String(z.estimatedDays) : "",
    });
    setExcluded(z?.excludedCategoryIds ?? []);
    setEditing(zone);
  }
  const set = (k: string) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const num = (v: string | undefined) => (v === undefined || v.trim() === "" ? null : Math.max(0, Math.round(Number(v))));

  return (
    <div>
      {zones.length === 0 ? (
        <EmptyState title="Aucune zone de livraison" description="Ajoutez vos zones et leurs tarifs : ils seront recalculés côté serveur à chaque commande." action={<Button onClick={() => open("new")}><IconPlus size={18} /> Ajouter une zone</Button>} />
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-3 px-5 pb-5 sm:grid-cols-2 sm:px-6">
            {zones.map((z) => (
              <li key={z.id}>
                <button type="button" onClick={() => open(z)} className={`yc-focus group w-full rounded-2xl p-4 text-left ring-1 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-yc ${z.isActive ? "bg-white ring-yc-ink/10" : "bg-yc-ivory-100 ring-yc-ink/5 opacity-70"}`}>
                  <span className="flex items-start justify-between gap-2">
                    <span className="font-semibold">{z.name ?? [z.commune, z.region].filter(Boolean).join(", ")}</span>
                    {!z.isActive && <Pill tone="neutral">Désactivée</Pill>}
                  </span>
                  <span className="mt-1 block text-xs text-yc-ink-soft">{z.region}{z.estimatedDays !== null ? ` · ${z.estimatedDays === 0 ? "le jour même" : `${z.estimatedDays} j`}` : ""}</span>
                  <span className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-1">
                    <span className="font-display text-2xl font-semibold yc-num">{fmt(z.fee)}<span className="ml-1 text-xs text-yc-ink-soft">FCFA</span></span>
                    {z.freeThreshold !== null && <span className="text-xs text-yc-ink-soft">Offerte dès {fmt(z.freeThreshold)} F</span>}
                    {z.bulkySurcharge > 0 && <span className="text-xs text-yc-ink-soft">+{fmt(z.bulkySurcharge)} F encombrant</span>}
                    {z.excludedCategoryIds.length > 0 && <span className="text-xs text-yc-ink-soft">{z.excludedCategoryIds.length} catégorie(s) exclue(s)</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="px-5 pb-5 sm:px-6"><Button variant="secondary" onClick={() => open("new")}><IconPlus size={18} /> Ajouter une zone</Button></div>
        </>
      )}

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={current ? "Modifier la zone" : "Nouvelle zone de livraison"}>
        <form
          className="grid grid-cols-2 gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await run("save", {
              action: "zone.save",
              zoneId: current?.id ?? null,
              zone: {
                name: form.name?.trim() || null, region: form.region, commune: form.commune?.trim() || null,
                fee: num(form.fee) ?? 0, freeThreshold: num(form.freeThreshold), bulkySurcharge: num(form.bulkySurcharge) ?? 0,
                estimatedDays: num(form.estimatedDays), excludedCategoryIds: excluded,
              },
            }, "Zone enregistrée.");
            if (ok) setEditing(null);
          }}
        >
          <div className="col-span-2"><Field label="Nom affiché au client" optional>{(p) => <Input {...p} value={form.name} onChange={set("name")} placeholder="Dakar Plateau — express" />}</Field></div>
          <Field label="Région">{(p) => <Select {...p} value={form.region} onChange={set("region")}>{regions.map((r) => <option key={r}>{r}</option>)}</Select>}</Field>
          <Field label="Commune" optional>{(p) => <Input {...p} value={form.commune} onChange={set("commune")} />}</Field>
          <Field label="Tarif (FCFA)">{(p) => <Input {...p} inputMode="numeric" value={form.fee} onChange={set("fee")} required />}</Field>
          <Field label="Délai (jours)" optional>{(p) => <Input {...p} inputMode="numeric" value={form.estimatedDays} onChange={set("estimatedDays")} />}</Field>
          <Field label="Offerte à partir de" optional hint="Montant du panier en FCFA">{(p) => <Input {...p} inputMode="numeric" value={form.freeThreshold} onChange={set("freeThreshold")} />}</Field>
          <Field label="Supplément encombrant" hint="Ajouté si un article encombrant">{(p) => <Input {...p} inputMode="numeric" value={form.bulkySurcharge} onChange={set("bulkySurcharge")} />}</Field>
          {categories.length > 0 && (
            <fieldset className="col-span-2">
              <legend className="text-[13px] font-semibold">Catégories non livrées dans cette zone</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {categories.map((c) => {
                  const on = excluded.includes(c.id);
                  return (
                    <button key={c.id} type="button" aria-pressed={on} onClick={() => setExcluded((x) => (on ? x.filter((i) => i !== c.id) : [...x, c.id]))}
                      className={`yc-focus rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition-colors ${on ? "bg-yc-danger/10 text-[rgb(185_28_28)] ring-yc-danger/30" : "ring-yc-ink/15 text-yc-ink-soft hover:ring-yc-ink/30"}`}>
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
          <div className="col-span-2"><Feedback error={error} success={null} /></div>
          <div className="col-span-2 mt-2 flex flex-wrap justify-between gap-2">
            {current ? (
              <Button type="button" variant="danger" loading={pending === "delete"} onClick={async () => { const ok = await run("delete", { action: "zone.delete", zoneId: current.id }, "Zone retirée."); if (ok) setEditing(null); }}>
                Supprimer
              </Button>
            ) : <span />}
            <span className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Annuler</Button>
              <Button type="submit" loading={pending === "save"}>Enregistrer</Button>
            </span>
          </div>
        </form>
      </Dialog>
      <div className="px-5 sm:px-6"><Feedback error={editing ? null : error} success={success} /></div>
    </div>
  );
}

export function StoreSettingsForm({ initial }: { initial: { pickupEnabled: boolean; pickupAddress: string | null; pickupInstructions: string | null; deliveryInstructions: string | null; guestCheckoutEnabled: boolean; manualPaymentWindowHours: number } }) {
  const [s, setS] = useState({ ...initial, pickupAddress: initial.pickupAddress ?? "", pickupInstructions: initial.pickupInstructions ?? "", deliveryInstructions: initial.deliveryInstructions ?? "" });
  const { run, pending, error, success } = useSettingsAction();
  return (
    <form
      className="flex flex-col gap-5 px-5 pb-5 sm:px-6"
      onSubmit={(e) => {
        e.preventDefault();
        run("settings", {
          action: "settings.save",
          settings: { ...s, pickupAddress: s.pickupAddress || null, pickupInstructions: s.pickupInstructions || null, deliveryInstructions: s.deliveryInstructions || null, manualPaymentWindowHours: Number(s.manualPaymentWindowHours) },
        }, "Réglages enregistrés.");
      }}
    >
      <Toggle checked={s.pickupEnabled} onChange={(v) => setS({ ...s, pickupEnabled: v })} label="Retrait en boutique" description="Le client récupère sa commande sans frais de livraison." />
      {s.pickupEnabled && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Adresse de retrait">{(p) => <Input {...p} value={s.pickupAddress} onChange={(e) => setS({ ...s, pickupAddress: e.target.value })} />}</Field>
          <Field label="Horaires / instructions">{(p) => <Input {...p} value={s.pickupInstructions} onChange={(e) => setS({ ...s, pickupInstructions: e.target.value })} />}</Field>
        </div>
      )}
      <Field label="Instructions de livraison affichées au client" optional>{(p) => <Textarea {...p} value={s.deliveryInstructions} onChange={(e) => setS({ ...s, deliveryInstructions: e.target.value })} />}</Field>
      <Toggle checked={s.guestCheckoutEnabled} onChange={(v) => setS({ ...s, guestCheckoutEnabled: v })} label="Commande sans compte" description="Le client commande avec son seul numéro de téléphone." />
      <Field label="Délai pour payer par Wave / Orange Money (heures)" hint="Au-delà, la commande expire et le stock est libéré.">
        {(p) => <Input {...p} type="number" min={1} max={168} value={s.manualPaymentWindowHours} onChange={(e) => setS({ ...s, manualPaymentWindowHours: Number(e.target.value) })} />}
      </Field>
      <div className="flex items-center justify-between gap-3">
        <Feedback error={error} success={success} />
        <Button type="submit" loading={pending === "settings"} className="ml-auto">Enregistrer</Button>
      </div>
    </form>
  );
}

export function DeliverersManager({ deliverers }: { deliverers: { id: string; phone: string; vehicleType: string | null; isActive: boolean }[] }) {
  const { run, pending, error, success } = useSettingsAction();
  const [phone, setPhone] = useState("");
  const [label, setLabel] = useState("");
  return (
    <div className="px-5 pb-5 sm:px-6">
      {deliverers.length > 0 && (
        <ul className="mb-4 divide-y divide-yc-ink/[0.06]">
          {deliverers.map((d) => (
            <li key={d.id} className="flex items-center gap-3 py-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-yc-ivory-100 text-yc-electric"><IconTruck size={18} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{d.vehicleType ?? "Livreur"}</span>
                <span className="block text-xs text-yc-ink-soft">{d.phone}</span>
              </span>
              <Toggle checked={d.isActive} disabled={pending !== null} onChange={(v) => run(`t-${d.id}`, { action: "deliverer.toggle", delivererId: d.id, isActive: v }, v ? "Livreur réactivé." : "Livreur désactivé.")} label={`Actif : ${d.vehicleType ?? d.phone}`} />
            </li>
          ))}
        </ul>
      )}
      <form
        className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await run("add", { action: "deliverer.add", phone, vehicleType: label || null }, "Livreur ajouté.");
          if (ok) { setPhone(""); setLabel(""); }
        }}
      >
        <Field label="Téléphone du livreur">{(p) => <Input {...p} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="77 123 45 67" required />}</Field>
        <Field label="Nom / véhicule" optional>{(p) => <Input {...p} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Moto — Modou" />}</Field>
        <Button type="submit" variant="secondary" loading={pending === "add"}><IconPlus size={18} /> Ajouter</Button>
      </form>
      <Feedback error={error} success={success} />
    </div>
  );
}
