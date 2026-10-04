"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/yc/button";
import { BADGE_LABELS, clockLabel, formatXof } from "@/lib/restaurant/labels";
import { Feedback, section, useRestoAction } from "./shared";

export interface ManagedSection {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  availableFrom: number | null;
  availableTo: number | null;
  dishes: { id: string; name: string; price: number; isAvailable: boolean; isActive: boolean; badges: string[]; imageUrl: string | null; groups: number; soldOutOptions: { id: string; name: string }[] }[];
}

const toHHMM = (m: number | null) => (m == null ? "" : `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
const toMin = (v: string) => {
  if (!v) return null;
  const [h, m] = v.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

function SectionForm({ initial, sectionId, onDone }: { initial: Omit<ManagedSection, "id" | "dishes">; sectionId: string | null; onDone?: () => void }) {
  const a = useRestoAction();
  const [f, setF] = useState({ name: initial.name, description: initial.description ?? "", isActive: initial.isActive, from: toHHMM(initial.availableFrom), to: toHHMM(initial.availableTo) });
  const input = "h-10 w-full rounded-lg bg-white px-3 text-sm font-normal ring-1 ring-inset ring-yc-ink/12";
  return (
    <form
      className="grid gap-3 sm:grid-cols-[1.2fr_1.5fr_0.7fr_0.7fr_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        a.run({ action: "save_section", sectionId, section: { name: f.name, description: f.description || null, isActive: f.isActive, availableFrom: toMin(f.from), availableTo: f.to === "00:00" ? 1440 : toMin(f.to) } }, sectionId ? "Rubrique enregistrée." : "Rubrique ajoutée.", () => {
          if (!sectionId) setF({ name: "", description: "", isActive: true, from: "", to: "" });
          onDone?.();
        });
      }}
    >
      <label className="grid gap-1.5 text-[13px] font-semibold">Nom<input required maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={input} placeholder="Grillades" /></label>
      <label className="grid gap-1.5 text-[13px] font-semibold">Description <span className="font-normal text-yc-ink-soft">(facultatif)</span><input maxLength={300} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className={input} /></label>
      <label className="grid gap-1.5 text-[13px] font-semibold">Servi de<input type="time" step={900} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} className={input} /></label>
      <label className="grid gap-1.5 text-[13px] font-semibold">à<input type="time" step={900} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} className={input} /></label>
      <div className="flex items-center gap-3">
        {sectionId && <label className="flex items-center gap-1.5 text-[13px]"><input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} className="h-4 w-4 accent-yc-royal" /> Visible</label>}
        <Button type="submit" size="sm" variant={sectionId ? "secondary" : "royal"} loading={a.pending}>{sectionId ? "Enregistrer" : "Ajouter"}</Button>
      </div>
      <div className="sm:col-span-5"><Feedback error={a.error} notice={a.notice} /></div>
    </form>
  );
}

/**
 * La carte au quotidien : épuisé / disponible en un geste (plat ou choix d'option),
 * rubriques et plages de service, accès à la fiche de chaque plat.
 */
export function MenuManager({ sections, canEdit, canToggle }: { sections: ManagedSection[]; canEdit: boolean; canToggle: boolean }) {
  const a = useRestoAction();
  const [editing, setEditing] = useState<string | null>(null);
  // Bascule immédiate à l'écran ; annulée si le serveur refuse.
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (a.error) setOptimistic({});
  }, [a.error]);
  useEffect(() => setOptimistic({}), [sections]);
  return (
    <div className="grid gap-5">
      <Feedback error={a.error} notice={a.notice} />
      {sections.map((s) => (
        <section key={s.id} className={section} aria-labelledby={`s-${s.id}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id={`s-${s.id}`} className="text-[18px] font-bold tracking-[-0.015em]">{s.name}{!s.isActive && <span className="ml-2 text-sm font-medium text-yc-ink-soft">(masquée)</span>}</h2>
              <p className="text-sm text-yc-ink-soft">{s.availableFrom != null && s.availableTo != null ? `Servi de ${clockLabel(s.availableFrom)} à ${clockLabel(s.availableTo)}` : "Toute la journée"} · {s.dishes.length} plat{s.dishes.length > 1 ? "s" : ""}</p>
            </div>
            <div className="flex gap-2">
              {canEdit && <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(editing === s.id ? null : s.id)}>{editing === s.id ? "Fermer" : "Modifier"}</Button>}
              {canEdit && <Link href={`/dashboard/carte/plat/nouveau?rubrique=${s.id}`} className="inline-flex h-9 items-center rounded-lg bg-yc-night-900 px-3.5 text-sm font-semibold text-white">+ Plat</Link>}
            </div>
          </div>
          {editing === s.id && <div className="mt-4 rounded-lg bg-yc-ivory-50 p-4"><SectionForm sectionId={s.id} initial={s} onDone={() => setEditing(null)} /></div>}
          {s.dishes.length > 0 && (
            <ul className="mt-4 divide-y divide-yc-ink/[0.06] rounded-lg ring-1 ring-yc-ink/[0.07]">
              {s.dishes.map((d) => (
                <li key={d.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${d.isActive ? "" : "opacity-50"}`}>
                  {d.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="h-11 w-11 shrink-0 rounded-lg bg-yc-ink/[0.05]" />
                  )}
                  <span className="min-w-0 flex-1">
                    <Link href={`/dashboard/carte/plat/${d.id}`} className="font-semibold hover:underline">{d.name}</Link>
                    <span className="block text-xs text-yc-ink-soft">
                      {[d.badges.map((b) => BADGE_LABELS[b]).join(", "), d.groups ? `${d.groups} groupe${d.groups > 1 ? "s" : ""} d'options` : "", !d.isActive ? "retiré de la carte" : ""].filter(Boolean).join(" · ")}
                    </span>
                    {d.soldOutOptions.length > 0 && (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {d.soldOutOptions.map((o) => (
                          <button key={o.id} type="button" disabled={!canToggle || a.pending} onClick={() => a.run({ action: "option_available", optionId: o.id, isAvailable: true }, `« ${o.name} » de nouveau disponible.`)} className="rounded-full bg-[#FDECEC] px-2 py-0.5 text-[11px] font-semibold text-[#7A1717]" title="Remettre en service">{o.name} · épuisé ✕</button>
                        ))}
                      </span>
                    )}
                  </span>
                  <span className="yc-num w-24 text-right text-sm font-semibold">{formatXof(d.price)}</span>
                  {(() => {
                    const on = optimistic[d.id] ?? d.isAvailable;
                    return (
                      <label className={`flex h-9 items-center gap-2 rounded-full px-3 text-[13px] font-semibold ring-1 ring-inset ${on ? "bg-[#E8F6EF] text-[#0F4D31] ring-[#3FA176]/40" : "bg-[#FDECEC] text-[#7A1717] ring-[#D65A5A]/40"}`}>
                        <input
                          type="checkbox"
                          role="switch"
                          checked={on}
                          disabled={!canToggle || a.pending}
                          onChange={(e) => {
                            const next = e.target.checked;
                            setOptimistic((o) => ({ ...o, [d.id]: next }));
                            a.run({ action: "dish_available", dishId: d.id, isAvailable: next }, next ? `${d.name} : de nouveau disponible.` : `${d.name} : épuisé.`);
                          }}
                          className="h-4 w-4 accent-[#0F4D31]"
                          aria-label={`${d.name} disponible`}
                        />
                        {on ? "Disponible" : "Épuisé"}
                      </label>
                    );
                  })()}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      {canEdit && (
        <section className={section} aria-labelledby="nouvelle-rubrique">
          <h2 id="nouvelle-rubrique" className="mb-4 text-[18px] font-bold tracking-[-0.015em]">Nouvelle rubrique</h2>
          <SectionForm sectionId={null} initial={{ name: "", description: null, isActive: true, availableFrom: null, availableTo: null }} />
        </section>
      )}
    </div>
  );
}
