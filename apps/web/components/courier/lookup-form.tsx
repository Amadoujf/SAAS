"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Retrouver un suivi : référence + téléphone de l'expéditeur ou du destinataire. */
export function LookupForm() {
  const router = useRouter();
  const [f, setF] = useState({ reference: "", phone: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = "mt-1.5 h-13 min-h-[52px] w-full rounded-[var(--radius-md)] bg-white px-3.5 text-[16px] ring-1 ring-inset ring-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]";
  return (
    <form className="grid gap-4" onSubmit={async (e) => {
      e.preventDefault();
      setPending(true);
      setError(null);
      const res = await fetch("/api/storefront/courier/lookup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) });
      const j = (await res.json().catch(() => ({}))) as { data?: { token: string }; error?: string };
      if (!res.ok || !j.data) {
        setPending(false);
        return setError(j.error ?? "Recherche impossible.");
      }
      router.push(`/colis/${j.data.token}`);
    }}>
      <label className="block text-[14px] font-semibold">Référence de la course<input required maxLength={20} value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} placeholder="LIV-2026-000123" className={`yc-num uppercase ${field}`} /></label>
      <label className="block text-[14px] font-semibold">Votre téléphone<input required type="tel" inputMode="tel" maxLength={20} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="77 123 45 67" className={field} /></label>
      {error && <p role="alert" className="text-[15px] font-semibold text-[var(--color-danger)]">{error}</p>}
      <button type="submit" disabled={pending} className="flex min-h-[52px] items-center justify-center rounded-full bg-[var(--color-primary)] text-[15.5px] font-bold text-white disabled:opacity-60">{pending ? "Recherche…" : "Voir le suivi"}</button>
    </form>
  );
}
