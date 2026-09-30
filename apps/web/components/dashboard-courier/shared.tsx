"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export const section = "rounded-xl bg-white p-5 shadow-[0_1px_2px_rgb(12_22_48/0.04),0_8px_24px_-16px_rgb(12_22_48/0.12)] ring-1 ring-yc-ink/[0.07] sm:p-6";
export const input = "mt-1.5 h-11 w-full min-w-0 rounded-lg bg-white px-3 text-sm font-normal ring-1 ring-inset ring-yc-ink/12 focus:outline-none focus:ring-2 focus:ring-yc-electric";
export const label = "grid min-w-0 text-[13px] font-semibold";

export async function postCourier<T = unknown>(body: unknown): Promise<T> {
  const res = await fetch("/api/dashboard/courier", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as { data?: T; error?: string };
  if (!res.ok) throw new Error(json.error ?? "Action impossible.");
  return json.data as T;
}

/** Action du bureau : message de succès réel (reçu compris), erreur du serveur telle quelle. */
export function useCourierAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const run = (body: unknown, success: string, after?: (data: unknown) => void) => {
    setError(null);
    setNotice(null);
    start(async () => {
      try {
        const data = (await postCourier<{ receiptNumber?: string } | null>(body)) ?? null;
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

/** Montant saisi « 150 000 » → entier, ou null. */
export const parseAmount = (v: string) => {
  const n = Number(v.replace(/[\s .]/g, ""));
  return Number.isInteger(n) && n >= 0 && v.trim() !== "" ? n : null;
};

/** « 08:30 » ⇄ minutes. */
export const toMinutes = (hhmm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
export const toHHMM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
