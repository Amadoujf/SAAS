"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CancelBookingButton({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          if (!window.confirm("Annuler votre réservation ? Les places seront libérées.")) return;
          setPending(true);
          setError(null);
          const res = await fetch("/api/storefront/travel-booking/cancel", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          setPending(false);
          if (!res.ok) return setError(json.error ?? "Annulation impossible.");
          router.refresh();
        }}
        className="h-11 rounded-[var(--radius-full)] px-5 text-sm font-semibold text-[var(--color-danger)] ring-1 ring-inset ring-[var(--color-border)] hover:bg-[var(--color-surface)] disabled:opacity-60"
      >
        {pending ? "Annulation…" : "Annuler ma réservation"}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
