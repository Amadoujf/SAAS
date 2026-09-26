"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** Appel d'une action serveur sur une commande + rafraîchissement des données
 *  serveur. L'état « en cours » bloque le double clic ; l'erreur est lisible. */
export function useOrderAction(orderId: string) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function run(
    key: string,
    body: Record<string, unknown>,
    successMessage: string | ((data: unknown) => { success: string } | { warning: string }),
  ) {
    setPending(key);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/dashboard/orders/${orderId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await response.json().catch(() => ({}))) as { error?: string; data?: unknown };
      if (!response.ok) {
        setError(json.error ?? "L'action a échoué.");
        return false;
      }
      // Le message dépend du RÉSULTAT réel renvoyé par le serveur (ex. un paiement
      // mis en rapprochement n'est jamais annoncé comme « validé »).
      const message = typeof successMessage === "string" ? { success: successMessage } : successMessage(json.data);
      if ("warning" in message) setError(message.warning);
      else setSuccess(message.success);
      startTransition(() => router.refresh());
      return true;
    } catch {
      setError("Connexion interrompue — vérifiez votre réseau puis réessayez.");
      return false;
    } finally {
      setPending(null);
    }
  }

  return { run, pending, error, success, setError };
}
