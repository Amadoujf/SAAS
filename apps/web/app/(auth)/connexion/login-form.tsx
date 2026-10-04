"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/yc/button";
import { Field, Input } from "@/components/yc/field";

function Submit() {
  const { pending } = useFormStatus();
  return <Button type="submit" variant="royal" size="lg" loading={pending} className="mt-2 w-full rounded-lg">{pending ? "Connexion…" : "Se connecter"}</Button>;
}

export function LoginForm({ action, next }: { action: (form: FormData) => Promise<void>; next: string }) {
  return (
    <form action={action} className="mt-8 flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Field label="E-mail">{(p) => <Input {...p} name="email" type="email" required autoComplete="email" />}</Field>
      <Field label="Mot de passe">{(p) => <Input {...p} name="password" type="password" required autoComplete="current-password" />}</Field>
      <Submit />
    </form>
  );
}
