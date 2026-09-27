"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SlotPicker, type Slot } from "./slot-picker";

/** Déplacer (horaire proposé, même personne) ou annuler SON rendez-vous, dans le délai du salon. */
export function AppointmentActions({ token, service, staffId, today, canChange, cutoffHours, phone }: { token: string; service: string; staffId: string; today: string; canChange: boolean; cutoffHours: number; phone: string | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "move">("idle");
  const [slot, setSlot] = useState<Slot | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const call = async (path: string, body: object, done: string) => {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Action impossible.");
      setNotice(done);
      setMode("idle");
      setSlot(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action impossible.");
    } finally {
      setPending(false);
    }
  };

  if (!canChange) {
    return <p className="text-[14px] text-[var(--color-text-secondary)]">Pour modifier ce rendez-vous{cutoffHours > 0 ? ` (moins de ${cutoffHours} h avant)` : ""}, appelez le salon{phone ? ` au ${phone}` : ""}.</p>;
  }

  return (
    <div>
      {notice && <p role="status" className="mb-4 rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--color-success)_10%,white)] px-4 py-3 text-sm font-medium text-[var(--color-success)]">{notice}</p>}
      {mode === "idle" ? (
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => { setMode("move"); setNotice(null); }} className="inline-flex h-12 items-center rounded-[var(--radius-full)] bg-[var(--color-primary)] px-6 text-[14px] font-semibold text-white">Changer d&apos;horaire</button>
          <button
            type="button"
            disabled={pending}
            onClick={() => { if (window.confirm("Annuler ce rendez-vous ? L'horaire sera libéré pour d'autres clients.")) void call("/api/storefront/salon/cancel", { token }, "Rendez-vous annulé."); }}
            className="inline-flex h-12 items-center rounded-[var(--radius-full)] px-6 text-[14px] font-semibold text-[var(--color-danger)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] disabled:opacity-60"
          >
            Annuler le rendez-vous
          </button>
        </div>
      ) : (
        <div className="rounded-[var(--radius-lg)] bg-white p-5 ring-1 ring-[var(--color-border)] sm:p-6">
          <p className="mb-4 text-[15px] font-semibold">Choisissez un nouvel horaire</p>
          <SlotPicker service={service} staffId={staffId} today={today} value={slot} onChange={setSlot} />
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" disabled={!slot || pending} onClick={() => slot && void call("/api/storefront/salon/reschedule", { token, startAt: slot.startAt }, "Rendez-vous déplacé.")} className="inline-flex h-12 items-center rounded-[var(--radius-full)] bg-[var(--color-accent-primary)] px-6 text-[14px] font-semibold text-white disabled:opacity-50">
              {pending ? "Enregistrement…" : "Valider ce nouvel horaire"}
            </button>
            <button type="button" onClick={() => { setMode("idle"); setSlot(null); }} className="inline-flex h-12 items-center rounded-[var(--radius-full)] px-5 text-[14px] font-semibold">Garder mon horaire</button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="mt-4 rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--color-danger)_8%,white)] px-4 py-3 text-sm font-medium text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
