"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Rafraîchit le suivi tant que la commande est en cours (la cuisine avance les étapes). */
export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => window.clearInterval(t);
  }, [router, seconds]);
  return null;
}

/** Annulation par le client lui-même (commande non acceptée, ou réservation à venir). */
export function GuestCancelButton({ token, kind }: { token: string; kind: "order" | "booking" }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = kind === "order" ? "Annuler la commande" : "Annuler la réservation";
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          if (!window.confirm(kind === "order" ? "Annuler cette commande ?" : "Annuler cette réservation ? La table sera libérée.")) return;
          setPending(true);
          setError(null);
          const res = await fetch(`/api/storefront/restaurant/${kind === "order" ? "order-cancel" : "booking-cancel"}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          setPending(false);
          if (!res.ok) return setError(json.error ?? "Annulation impossible.");
          router.refresh();
        }}
        className="inline-flex h-12 items-center rounded-full px-6 text-[14px] font-bold text-[var(--color-danger)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] disabled:opacity-60"
      >
        {pending ? "Annulation…" : label}
      </button>
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
