"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CancelStayButton({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          if (!window.confirm("Annuler ce séjour ? La chambre sera libérée.")) return;
          setPending(true);
          setError(null);
          const res = await fetch("/api/storefront/hotel/cancel", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          setPending(false);
          if (!res.ok) return setError(json.error ?? "Annulation impossible.");
          router.refresh();
        }}
        className="inline-flex h-12 items-center rounded-[var(--radius-md)] px-6 text-[14px] font-semibold text-[var(--color-danger)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] disabled:opacity-60"
      >
        {pending ? "Annulation…" : "Annuler le séjour"}
      </button>
      {error && <p role="alert" className="mt-3 text-sm font-medium text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
