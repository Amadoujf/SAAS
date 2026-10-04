"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/yc/button";
import { Field, Input } from "@/components/yc/field";
import { acceptInvitationAction, type InvitationState } from "./actions";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" variant="royal" size="lg" loading={pending} className="mt-2 w-full rounded-lg">{label}</Button>;
}

export function InvitationForm({ token, email, loggedIn }: { token: string; email: string; loggedIn: boolean }) {
  const [state, action] = useFormState<InvitationState, FormData>(acceptInvitationAction, { error: null });
  return (
    <form action={action} className="mt-8 flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      {!loggedIn && (
        <>
          <Field label="E-mail">{(p) => <Input {...p} value={email} readOnly aria-readonly="true" />}</Field>
          <Field label="Nom complet">{(p) => <Input {...p} name="fullName" required autoComplete="name" />}</Field>
          <Field label="Mot de passe" hint="8 caractères minimum.">{(p) => <Input {...p} name="password" type="password" required minLength={8} autoComplete="new-password" />}</Field>
        </>
      )}
      {state.error && <p role="alert" className="rounded-lg bg-yc-danger/[0.07] px-4 py-3 text-sm font-medium text-[rgb(185_28_28)]">{state.error}</p>}
      <Submit label={loggedIn ? "Rejoindre l'équipe" : "Créer mon accès et rejoindre"} />
    </form>
  );
}
