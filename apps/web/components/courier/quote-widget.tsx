"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SIZE_LABELS, formatXof } from "@/lib/courier/labels";

type Zone = { id: string; label: string; fee: number };

/** Estimation instantanée : le tarif est calculé par le serveur (zone + format). */
export function QuoteWidget({ zones }: { zones: Zone[] }) {
  const [zoneId, setZoneId] = useState(zones[0]?.id ?? "");
  const [size, setSize] = useState<"small" | "medium" | "large">("small");
  const [fee, setFee] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!zoneId) return;
    let alive = true;
    setError(null);
    fetch("/api/storefront/courier/quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ zoneId, size }) })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as { data?: { fee: number }; error?: string };
        if (!alive) return;
        if (r.ok && j.data) setFee(j.data.fee);
        else setError(j.error ?? "Estimation indisponible.");
      })
      .catch(() => alive && setError("Estimation indisponible."));
    return () => {
      alive = false;
    };
  }, [zoneId, size]);
  if (!zones.length) return <p className="text-[15px] text-white/70">Nos tarifs sont communiqués par téléphone.</p>;
  return (
    <div className="rounded-[var(--radius-lg)] bg-white p-5 text-[var(--color-text-primary)] shadow-[var(--shadow-lg)] sm:p-6">
      <p className="font-[family-name:var(--font-heading)] text-[22px] leading-tight">Combien coûte ma course ?</p>
      <label className="mt-4 block text-[13px] font-semibold">Livrer à
        <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className="mt-1.5 h-12 w-full rounded-[var(--radius-md)] bg-[var(--color-background)] px-3 text-[15px] ring-1 ring-inset ring-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
          {zones.map((z) => <option key={z.id} value={z.id}>{z.label}</option>)}
        </select>
      </label>
      <fieldset className="mt-4">
        <legend className="text-[13px] font-semibold">Format du colis</legend>
        <div role="radiogroup" className="mt-1.5 grid grid-cols-3 gap-2">
          {(["small", "medium", "large"] as const).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={size === k} onClick={() => setSize(k)} className={`rounded-[var(--radius-md)] px-2 py-2.5 text-center ring-1 ring-inset ${size === k ? "bg-[var(--color-primary)] text-white ring-[var(--color-primary)]" : "bg-[var(--color-background)] ring-[var(--color-border)]"}`}>
              <span className="block text-[14px] font-bold">{SIZE_LABELS[k]!.label}</span>
              <span className={`block text-[11px] leading-tight ${size === k ? "text-white/70" : "text-[var(--color-text-muted)]"}`}>{SIZE_LABELS[k]!.hint}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <div className="mt-5 flex items-end justify-between gap-3 border-t border-dashed border-[var(--color-border)] pt-4">
        <p aria-live="polite">
          <span className="block text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">Tarif</span>
          <span className="yc-num font-[family-name:var(--font-heading)] text-[32px] leading-none">{error ? "—" : fee == null ? "…" : formatXof(fee)}</span>
        </p>
        <Link href={`/envoyer?zone=${zoneId}&format=${size}`} className="inline-flex h-12 items-center rounded-full bg-[var(--color-accent-primary)] px-5 text-[15px] font-bold text-[var(--color-primary)]">Envoyer</Link>
      </div>
      {error && <p role="alert" className="mt-2 text-[13px] text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
