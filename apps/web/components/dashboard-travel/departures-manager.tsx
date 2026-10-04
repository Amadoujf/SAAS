"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/yc/button";
import { Field, Input } from "@/components/yc/field";
import { IconPlus } from "@/components/yc/icons";
import { postTravel, section } from "./trip-editor";

export interface DepartureRow {
  id: string;
  dates: string;
  label: string | null;
  capacity: number;
  reserved: number;
  status: string;
  price: string;
  past: boolean;
}

/** Départs d'un voyage : ajout (date, places, prix spécifique), remplissage, ouverture ou
 *  fermeture à la réservation, capacité (jamais sous les places déjà réservées). */
export function DeparturesManager({ listingId, rows, canManage }: { listingId: string; rows: DepartureRow[]; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ date: "", capacity: "20", price: "", label: "" });
  const run = (body: unknown, reset = false) => {
    setError(null);
    start(async () => {
      try {
        await postTravel(body);
        if (reset) setForm({ date: "", capacity: form.capacity, price: "", label: "" });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action impossible.");
      }
    });
  };
  const min = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  return (
    <section className={section} aria-labelledby="departs-titre">
      <h2 id="departs-titre" className="text-[18px] font-bold tracking-[-0.015em]">Départs</h2>
      <p className="mt-1 text-sm text-yc-ink-soft">Chaque départ a ses places ; le site n&apos;accepte jamais plus de voyageurs que de places.</p>
      {rows.length > 0 && (
        <ul className="mt-4 divide-y divide-yc-ink/[0.06] rounded-lg ring-1 ring-yc-ink/[0.07]">
          {rows.map((d) => {
            const pct = Math.round((d.reserved / d.capacity) * 100);
            return (
              <li key={d.id} className={`flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 ${d.past ? "opacity-60" : ""}`}>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{d.dates}{d.label ? <span className="ml-2 text-sm font-normal text-yc-ink-soft">{d.label}</span> : null}</p>
                  <div className="mt-1.5 flex items-center gap-3 text-sm text-yc-ink-soft">
                    <span className="h-1.5 w-28 overflow-hidden rounded-full bg-yc-ink/[0.08]" aria-hidden="true"><span className={`block h-full rounded-full ${pct >= 100 ? "bg-yc-success" : "bg-yc-electric"}`} style={{ width: `${Math.min(100, pct)}%` }} /></span>
                    <span>{d.reserved} / {d.capacity} places</span>
                    <span>· {d.price}</span>
                    {d.status !== "open" && <span className="rounded-full bg-yc-ink/[0.06] px-2 py-0.5 text-xs font-semibold">Fermé</span>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/dashboard/departs/${d.id}`} className="text-sm font-semibold text-yc-electric hover:underline">Manifeste</Link>
                  {canManage && !d.past && (
                    <>
                      <Button size="sm" variant="ghost" loading={pending} onClick={() => { const v = window.prompt("Nombre de places", String(d.capacity)); if (v && Number(v) > 0) run({ action: "update_departure", departureId: d.id, capacity: Math.round(Number(v)) }); }}>Places</Button>
                      <Button size="sm" variant="secondary" loading={pending} onClick={() => run({ action: "update_departure", departureId: d.id, status: d.status === "open" ? "closed" : "open" })}>{d.status === "open" ? "Fermer" : "Rouvrir"}</Button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {canManage && (
        <form
          className="mt-5 grid gap-3 rounded-lg bg-yc-ivory-50 p-4 ring-1 ring-yc-ink/[0.06] sm:grid-cols-[1fr_110px_1fr_1fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            run({ action: "add_departure", departure: { listingId, date: form.date, capacity: Math.round(Number(form.capacity)), pricePerPerson: form.price ? Math.round(Number(form.price.replace(/\s/g, ""))) : null, label: form.label || null } }, true);
          }}
        >
          <Field label="Date de départ">{(p) => <Input {...p} type="date" required min={min} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />}</Field>
          <Field label="Places">{(p) => <Input {...p} inputMode="numeric" required value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />}</Field>
          <Field label="Prix / pers. (si différent)" optional>{(p) => <Input {...p} inputMode="numeric" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="Prix du voyage" />}</Field>
          <Field label="Nom du départ" optional>{(p) => <Input {...p} maxLength={60} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Vacances scolaires" />}</Field>
          <Button type="submit" variant="royal" size="sm" loading={pending}><IconPlus size={15} /> Ajouter</Button>
        </form>
      )}
      {error && <p role="alert" className="mt-3 text-sm font-medium text-yc-danger">{error}</p>}
    </section>
  );
}
