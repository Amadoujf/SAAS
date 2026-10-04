"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Le client annule SON essai (jeton), avant l'heure prévue : le créneau se libère. */
export function CancelTestDrive({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          if (!window.confirm("Annuler cet essai ? Le créneau sera libéré.")) return;
          setPending(true);
          setError(null);
          const res = await fetch("/api/storefront/auto/test-drive-cancel", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          setPending(false);
          if (!res.ok) return setError(json.error ?? "Annulation impossible.");
          router.refresh();
        }}
        className="inline-flex h-12 items-center px-6 text-[14px] font-bold text-[var(--color-danger)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] disabled:opacity-60"
      >
        {pending ? "Annulation…" : "Annuler l'essai"}
      </button>
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
