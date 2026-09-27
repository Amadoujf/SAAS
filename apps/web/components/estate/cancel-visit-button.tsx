"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CancelVisitButton({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          if (!window.confirm("Annuler votre demande de visite ?")) return;
          setPending(true);
          setError(null);
          const res = await fetch("/api/storefront/visit/cancel", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          setPending(false);
          if (!res.ok) return setError(json.error ?? "Annulation impossible.");
          router.refresh();
        }}
        className="h-11 rounded-[var(--radius-md)] px-5 text-sm font-semibold text-[var(--color-danger)] ring-1 ring-inset ring-[var(--color-border)] hover:bg-[var(--color-surface)] disabled:opacity-60"
      >
        {pending ? "Annulation…" : "Annuler ma demande"}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
