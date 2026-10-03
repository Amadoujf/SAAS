"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

export const section = "rounded-xl bg-white p-5 shadow-[0_1px_2px_rgb(12_22_48/0.04),0_8px_24px_-16px_rgb(12_22_48/0.12)] ring-1 ring-yc-ink/[0.07] sm:p-6";

export async function postResto<T = unknown>(body: unknown): Promise<T> {
  const res = await fetch("/api/dashboard/restaurant", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as { data?: T; error?: string };
  if (!res.ok) throw new Error(json.error ?? "Action impossible.");
  return json.data as T;
}

export function useRestoAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const run = (body: unknown, success: string, after?: (data: unknown) => void) => {
    setError(null);
    setNotice(null);
    start(async () => {
      try {
        const data = (await postResto<{ receiptNumber?: string } | null>(body)) ?? null;
        setNotice(data && typeof data === "object" && "receiptNumber" in data && data.receiptNumber ? `${success} Reçu ${data.receiptNumber}.` : success);
        after?.(data);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action impossible.");
      }
    });
  };
  return { pending, error, notice, run };
}

export const Feedback = ({ error, notice }: { error: string | null; notice: string | null }) =>
  error ? <p role="alert" className="mt-3 text-sm font-medium text-yc-danger">{error}</p> : notice ? <p role="status" className="mt-3 text-sm font-medium text-[rgb(4_120_87)]">{notice}</p> : null;

/** Rafraîchit la page à intervalle (écran cuisine, salle) tant qu'elle est visible. */
export function LiveRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  const [at, setAt] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh();
        setAt(new Date());
      }
    }, seconds * 1000);
    return () => window.clearInterval(t);
  }, [router, seconds]);
  return <span suppressHydrationWarning className="text-xs text-yc-ink-soft">Mise à jour automatique · {at.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Dakar" })}</span>;
}

/** Minutes écoulées depuis un instant, mises à jour chaque minute. */
export function Elapsed({ since, warnAfter = 20 }: { since: string; warnAfter?: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  const min = Math.max(0, Math.floor((now - new Date(since).getTime()) / 60_000));
  return <span suppressHydrationWarning className={`yc-num font-bold ${min >= warnAfter ? "text-[#C2410C]" : "text-yc-ink-soft"}`}>{min < 1 ? "à l'instant" : `${min} min`}</span>;
}
