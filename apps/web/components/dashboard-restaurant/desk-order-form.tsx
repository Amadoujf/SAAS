"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/yc/button";
import type { MenuSectionData, MenuDish } from "@/lib/restaurant/restaurant-data";
import { formatXof } from "@/lib/restaurant/labels";
import { postResto, section } from "./shared";

interface Line { key: string; dish: MenuDish; optionIds: string[]; quantity: number; note: string }

/**
 * Commande saisie en salle ou au téléphone. Les montants affichés sont indicatifs : le
 * serveur recalcule chaque ligne depuis la carte et vérifie les options.
 */
export function DeskOrderForm({ sections, tables, defaultTableId }: { sections: MenuSectionData[]; tables: { id: string; label: string }[]; defaultTableId: string | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<"dine_in" | "takeaway" | "delivery">(tables.length ? "dine_in" : "takeaway");
  const [tableId, setTableId] = useState(defaultTableId ?? tables[0]?.id ?? "");
  const [lines, setLines] = useState<Line[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [f, setF] = useState({ firstName: "", phone: "", address: "", note: "", channel: "dashboard" as "dashboard" | "phone" | "whatsapp" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unit = (d: MenuDish, ids: string[]) => d.price + d.groups.flatMap((g) => g.options).filter((o) => ids.includes(o.id)).reduce((s, o) => s + o.priceDelta, 0);
  const total = lines.reduce((s, l) => s + unit(l.dish, l.optionIds) * l.quantity, 0);
  const add = (d: MenuDish, ids: string[]) => {
    const key = `${d.id}|${[...ids].sort().join(",")}`;
    setLines((ls) => (ls.some((l) => l.key === key) ? ls.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l)) : [...ls, { key, dish: d, optionIds: ids, quantity: 1, note: "" }]));
    setOpen(null);
    setPicked({});
  };
  const submit = async () => {
    setPending(true);
    setError(null);
    try {
      const data = await postResto<{ id: string }>({
        action: "desk_order",
        order: {
          mode,
          tableId: mode === "dine_in" ? tableId || null : null,
          items: lines.map((l) => ({ dishId: l.dish.id, quantity: l.quantity, optionIds: l.optionIds, note: l.note || null })),
          firstName: f.firstName,
          phone: f.phone || null,
          deliveryAddress: mode === "delivery" ? f.address : null,
          note: f.note || null,
          channel: f.channel,
        },
      });
      router.push(`/dashboard/ventes/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Commande impossible.");
      setPending(false);
    }
  };
  const input = "h-11 w-full rounded-xl bg-white px-3 text-sm font-normal ring-1 ring-inset ring-yc-ink/12";
  return (
    <div className="grid gap-5 pb-24 lg:grid-cols-[1.4fr_1fr]">
      <section className={section} aria-labelledby="carte-titre">
        <h2 id="carte-titre" className="text-[18px] font-bold tracking-[-0.015em]">La carte</h2>
        {sections.map((s) => (
          <div key={s.id} className="mt-5">
            <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-yc-ink-soft">{s.name}</h3>
            <ul className="mt-2 divide-y divide-yc-ink/[0.06] rounded-lg ring-1 ring-yc-ink/[0.07]">
              {s.dishes.map((d) => (
                <li key={d.id} className={d.isAvailable ? "" : "opacity-50"}>
                  <div className="flex items-center gap-3 px-3.5 py-2.5">
                    <span className="min-w-0 flex-1 text-sm"><span className="font-semibold">{d.name}</span>{!d.isAvailable && " · épuisé"}</span>
                    <span className="yc-num text-sm">{formatXof(d.price)}</span>
                    <button type="button" disabled={!d.isAvailable} aria-label={`Ajouter ${d.name}`} onClick={() => (d.groups.length ? setOpen(open === d.id ? null : d.id) : add(d, []))} className="grid h-9 w-9 place-items-center rounded-lg bg-yc-night-900 text-lg font-bold text-white disabled:opacity-40">+</button>
                  </div>
                  {open === d.id && (
                    <div className="grid gap-3 border-t border-yc-ink/[0.06] bg-yc-ivory-50 px-3.5 py-3">
                      {d.groups.map((g) => (
                        <fieldset key={g.id} className="min-w-0">
                          <legend className="text-[13px] font-semibold">{g.name} <span className="font-normal text-yc-ink-soft">{g.min ? `(${g.min === g.max ? g.min : `${g.min} à ${g.max}`})` : `(facultatif, ${g.max} max)`}</span></legend>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {g.options.map((o) => {
                              const cur = picked[g.id] ?? [];
                              const on = cur.includes(o.id);
                              return (
                                <button key={o.id} type="button" disabled={!o.isAvailable} aria-pressed={on} onClick={() => setPicked((p) => ({ ...p, [g.id]: g.max === 1 ? [o.id] : on ? cur.filter((x) => x !== o.id) : cur.length < g.max ? [...cur, o.id] : cur }))} className={`rounded-full px-3 py-1.5 text-[13px] font-medium ring-1 ring-inset disabled:line-through disabled:opacity-50 ${on ? "bg-[#EAF0FF] text-yc-royal ring-yc-royal" : "bg-white ring-yc-ink/12"}`}>
                                  {o.name}{o.priceDelta ? ` +${formatXof(o.priceDelta)}` : ""}
                                </button>
                              );
                            })}
                          </div>
                        </fieldset>
                      ))}
                      <div>
                        <Button type="button" size="sm" variant="royal" disabled={d.groups.some((g) => (picked[g.id]?.length ?? 0) < g.min)} onClick={() => add(d, Object.values(picked).flat())}>Ajouter</Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <form className={`${section} grid content-start gap-4 lg:sticky lg:top-24`} onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <h2 className="text-[18px] font-bold tracking-[-0.015em]">La commande</h2>
        <div role="radiogroup" aria-label="Mode" className="grid grid-cols-3 gap-1 rounded-xl bg-yc-ink/[0.05] p-1">
          {(["dine_in", "takeaway", "delivery"] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={`h-10 rounded-lg text-[13px] font-semibold ${mode === m ? "bg-white shadow" : "text-yc-ink-soft"}`}>{m === "dine_in" ? "Sur place" : m === "takeaway" ? "À emporter" : "Livraison"}</button>
          ))}
        </div>
        {mode === "dine_in" && (
          <label className="grid gap-1.5 text-[13px] font-semibold">Table
            <select required value={tableId} onChange={(e) => setTableId(e.target.value)} className={input}>
              {tables.map((t) => <option key={t.id} value={t.id}>Table {t.label}</option>)}
            </select>
          </label>
        )}
        {lines.length === 0 ? (
          <p className="rounded-lg border border-dashed border-yc-ink/15 px-4 py-6 text-center text-sm text-yc-ink-soft">Ajoutez des plats depuis la carte.</p>
        ) : (
          <ul className="divide-y divide-yc-ink/[0.06] rounded-lg ring-1 ring-yc-ink/[0.07]">
            {lines.map((l) => (
              <li key={l.key} className="grid gap-1.5 px-3 py-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 font-semibold">{l.dish.name}</span>
                  <button type="button" aria-label={`Retirer un ${l.dish.name}`} onClick={() => setLines((ls) => ls.flatMap((x) => (x.key === l.key ? (x.quantity > 1 ? [{ ...x, quantity: x.quantity - 1 }] : []) : [x])))} className="grid h-8 w-8 place-items-center rounded-lg ring-1 ring-yc-ink/12">−</button>
                  <span className="yc-num w-5 text-center font-bold">{l.quantity}</span>
                  <button type="button" aria-label={`Ajouter un ${l.dish.name}`} onClick={() => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, quantity: Math.min(50, x.quantity + 1) } : x)))} className="grid h-8 w-8 place-items-center rounded-lg ring-1 ring-yc-ink/12">+</button>
                  <span className="yc-num w-24 text-right">{formatXof(unit(l.dish, l.optionIds) * l.quantity)}</span>
                </div>
                {l.optionIds.length > 0 && <span className="text-xs text-yc-ink-soft">{l.dish.groups.flatMap((g) => g.options).filter((o) => l.optionIds.includes(o.id)).map((o) => o.name).join(", ")}</span>}
                <input aria-label={`Précision pour ${l.dish.name}`} placeholder="Précision pour la cuisine" maxLength={200} value={l.note} onChange={(e) => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, note: e.target.value } : x)))} className="h-9 rounded-lg bg-white px-2.5 text-[13px] ring-1 ring-inset ring-yc-ink/10" />
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-[13px] font-semibold">Prénom<input required maxLength={80} value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} className={input} /></label>
          <label className="grid gap-1.5 text-[13px] font-semibold">Téléphone {mode === "dine_in" && <span className="font-normal text-yc-ink-soft">(facultatif)</span>}<input required={mode !== "dine_in"} type="tel" maxLength={20} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={input} /></label>
        </div>
        {mode === "delivery" && <label className="grid gap-1.5 text-[13px] font-semibold">Adresse de livraison<input required maxLength={300} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} className={input} /></label>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-[13px] font-semibold">Reçue par
            <select value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value as typeof f.channel })} className={input}>
              <option value="dashboard">En salle / au comptoir</option>
              <option value="phone">Téléphone</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-[13px] font-semibold">Note <span className="font-normal text-yc-ink-soft">(facultatif)</span><input maxLength={400} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} className={input} /></label>
        </div>
        <p className="flex justify-between border-t border-yc-ink/[0.06] pt-3 text-base font-bold"><span>Total indicatif</span><span className="yc-num">{formatXof(total)}</span></p>
        <p className="-mt-2 text-xs text-yc-ink-soft">Prix recalculés par le serveur depuis la carte{mode === "delivery" ? ", frais de livraison ajoutés" : ""}.</p>
        {error && <p role="alert" className="text-sm font-medium text-yc-danger">{error}</p>}
        <Button type="submit" variant="royal" loading={pending} disabled={!lines.length}>Envoyer en cuisine</Button>
      </form>
    </div>
  );
}
