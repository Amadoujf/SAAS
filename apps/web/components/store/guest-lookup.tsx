"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function GuestLookup() {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = "h-12 w-full rounded-[var(--radius-md)] bg-[var(--color-background)] px-4 ring-1 ring-inset ring-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]";
  return (
    <form
      className="mt-8 grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const res = await fetch("/api/storefront/orders/lookup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderNumber, phone }) });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.url) router.push(json.url);
        else { setError(json.error ?? "Recherche impossible."); setBusy(false); }
      }}
    >
      <div><label htmlFor="g-number" className="mb-1.5 block text-sm font-semibold">Numéro de commande</label><input id="g-number" required className={`${input} font-mono uppercase`} placeholder="CMD-2026-000123" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} /></div>
      <div><label htmlFor="g-phone" className="mb-1.5 block text-sm font-semibold">Téléphone utilisé pour la commande</label><input id="g-phone" required type="tel" inputMode="tel" className={input} placeholder="77 123 45 67" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      {error && <p role="alert" className="text-sm text-[var(--color-danger)]">{error}</p>}
      <button type="submit" disabled={busy} className="h-12 rounded-[var(--radius-full)] bg-[var(--color-primary)] font-semibold text-white disabled:opacity-60">{busy ? "Recherche…" : "Retrouver ma commande"}</button>
    </form>
  );
}
