"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/yc/button";
import { MediaPickerDialog } from "@/components/media/media-picker-dialog";
import { ColorField, ImageField } from "./site-editor";

/** Identité du site (logo, couleurs) pour les secteurs sans « accueil standard » à
 *  régler : appliquée à l'en-tête, aux pages et à la page composée dans l'éditeur. */
export function IdentityForm({ initial }: { initial: { logoUrl: string | null; primaryColor: string | null; accentColor: string | null } }) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/dashboard/site/identity", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(state) });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (res.ok) {
      setMessage({ ok: true, text: "Enregistré : votre site est à jour." });
      router.refresh();
    } else setMessage({ ok: false, text: json.error ?? "Enregistrement impossible." });
  }

  return (
    <section aria-labelledby="identite" className="rounded-xl bg-white p-5 shadow-[0_1px_2px_rgb(12_22_48/0.04),0_8px_24px_-16px_rgb(12_22_48/0.12)] ring-1 ring-yc-ink/[0.07] sm:p-6">
      <h2 id="identite" className="text-base font-semibold text-yc-ink">Identité</h2>
      <p className="mt-1 text-sm text-yc-ink-soft">Votre logo et vos couleurs, appliqués à tout le site : en-tête, pages et page d&apos;accueil.</p>
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <ImageField labelText="Logo" value={state.logoUrl} onPick={() => setPicking(true)} onClear={() => setState((s) => ({ ...s, logoUrl: null }))} />
        <ColorField labelText="Couleur principale" value={state.primaryColor} onChange={(v) => setState((s) => ({ ...s, primaryColor: v }))} hint="Boutons, liens forts, bandeaux." />
        <ColorField labelText="Couleur d'accent" value={state.accentColor} onChange={(v) => setState((s) => ({ ...s, accentColor: v }))} hint="Pastilles, détails, mises en avant." />
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={save} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
        {message && <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-yc-ink-soft" : "font-semibold text-yc-danger"}`}>{message.text}</p>}
      </div>
      {picking && <MediaPickerDialog size="medium" onPick={(url) => setState((s) => ({ ...s, logoUrl: url }))} onClose={() => setPicking(false)} />}
    </section>
  );
}
