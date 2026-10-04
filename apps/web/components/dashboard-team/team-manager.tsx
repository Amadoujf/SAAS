"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/yc/button";
import { Field, Input } from "@/components/yc/field";
import { IconCheck } from "@/components/yc/icons";
import { ROLE_LABELS } from "@/lib/team/roles";

const INVITABLE = ["MANAGER", "SALES", "INVENTORY_MANAGER", "MARKETING", "ACCOUNTANT", "DELIVERY_STAFF", "TEACHER"] as const;

async function post(body: unknown) {
  const res = await fetch("/api/dashboard/team", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as { data?: { link?: string }; error?: string };
  if (!res.ok) throw new Error(json.error ?? "Action impossible.");
  return json.data;
}

export function InviteForm({ canInvite, full }: { canInvite: boolean; full: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof INVITABLE)[number]>("SALES");
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  if (!canInvite) return <p className="px-5 pb-5 text-sm text-yc-ink-soft">Seuls le propriétaire et les gérants peuvent inviter des membres.</p>;
  return (
    <div className="px-5 pb-5">
      <form
        className="grid gap-3 sm:grid-cols-[1fr_220px_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setLink(null);
          start(async () => {
            try {
              const data = await post({ action: "invite", email, roleName: role });
              setLink(data?.link ?? null);
              setEmail("");
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Action impossible.");
            }
          });
        }}
      >
        <Field label="E-mail de la personne">{(p) => <Input {...p} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom@exemple.sn" />}</Field>
        <Field label="Rôle">
          {(p) => (
            <select {...p} value={role} onChange={(e) => setRole(e.target.value as (typeof INVITABLE)[number])} className="yc-focus h-11 w-full rounded-xl bg-white px-3 text-[15px] ring-1 ring-inset ring-yc-ink/12">
              {INVITABLE.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]!.label}</option>)}
            </select>
          )}
        </Field>
        <Button type="submit" variant="royal" loading={pending} disabled={full} className="h-11 rounded-lg">Inviter</Button>
      </form>
      {full && <p className="mt-3 text-sm text-yc-ink-soft">Toutes les places de votre formule sont occupées (invitations en attente comprises).</p>}
      {error && <p role="alert" className="mt-3 rounded-lg bg-yc-danger/[0.07] px-3 py-2 text-sm text-[rgb(185_28_28)]">{error}</p>}
      {link && (
        <div role="status" className="mt-3 rounded-lg bg-yc-success/[0.08] p-3 text-sm">
          <p className="font-semibold text-[rgb(4_120_87)]">Invitation créée. Envoyez ce lien à la personne (valable 7 jours) :</p>
          <p className="mt-1 text-yc-ink-soft">Aucun e-mail n&apos;est envoyé automatiquement pour le moment. Le lien n&apos;est affiché qu&apos;une fois.</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input readOnly value={link} aria-label="Lien d'invitation" className="h-10 min-w-0 flex-1 rounded-lg bg-white px-3 text-[13px] ring-1 ring-inset ring-yc-ink/10" onFocus={(e) => e.currentTarget.select()} />
            <Button type="button" variant="secondary" size="sm" className="h-10" onClick={() => { void navigator.clipboard?.writeText(link); setCopied(true); }}>
              {copied ? <><IconCheck size={16} /> Copié</> : "Copier"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function MemberActions({ memberId, roleName, canEditRole, canRemove, name }: { memberId: string; roleName: string; canEditRole: boolean; canRemove: boolean; name: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const act = (body: unknown) =>
    start(async () => {
      setError(null);
      try {
        await post(body);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action impossible.");
      }
    });
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {canEditRole ? (
        <select aria-label={`Rôle de ${name}`} disabled={pending} value={roleName} onChange={(e) => act({ action: "role", memberId, roleName: e.target.value })}
          className="yc-focus h-9 rounded-lg bg-white px-2 text-sm ring-1 ring-inset ring-yc-ink/12">
          {INVITABLE.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]!.label}</option>)}
        </select>
      ) : (
        <span className="text-sm text-yc-ink-soft">{ROLE_LABELS[roleName]?.label ?? roleName}</span>
      )}
      {canRemove && (
        <Button type="button" variant="danger" size="sm" disabled={pending} onClick={() => { if (window.confirm(`Retirer ${name} de l'équipe ?`)) act({ action: "remove", memberId }); }}>Retirer</Button>
      )}
      {error && <p role="alert" className="w-full text-right text-xs text-yc-danger">{error}</p>}
    </div>
  );
}

export function RevokeButton({ invitationId, email }: { invitationId: string; email: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button type="button" variant="ghost" size="sm" disabled={pending} aria-label={`Annuler l'invitation de ${email}`}
      onClick={() => start(async () => { await post({ action: "revoke", invitationId }).catch(() => undefined); router.refresh(); })}>
      Annuler
    </Button>
  );
}
