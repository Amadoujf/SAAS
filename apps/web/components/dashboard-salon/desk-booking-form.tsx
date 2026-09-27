"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/yc/button";
import { Field, Input, Select } from "@/components/yc/field";
import { postSalon, section } from "./shared";
import { SlotGrid, useDeskSlots } from "./appointment-panels";

export interface DeskService {
  id: string;
  title: string;
  category: string;
  durationMinutes: number;
  staffIds: string[];
}

/** Rendez-vous pris au téléphone ou au comptoir : mêmes vérifications que le site
 *  (horaires de travail, absences, chevauchements), sans le délai ni le pas imposés en ligne. */
export function DeskBookingForm({ services, staff, today, initialDate, initialStaff }: { services: DeskService[]; staff: { id: string; name: string }[]; today: string; initialDate: string; initialStaff: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [listingId, setListingId] = useState<string>(initialStaff ? services.find((s) => s.staffIds.includes(initialStaff))?.id ?? "" : "");
  const [staffId, setStaffId] = useState<string>(initialStaff ?? "");
  const [date, setDate] = useState(initialDate);
  const [slot, setSlot] = useState<string | null>(null);
  const [client, setClient] = useState({ firstName: "", lastName: "", phone: "", note: "", channel: "phone" as "phone" | "dashboard" | "whatsapp" });
  const service = services.find((s) => s.id === listingId) ?? null;
  const eligible = useMemo(() => (service ? staff.filter((s) => service.staffIds.includes(s.id)) : staff), [service, staff]);
  const { slots, error: slotError } = useDeskSlots(listingId || null, date, staffId || null);
  const chosen = slots?.find((s) => s.startAt === slot);
  const assigned = chosen && !staffId ? staff.find((s) => s.id === chosen.staffIds[0])?.name : null;
  const categories = [...new Set(services.map((s) => s.category))];

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!slot) return setError("Choisissez un horaire.");
        setError(null);
        start(async () => {
          try {
            const r = await postSalon<{ id: string }>({ action: "book", booking: { listingId, staffId: staffId || null, startAt: slot, firstName: client.firstName, lastName: client.lastName || null, phone: client.phone, note: client.note || null, channel: client.channel } });
            router.push(`/dashboard/rendez-vous/${r.id}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Rendez-vous impossible.");
            setSlot(null);
          }
        });
      }}
    >
      <section className={section}>
        <h2 className="text-[18px] font-bold tracking-[-0.015em]">Prestation et horaire</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Prestation">
            {(p) => (
              <Select {...p} required value={listingId} onChange={(e) => { setListingId(e.target.value); setSlot(null); const s = services.find((x) => x.id === e.target.value); if (s && staffId && !s.staffIds.includes(staffId)) setStaffId(""); }}>
                <option value="">Choisir…</option>
                {categories.map((c) => <optgroup key={c} label={c}>{services.filter((s) => s.category === c).map((s) => <option key={s.id} value={s.id}>{s.title} ({s.durationMinutes} min)</option>)}</optgroup>)}
              </Select>
            )}
          </Field>
          <Field label="Avec">
            {(p) => (
              <Select {...p} value={staffId} onChange={(e) => { setStaffId(e.target.value); setSlot(null); }}>
                <option value="">Sans préférence</option>
                {eligible.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Jour">{(p) => <Input {...p} type="date" min={today} required value={date} onChange={(e) => { setDate(e.target.value); setSlot(null); }} />}</Field>
        </div>
        <div className="mt-5">
          {listingId ? <SlotGrid slots={slots} value={slot} onChange={setSlot} error={slotError} /> : <p className="text-sm text-yc-ink-soft">Choisissez une prestation pour voir les horaires libres.</p>}
          {assigned && <p className="mt-3 text-sm text-yc-ink-soft">Rendez-vous confié à <strong className="text-yc-ink">{assigned}</strong> (personne libre la moins chargée ce jour-là).</p>}
        </div>
      </section>
      <section className={section}>
        <h2 className="text-[18px] font-bold tracking-[-0.015em]">Client</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Prénom">{(p) => <Input {...p} required maxLength={80} value={client.firstName} onChange={(e) => setClient({ ...client, firstName: e.target.value })} />}</Field>
          <Field label="Nom" optional>{(p) => <Input {...p} maxLength={80} value={client.lastName} onChange={(e) => setClient({ ...client, lastName: e.target.value })} />}</Field>
          <Field label="Téléphone" hint="Un client déjà connu est retrouvé par son numéro.">{(p) => <Input {...p} type="tel" required maxLength={20} value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} />}</Field>
          <Field label="Pris par">
            {(p) => (
              <Select {...p} value={client.channel} onChange={(e) => setClient({ ...client, channel: e.target.value as typeof client.channel })}>
                <option value="phone">Téléphone</option>
                <option value="dashboard">Au comptoir</option>
                <option value="whatsapp">WhatsApp</option>
              </Select>
            )}
          </Field>
          <div className="sm:col-span-2"><Field label="Note" optional>{(p) => <Input {...p} maxLength={500} value={client.note} onChange={(e) => setClient({ ...client, note: e.target.value })} />}</Field></div>
        </div>
      </section>
      {error && <p role="alert" className="text-sm font-medium text-yc-danger">{error}</p>}
      <div><Button type="submit" variant="royal" loading={pending} disabled={!slot}>Enregistrer le rendez-vous</Button></div>
    </form>
  );
}
