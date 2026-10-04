"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/yc/button";
import { Field, Input, Textarea } from "@/components/yc/field";
import { Panel, PanelHeader } from "@/components/yc/panel";
import { Feedback } from "./feedback";

type Profile = {
  legalName: string | null;
  legalForm: string | null;
  ninea: string | null;
  rccm: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  publicationDirector: string | null;
  returnPolicy: string | null;
  additionalTerms: string | null;
};
type Key = keyof Profile;

const IDENTITY: { key: Key; label: string; hint?: string; type?: string; max: number }[] = [
  { key: "legalName", label: "Raison sociale ou nom de l'entrepreneur", hint: "Tel qu'il figure sur vos documents officiels. À défaut, le nom de votre site est affiché.", max: 120 },
  { key: "legalForm", label: "Forme juridique", hint: "Entreprise individuelle, SARL, SUARL, SA, GIE…", max: 60 },
  { key: "ninea", label: "NINEA", max: 30 },
  { key: "rccm", label: "Numéro RCCM", hint: "Ex. SN-DKR-2024-A-12345", max: 40 },
  { key: "address", label: "Adresse du siège", max: 240 },
  { key: "email", label: "E-mail de contact", type: "email", max: 120 },
  { key: "phone", label: "Téléphone", type: "tel", max: 30 },
  { key: "publicationDirector", label: "Responsable de la publication", hint: "La personne qui répond du contenu du site, en général le gérant.", max: 120 },
];

export function LegalProfileForm({ initial, updatedAt, siteUrl }: { initial: Profile; updatedAt: string | null; siteUrl: string | null }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [values, setValues] = useState<Record<Key, string>>(() => Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, v ?? ""])) as Record<Key, string>);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const set = (key: Key) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const body = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim() ? v : null]));
      const res = await fetch("/api/dashboard/legal-profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Enregistrement impossible.");
        return;
      }
      setSuccess("Informations enregistrées : vos pages légales sont à jour.");
      startTransition(() => router.refresh());
    } catch {
      setError("Connexion interrompue — réessayez.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_1fr]">
      <Panel>
        <PanelHeader title="Identité de l'entreprise" description="Affichée dans les mentions légales de votre site." />
        <div className="grid grid-cols-1 gap-4 px-5 pb-5 sm:grid-cols-2 sm:px-6">
          {IDENTITY.map((f) => (
            <div key={f.key} className={f.key === "legalName" || f.key === "address" ? "sm:col-span-2" : ""}>
              <Field label={f.label} hint={f.hint} optional>
                {(p) => <Input {...p} type={f.type ?? "text"} maxLength={f.max} value={values[f.key]} onChange={set(f.key)} autoComplete="off" />}
              </Field>
            </div>
          ))}
        </div>
      </Panel>
      <div className="flex flex-col gap-5">
        <Panel>
          <PanelHeader title="Vos conditions" description="Ajoutées à vos conditions générales. Vos clients les lisent avant de commander." />
          <div className="flex flex-col gap-4 px-5 pb-5 sm:px-6">
            <Field label="Retours, échanges et annulations" hint="Ex. « Échange sous 7 jours sur présentation du reçu, article non porté. Pas de remboursement sur les articles soldés. »" optional>
              {(p) => <Textarea {...p} rows={5} maxLength={3000} value={values.returnPolicy} onChange={set("returnPolicy")} />}
            </Field>
            <Field label="Conditions particulières" hint="Ce qui est propre à votre activité : acompte, garantie, délai d'annulation d'une réservation…" optional>
              {(p) => <Textarea {...p} rows={6} maxLength={6000} value={values.additionalTerms} onChange={set("additionalTerms")} />}
            </Field>
          </div>
        </Panel>
        <Panel>
          <div className="flex flex-col gap-3 px-5 py-5 text-sm text-yc-ink-soft sm:px-6">
            <p>
              Les textes de vos pages légales sont des modèles généraux pour le Sénégal. Faites-les relire par un professionnel avant d&apos;ouvrir votre site au public.
            </p>
            {siteUrl ? (
              <p className="flex flex-wrap gap-x-4 gap-y-1">
                <a href={`${siteUrl}/mentions-legales`} target="_blank" rel="noopener" className="font-semibold text-yc-electric underline-offset-4 hover:underline">Voir les mentions légales</a>
                <a href={`${siteUrl}/conditions-generales`} target="_blank" rel="noopener" className="font-semibold text-yc-electric underline-offset-4 hover:underline">Voir les conditions</a>
                <a href={`${siteUrl}/confidentialite`} target="_blank" rel="noopener" className="font-semibold text-yc-electric underline-offset-4 hover:underline">Voir la confidentialité</a>
              </p>
            ) : (
              <p>Vos pages légales seront visibles dès que votre site aura une adresse active.</p>
            )}
            {updatedAt && <p className="text-xs">Dernière mise à jour : {new Date(updatedAt).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })}</p>}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-yc-ink/[0.06] px-5 py-4 sm:px-6">
            <Feedback error={error} success={success} />
            <Button type="submit" loading={pending} className="ml-auto">Enregistrer</Button>
          </div>
        </Panel>
      </div>
    </form>
  );
}
