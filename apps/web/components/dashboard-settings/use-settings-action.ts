"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function useSettingsAction() {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  async function run(key: string, body: Record<string, unknown>, message: string) {
    setPending(key);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/dashboard/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Enregistrement impossible.");
        return false;
      }
      setSuccess(message);
      startTransition(() => router.refresh());
      return true;
    } catch {
      setError("Connexion interrompue — réessayez.");
      return false;
    } finally {
      setPending(null);
    }
  }
  return { run, pending, error, success };
}
