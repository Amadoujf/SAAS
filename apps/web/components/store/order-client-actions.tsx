"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconCheck } from "@/components/yc/icons";
import { useStoreCart } from "./cart-provider";

async function post(orderId: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/storefront/orders/${orderId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Action impossible.");
  return json;
}

export function CopyValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" onClick={async () => { await navigator.clipboard?.writeText(value).catch(() => undefined); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
      className="rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ring-[var(--color-border)] hover:bg-[var(--color-surface-muted)]" aria-label={`Copier ${label}`}>
      {copied ? "Copié ✓" : "Copier"}
    </button>
  );
}

export function ProofForm({ orderId, token, rejectedNote }: { orderId: string; token: string; rejectedNote: string | null }) {
  const router = useRouter();
  const [reference, setReference] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  if (state === "done") {
    return (
      <p role="status" className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--color-success)_12%,transparent)] p-4 text-sm font-medium">
        <span className="yc-pop grid h-6 w-6 place-items-center rounded-full bg-[var(--color-success)] text-white"><IconCheck size={14} /></span>
        Merci ! La boutique vérifie votre transfert. Votre commande reste en attente jusqu&apos;à cette vérification.
      </p>
    );
  }
  return (
    <form
      className="mt-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("sending");
        setError(null);
        try {
          await post(orderId, { action: "proof", token, reference });
          setState("done");
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Envoi impossible.");
          setState("idle");
        }
      }}
    >
      {rejectedNote && <p role="alert" className="mb-3 rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] p-3 text-sm">Votre précédente preuve a été refusée : {rejectedNote}</p>}
      <label htmlFor="proof-ref" className="mb-1.5 block text-sm font-semibold">Référence de la transaction (reçue par SMS)</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input id="proof-ref" required minLength={4} maxLength={80} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ex. : 8K2H4Z9Q"
          className="h-12 flex-1 rounded-[var(--radius-md)] bg-[var(--color-background)] px-4 font-mono ring-1 ring-inset ring-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
        <button type="submit" disabled={state === "sending"} className="h-12 rounded-[var(--radius-full)] bg-[var(--color-primary)] px-6 font-semibold text-white disabled:opacity-60">
          {state === "sending" ? "Envoi…" : "J'ai payé — envoyer"}
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-[var(--color-danger)]">{error}</p>}
    </form>
  );
}

export function CustomerOrderActions({ orderId, token, canCancel }: { orderId: string; token: string; canCancel: boolean }) {
  const router = useRouter();
  const { replace, setOpen } = useStoreCart();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy !== null} onClick={async () => {
          setBusy("reorder"); setMessage(null);
          try {
            const r = await post(orderId, { action: "reorder", token });
            replace(r.cart);
            if (r.skipped > 0) setMessage(`${r.skipped} article(s) ne sont plus disponibles et n'ont pas été ajoutés.`);
            setOpen(true);
          } catch (e) { setMessage(e instanceof Error ? e.message : "Impossible."); } finally { setBusy(null); }
        }} className="rounded-[var(--radius-full)] px-5 py-3 text-sm font-semibold ring-1 ring-inset ring-[var(--color-border)] hover:bg-[var(--color-surface-muted)] disabled:opacity-50">
          {busy === "reorder" ? "Ajout…" : "Commander à nouveau"}
        </button>
        {canCancel && !confirmCancel && (
          <button type="button" onClick={() => setConfirmCancel(true)} className="rounded-[var(--radius-full)] px-5 py-3 text-sm font-semibold text-[var(--color-danger)] ring-1 ring-inset ring-[var(--color-border)]">Annuler la commande</button>
        )}
      </div>
      {confirmCancel && (
        <div role="alertdialog" aria-label="Confirmer l'annulation" className="rounded-[var(--radius-md)] bg-[var(--color-surface)] p-4 text-sm">
          <p>Annuler cette commande ? Cette action est définitive.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={busy !== null} onClick={async () => {
              setBusy("cancel");
              try { await post(orderId, { action: "cancel", token }); router.refresh(); setConfirmCancel(false); }
              catch (e) { setMessage(e instanceof Error ? e.message : "Impossible."); } finally { setBusy(null); }
            }} className="rounded-full bg-[var(--color-danger)] px-4 py-2 font-semibold text-white">{busy === "cancel" ? "Annulation…" : "Oui, annuler"}</button>
            <button type="button" onClick={() => setConfirmCancel(false)} className="rounded-full px-4 py-2 font-semibold ring-1 ring-inset ring-[var(--color-border)]">Non</button>
          </div>
        </div>
      )}
      {message && <p role="status" className="text-sm text-[var(--color-text-muted)]">{message}</p>}
    </div>
  );
}
