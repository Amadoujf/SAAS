"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/yc/button";
import { Field, Input } from "@/components/yc/field";
import { IconPlus } from "@/components/yc/icons";
import { postTravel, section } from "./trip-editor";

/** Réservation prise par téléphone ou à l'agence : mêmes règles que le site (places
 *  atomiques, prix du départ, voyageurs nominatifs). */
export function PhoneBookingForm({ listingId, departureId, left }: { listingId: string; departureId: string; left: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [travelers, setTravelers] = useState([{ firstName: "", lastName: "" }]);
  const [contact, setContact] = useState({ phone: "", email: "", note: "" });
  if (left <= 0) return null;
  if (!open) return <Button variant="secondary" size="sm" onClick={() => setOpen(true)}><IconPlus size={15} /> Réservation par téléphone</Button>;
  return (
    <form
      className={`${section} grid gap-3`}
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          try {
            const r = await postTravel<{ id: string }>({ action: "phone_booking", booking: { listingId, departureId, travelers, phone: contact.phone, email: contact.email, note: contact.note || null } });
            router.push(`/dashboard/reservations/${r.id}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Réservation impossible.");
          }
        });
      }}
    >
      <h2 className="text-[16px] font-bold">Nouvelle réservation (téléphone, agence)</h2>
      {travelers.map((t, i) => (
        <div key={i} className="grid grid-cols-2 gap-3">
          <Field label={`Prénom — voyageur ${i + 1}`}>{(p) => <Input {...p} required value={t.firstName} onChange={(e) => setTravelers(travelers.map((x, k) => (k === i ? { ...x, firstName: e.target.value } : x)))} />}</Field>
          <Field label={`Nom — voyageur ${i + 1}`}>{(p) => <Input {...p} required value={t.lastName} onChange={(e) => setTravelers(travelers.map((x, k) => (k === i ? { ...x, lastName: e.target.value } : x)))} />}</Field>
        </div>
      ))}
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="ghost" disabled={travelers.length >= Math.min(20, left)} onClick={() => setTravelers([...travelers, { firstName: "", lastName: "" }])}>+ Voyageur</Button>
        {travelers.length > 1 && <Button type="button" size="sm" variant="ghost" onClick={() => setTravelers(travelers.slice(0, -1))}>− Voyageur</Button>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Téléphone du contact">{(p) => <Input {...p} type="tel" required value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />}</Field>
        <Field label="E-mail" optional>{(p) => <Input {...p} type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />}</Field>
      </div>
      <Field label="Note" optional>{(p) => <Input {...p} maxLength={600} value={contact.note} onChange={(e) => setContact({ ...contact, note: e.target.value })} />}</Field>
      {error && <p role="alert" className="text-sm font-medium text-yc-danger">{error}</p>}
      <div className="flex gap-2"><Button type="submit" variant="royal" size="sm" loading={pending}>Réserver {travelers.length} place{travelers.length > 1 ? "s" : ""}</Button><Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Annuler</Button></div>
    </form>
  );
}
