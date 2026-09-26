"use client";

import { useState } from "react";
import { Button } from "@/components/yc/button";
import { IconCheck, IconX } from "@/components/yc/icons";
import { Textarea, Select } from "@/components/yc/field";
import { Dialog } from "./dialog";
import { useOrderAction } from "./use-order-action";

type Status = string;

const NEXT_STEP: Record<string, { to: string; label: string } | ((pickup: boolean) => { to: string; label: string })> = {
  CONFIRMED: { to: "PREPARING", label: "Commencer la préparation" },
  PREPARING: { to: "READY", label: "Marquer comme prête" },
  READY: (pickup) => (pickup ? { to: "DELIVERED", label: "Remise au client" } : { to: "SHIPPED", label: "Expédier" }),
  SHIPPED: { to: "OUT_FOR_DELIVERY", label: "Le livreur est en route" },
  OUT_FOR_DELIVERY: { to: "DELIVERED", label: "Confirmer la livraison" },
};

function Feedback({ error, success, onDark = false }: { error: string | null; success: string | null; onDark?: boolean }) {
  if (error) return <p role="alert" className={`mt-3 rounded-xl px-3 py-2 text-sm font-medium ${onDark ? "bg-rose-500/15 text-rose-100" : "bg-yc-danger/[0.07] text-[rgb(185_28_28)]"}`}>{error}</p>;
  if (success)
    return (
      <p role="status" className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${onDark ? "bg-emerald-400/15 text-emerald-100" : "bg-yc-success/10 text-[rgb(4_120_87)]"}`}>
        <span className="yc-pop grid h-5 w-5 place-items-center rounded-full bg-yc-success text-white"><IconCheck size={13} /></span>
        {success}
      </p>
    );
  return null;
}

export function StatusActions({ orderId, status, pickup, canCancel, canRefund, onDark = false }: { orderId: string; status: Status; pickup: boolean; canCancel: boolean; canRefund: boolean; onDark?: boolean }) {
  const { run, pending, error, success } = useOrderAction(orderId);
  const [dialog, setDialog] = useState<null | "CANCELED" | "REFUNDED">(null);
  const [reason, setReason] = useState("");
  const rule = NEXT_STEP[status];
  const next = typeof rule === "function" ? rule(pickup) : rule;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {next && (
          <Button variant={onDark ? "glow" : "primary"} size="lg" loading={pending === "next"} onClick={() => run("next", { action: "status", toStatus: next.to }, "Statut mis à jour.")}>
            {next.label}
          </Button>
        )}
        {canRefund && (
          <Button variant={onDark ? "inverse" : "secondary"} size="lg" onClick={() => setDialog("REFUNDED")}>Rembourser</Button>
        )}
        {canCancel && (
          <Button variant={onDark ? "inverse" : "danger"} size="lg" onClick={() => setDialog("CANCELED")}>Annuler</Button>
        )}
      </div>
      <Feedback error={error} success={success} onDark={onDark} />
      <Dialog open={dialog !== null} onClose={() => setDialog(null)} title={dialog === "CANCELED" ? "Annuler la commande ?" : "Enregistrer un remboursement ?"}>
        <p className="text-sm text-yc-ink-soft">
          {dialog === "CANCELED"
            ? "Le stock réservé sera libéré (ou réapprovisionné). Le client sera prévenu. Cette action est définitive."
            : "Le remboursement lui-même (Wave, Orange Money, espèces) se fait hors de YamaCommerce : cette action l'enregistre comme demandé."}
        </p>
        <label className="mt-4 block text-[13px] font-semibold" htmlFor="yc-reason">Motif (visible dans l&apos;historique)</label>
        <Textarea id="yc-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1.5" maxLength={500} />
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDialog(null)}>Retour</Button>
          <Button
            variant={dialog === "CANCELED" ? "danger" : "primary"}
            loading={pending === "terminal"}
            onClick={async () => {
              const ok = await run("terminal", { action: "status", toStatus: dialog, note: reason || null }, dialog === "CANCELED" ? "Commande annulée." : "Remboursement enregistré.");
              if (ok) setDialog(null);
            }}
          >
            Confirmer
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

export function ManualPaymentReview({ orderId }: { orderId: string }) {
  const { run, pending, error, success } = useOrderAction(orderId);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" loading={pending === "approve"} onClick={() => run("approve", { action: "payment", decision: "approve" }, "Paiement validé : commande confirmée, stock engagé.")}>
          <IconCheck size={18} /> Valider le paiement
        </Button>
        <Button variant="danger" onClick={() => setRejecting(true)}>
          <IconX size={18} /> Refuser
        </Button>
      </div>
      <Feedback error={error} success={success} />
      <Dialog open={rejecting} onClose={() => setRejecting(false)} title="Refuser cette preuve ?">
        <p className="text-sm text-yc-ink-soft">Le client verra le motif et pourra déposer une nouvelle preuve. La réservation du stock reprend son échéance.</p>
        <label className="mt-4 block text-[13px] font-semibold" htmlFor="yc-reject">Motif pour le client</label>
        <Textarea id="yc-reject" value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1.5" placeholder="Ex. : montant reçu incomplet (20 000 au lieu de 25 000 FCFA)" />
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setRejecting(false)}>Retour</Button>
          <Button
            variant="danger"
            loading={pending === "reject"}
            disabled={reason.trim().length < 3}
            onClick={async () => {
              const ok = await run("reject", { action: "payment", decision: "reject", note: reason }, "Preuve refusée, client prévenu.");
              if (ok) setRejecting(false);
            }}
          >
            Refuser la preuve
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

export function DelivererPicker({ orderId, current, deliverers }: { orderId: string; current: string | null; deliverers: { id: string; label: string }[] }) {
  const { run, pending, error, success } = useOrderAction(orderId);
  return (
    <div>
      <label htmlFor="yc-deliverer" className="text-[13px] font-semibold">Livreur</label>
      <div className="mt-1.5 flex gap-2">
        <Select
          id="yc-deliverer"
          defaultValue={current ?? ""}
          disabled={pending !== null}
          onChange={(e) => run("deliverer", { action: "deliverer", delivererId: e.target.value || null }, "Livreur affecté.")}
        >
          <option value="">Non affecté</option>
          {deliverers.map((d) => (
            <option key={d.id} value={d.id}>{d.label}</option>
          ))}
        </Select>
      </div>
      <Feedback error={error} success={success} />
    </div>
  );
}

export function InternalNotes({ orderId, initial }: { orderId: string; initial: string }) {
  const { run, pending, error, success } = useOrderAction(orderId);
  const [value, setValue] = useState(initial);
  return (
    <div>
      <label htmlFor="yc-notes" className="sr-only">Notes internes</label>
      <Textarea id="yc-notes" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Visible uniquement par votre équipe…" maxLength={4000} />
      <div className="mt-2 flex justify-end">
        <Button variant="secondary" size="sm" loading={pending === "notes"} disabled={value === initial} onClick={() => run("notes", { action: "notes", notes: value }, "Note enregistrée.")}>
          Enregistrer
        </Button>
      </div>
      <Feedback error={error} success={success} />
    </div>
  );
}

export function InvoiceButton({ orderId }: { orderId: string }) {
  const { run, pending, error, success } = useOrderAction(orderId);
  return (
    <div>
      <Button variant="secondary" size="sm" loading={pending === "invoice"} onClick={() => run("invoice", { action: "invoice" }, "Facture émise.")}>
        Émettre la facture
      </Button>
      <Feedback error={error} success={success} />
    </div>
  );
}
