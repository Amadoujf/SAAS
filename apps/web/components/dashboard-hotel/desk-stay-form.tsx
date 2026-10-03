"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/yc/button";
import { Field, Input, Select } from "@/components/yc/field";
import { postHotel, section } from "./shared";

interface Option {
  listingId: string;
  title: string;
  nights: number;
  total: number | null;
  bookable: boolean;
  reason: string | null;
  freeRooms: { id: string; number: string; housekeeping: string }[];
}

const nf = new Intl.NumberFormat("fr-FR");
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Réservation à la réception ou au téléphone : dates, voyageurs, type et chambre libres, client. */
export function DeskStayForm({ today }: { today: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState({ arrival: today, departure: addDays(today, 1), adults: 2, children: 0 });
  const [options, setOptions] = useState<Option[] | null>(null);
  const [choice, setChoice] = useState<{ listingId: string; roomId: string } | null>(null);
  const [client, setClient] = useState({ firstName: "", lastName: "", phone: "", note: "", channel: "dashboard" as "dashboard" | "phone" | "whatsapp" });

  useEffect(() => {
    if (!q.arrival || !q.departure || q.departure <= q.arrival) return;
    let alive = true;
    setOptions(null);
    setChoice(null);
    const p = new URLSearchParams({ arrival: q.arrival, departure: q.departure, adults: String(q.adults), children: String(q.children) });
    fetch(`/api/dashboard/hotel/availability?${p}`)
      .then(async (r) => {
        const j = (await r.json()) as { data?: Option[]; error?: string };
        if (!r.ok || !j.data) throw new Error(j.error ?? "Disponibilités indisponibles.");
        if (alive) setOptions(j.data);
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [q]);

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!choice) return setError("Choisissez une chambre.");
        setError(null);
        start(async () => {
          try {
            const r = await postHotel<{ id: string }>({ action: "book", stay: { ...choice, ...q, firstName: client.firstName, lastName: client.lastName || null, phone: client.phone, note: client.note || null, channel: client.channel } });
            router.push(`/dashboard/sejours/${r.id}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Réservation impossible.");
          }
        });
      }}
    >
      <section className={section}>
        <h2 className="text-[18px] font-bold tracking-[-0.015em]">Dates et voyageurs</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          <Field label="Arrivée">{(p) => <Input {...p} type="date" min={today} required value={q.arrival} onChange={(e) => { const v = e.target.value; setQ({ ...q, arrival: v, departure: v >= q.departure ? addDays(v, 1) : q.departure }); }} />}</Field>
          <Field label="Départ">{(p) => <Input {...p} type="date" min={addDays(q.arrival, 1)} required value={q.departure} onChange={(e) => setQ({ ...q, departure: e.target.value })} />}</Field>
          <Field label="Adultes">{(p) => <Select {...p} value={q.adults} onChange={(e) => setQ({ ...q, adults: Number(e.target.value) })}>{[1, 2, 3, 4, 5, 6].map((n) => <option key={n}>{n}</option>)}</Select>}</Field>
          <Field label="Enfants">{(p) => <Select {...p} value={q.children} onChange={(e) => setQ({ ...q, children: Number(e.target.value) })}>{[0, 1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}</Select>}</Field>
        </div>
        <div className="mt-5 grid gap-3">
          {!options ? (
            <p className="text-sm text-yc-ink-soft">Recherche des chambres libres…</p>
          ) : (
            options.map((o) => (
              <fieldset key={o.listingId} className={`rounded-lg p-4 ring-1 ${o.bookable ? "ring-yc-ink/10" : "bg-yc-ink/[0.02] ring-yc-ink/[0.06]"}`}>
                <legend className="sr-only">{o.title}</legend>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">{o.title}</p>
                  <p className="text-sm">{o.bookable ? <><strong className="yc-num">{o.total == null ? "Sur demande" : `${nf.format(o.total)} FCFA`}</strong> <span className="text-yc-ink-soft">pour {o.nights} nuit{o.nights > 1 ? "s" : ""}</span></> : <span className="text-yc-ink-soft">{o.reason === "full" ? "Complet" : o.reason === "capacity" ? "Capacité insuffisante" : o.reason?.startsWith("min_nights") ? `Minimum ${o.reason.split(":")[1]} nuits` : "Indisponible"}</span>}</p>
                </div>
                {o.bookable && (
                  <div role="radiogroup" aria-label={`Chambres libres : ${o.title}`} className="mt-3 flex flex-wrap gap-2">
                    {o.freeRooms.map((r) => {
                      const on = choice?.roomId === r.id;
                      return (
                        <button key={r.id} type="button" role="radio" aria-checked={on} onClick={() => setChoice({ listingId: o.listingId, roomId: r.id })} className={`h-9 rounded-lg px-3.5 text-sm font-semibold ring-1 ring-inset ${on ? "bg-yc-royal text-white ring-yc-royal" : "bg-white ring-yc-ink/12 hover:ring-yc-royal"}`}>
                          Ch. {r.number}{r.housekeeping === "dirty" ? " · à nettoyer" : ""}
                        </button>
                      );
                    })}
                  </div>
                )}
              </fieldset>
            ))
          )}
        </div>
      </section>
      <section className={section}>
        <h2 className="text-[18px] font-bold tracking-[-0.015em]">Client</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Prénom">{(p) => <Input {...p} required maxLength={80} value={client.firstName} onChange={(e) => setClient({ ...client, firstName: e.target.value })} />}</Field>
          <Field label="Nom" optional>{(p) => <Input {...p} maxLength={80} value={client.lastName} onChange={(e) => setClient({ ...client, lastName: e.target.value })} />}</Field>
          <Field label="Téléphone" hint="Un client déjà connu est retrouvé par son numéro.">{(p) => <Input {...p} type="tel" required maxLength={20} value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} />}</Field>
          <Field label="Pris par">{(p) => <Select {...p} value={client.channel} onChange={(e) => setClient({ ...client, channel: e.target.value as typeof client.channel })}><option value="dashboard">À la réception</option><option value="phone">Téléphone</option><option value="whatsapp">WhatsApp</option></Select>}</Field>
          <div className="sm:col-span-2"><Field label="Note" optional>{(p) => <Input {...p} maxLength={600} value={client.note} onChange={(e) => setClient({ ...client, note: e.target.value })} />}</Field></div>
        </div>
      </section>
      {error && <p role="alert" className="text-sm font-medium text-yc-danger">{error}</p>}
      <div><Button type="submit" variant="royal" loading={pending} disabled={!choice}>Enregistrer le séjour</Button></div>
    </form>
  );
}
