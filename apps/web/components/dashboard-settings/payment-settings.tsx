"use client";

import { useState } from "react";
import { Button } from "@/components/yc/button";
import { Field, Input, Textarea } from "@/components/yc/field";
import { Feedback } from "./feedback";
import { Toggle } from "./toggle";
import { useSettingsAction } from "./use-settings-action";

export interface ManualMethodView {
  provider: "wave_direct" | "orange_money_direct";
  isEnabled: boolean;
  accountNumber: string | null;
  accountHolderName: string | null;
  publicInstructions: string | null;
}

const BRAND = {
  wave_direct: { name: "Wave", color: "from-[#1dc4ff] to-[#1a8cff]", initial: "W" },
  orange_money_direct: { name: "Orange Money", color: "from-[#ff8a00] to-[#ff5c00]", initial: "OM" },
};

export function ManualMethodCard({ method }: { method: ManualMethodView }) {
  const brand = BRAND[method.provider];
  const [state, setState] = useState({
    isEnabled: method.isEnabled,
    accountNumber: method.accountNumber ?? "",
    accountHolderName: method.accountHolderName ?? "",
    publicInstructions: method.publicInstructions ?? "",
  });
  const { run, pending, error, success } = useSettingsAction();
  return (
    <form
      className="flex flex-col gap-4 p-5 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        run("save", { action: "payment.save", provider: method.provider, ...state, accountNumber: state.accountNumber || null, accountHolderName: state.accountHolderName || null, publicInstructions: state.publicInstructions || null }, `${brand.name} enregistré.`);
      }}
    >
      <div className="flex items-center gap-3">
        <span className={`grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br ${brand.color} text-sm font-bold text-white shadow-yc`}>{brand.initial}</span>
        <div className="flex-1">
          <p className="font-display text-lg font-semibold">{brand.name}</p>
          <p className="text-xs text-yc-ink-soft">Transfert manuel vers votre numéro, preuve vérifiée par vous.</p>
        </div>
      </div>
      <Toggle checked={state.isEnabled} onChange={(v) => setState({ ...state, isEnabled: v })} label={`Accepter ${brand.name}`} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Numéro marchand">{(p) => <Input {...p} inputMode="tel" value={state.accountNumber} onChange={(e) => setState({ ...state, accountNumber: e.target.value })} placeholder="77 123 45 67" />}</Field>
        <Field label="Nom du titulaire" optional>{(p) => <Input {...p} value={state.accountHolderName} onChange={(e) => setState({ ...state, accountHolderName: e.target.value })} />}</Field>
      </div>
      <Field label="Instructions affichées au client" optional>{(p) => <Textarea {...p} value={state.publicInstructions} onChange={(e) => setState({ ...state, publicInstructions: e.target.value })} placeholder="Envoyez le montant exact puis indiquez la référence reçue par SMS." />}</Field>
      <div className="flex items-center gap-3">
        <Feedback error={error} success={success} />
        <Button type="submit" loading={pending === "save"} className="ml-auto">Enregistrer</Button>
      </div>
    </form>
  );
}

export function CodCard({ enabled }: { enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const { run, pending, error, success } = useSettingsAction();
  return (
    <div className="p-5 sm:p-6">
      <Toggle
        checked={on}
        disabled={pending !== null}
        onChange={async (v) => {
          setOn(v);
          const ok = await run("cod", { action: "payment.save", provider: "cod", isEnabled: v }, v ? "Paiement à la livraison activé." : "Paiement à la livraison désactivé.");
          if (!ok) setOn(!v);
        }}
        label="Paiement à la livraison"
        description="Le client paie en espèces ou par mobile money à la remise du colis. La commande est confirmée directement."
      />
      <Feedback error={error} success={success} />
    </div>
  );
}
