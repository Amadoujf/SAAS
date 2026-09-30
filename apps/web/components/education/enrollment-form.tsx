"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { clockLabel, dateLabel, WEEKDAYS_SHORT, type Slot } from "@/lib/education/labels";

type ClassOption = { id: string; name: string; schedule: Slot[]; startDate: string; remaining: number };

/**
 * Demande d'inscription en ligne. Aucun montant n'est envoyé : le serveur applique les
 * frais et la scolarité de la formation. Rien n'est payé en ligne ; la famille arrive
 * sur son espace personnel pour suivre la demande.
 */
export function EnrollmentForm({ listingId, classes }: { listingId: string; classes: ClassOption[] }) {
  const router = useRouter();
  const open = classes.filter((c) => c.remaining > 0);
  const [classGroupId, setClassGroupId] = useState<string>(open[0]?.id ?? "");
  const [relation, setRelation] = useState<"parent" | "guardian" | "self">("parent");
  const [f, setF] = useState({ guardianFirstName: "", guardianLastName: "", phone: "", email: "", studentFirstName: "", studentLastName: "", birthDate: "", note: "" });
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = "mt-1.5 h-12 w-full rounded-[var(--radius-md)] bg-white px-3.5 text-[15px] font-normal ring-1 ring-inset ring-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]";
  const self = relation === "self";
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <form
      className="grid gap-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        const res = await fetch("/api/storefront/education/enroll", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ listingId, classGroupId: classGroupId || null, relation, ...f, consent }),
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string; data?: { familyToken: string } };
        if (!res.ok || !json.data) {
          setPending(false);
          return setError(json.error ?? "Envoi impossible pour le moment.");
        }
        router.push(`/famille/${json.data.familyToken}?demande=1`);
      }}
    >
      {classes.length > 0 && (
        <fieldset>
          <legend className="text-[15px] font-semibold">Classe souhaitée</legend>
          <div className="mt-2 grid gap-2">
            {classes.map((c) => (
              <label key={c.id} className={`flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] p-3.5 ring-1 ring-inset ${c.remaining ? (classGroupId === c.id ? "bg-white ring-2 ring-[var(--color-primary)]" : "bg-white ring-[var(--color-border)]") : "cursor-not-allowed opacity-55 ring-[var(--color-border)]"}`}>
                <input type="radio" name="classe" value={c.id} disabled={!c.remaining} checked={classGroupId === c.id} onChange={() => setClassGroupId(c.id)} className="mt-1 h-4 w-4 accent-[var(--color-primary)]" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold">{c.name}</span>
                    <span className={`text-[13px] font-semibold ${c.remaining ? (c.remaining <= 3 ? "text-[var(--color-warning)]" : "text-[var(--color-success)]") : "text-[var(--color-text-muted)]"}`}>{c.remaining ? `${c.remaining} place${c.remaining > 1 ? "s" : ""}` : "Complet"}</span>
                  </span>
                  <span className="yc-num block text-[13.5px] text-[var(--color-text-muted)]">
                    Dès le {dateLabel(c.startDate, { day: "numeric", month: "long" })}
                    {c.schedule.length > 0 && ` · ${c.schedule.map((s) => `${WEEKDAYS_SHORT[s.weekday]} ${clockLabel(s.startMinute)}`).join(", ")}`}
                  </span>
                </span>
              </label>
            ))}
            <label className={`flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] p-3.5 ring-1 ring-inset ${classGroupId === "" ? "bg-white ring-2 ring-[var(--color-primary)]" : "ring-[var(--color-border)]"}`}>
              <input type="radio" name="classe" value="" checked={classGroupId === ""} onChange={() => setClassGroupId("")} className="h-4 w-4 accent-[var(--color-primary)]" />
              <span className="text-[14.5px]">Pas de préférence — l&apos;établissement me propose une classe</span>
            </label>
          </div>
        </fieldset>
      )}

      <fieldset>
        <legend className="text-[15px] font-semibold">Qui inscrit ?</legend>
        <div role="radiogroup" className="mt-2 flex flex-wrap gap-2">
          {([["parent", "Je suis parent"], ["guardian", "Je suis tuteur"], ["self", "Je m'inscris moi-même"]] as const).map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={relation === k} onClick={() => setRelation(k)} className={`h-10 rounded-full px-4 text-[14px] font-medium ring-1 ring-inset ${relation === k ? "bg-[var(--color-primary)] text-white ring-[var(--color-primary)]" : "bg-white ring-[var(--color-border)]"}`}>{l}</button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-[14px] font-semibold">{self ? "Prénom" : "Votre prénom"}<input required maxLength={80} autoComplete="given-name" value={f.guardianFirstName} onChange={set("guardianFirstName")} className={field} /></label>
        <label className="block text-[14px] font-semibold">{self ? "Nom" : "Votre nom"}<input required={self} maxLength={80} autoComplete="family-name" value={f.guardianLastName} onChange={set("guardianLastName")} className={field} /></label>
        <label className="block text-[14px] font-semibold">Téléphone<input required type="tel" inputMode="tel" autoComplete="tel" maxLength={20} value={f.phone} onChange={set("phone")} placeholder="77 123 45 67" className={field} /></label>
        <label className="block text-[14px] font-semibold">E-mail <span className="font-normal text-[var(--color-text-muted)]">(facultatif)</span><input type="email" autoComplete="email" maxLength={160} value={f.email} onChange={set("email")} className={field} /></label>
        {!self && (
          <>
            <label className="block text-[14px] font-semibold">Prénom de l&apos;élève<input required maxLength={80} value={f.studentFirstName} onChange={set("studentFirstName")} className={field} /></label>
            <label className="block text-[14px] font-semibold">Nom de l&apos;élève<input required maxLength={80} value={f.studentLastName} onChange={set("studentLastName")} className={field} /></label>
          </>
        )}
        <label className="block text-[14px] font-semibold">Date de naissance <span className="font-normal text-[var(--color-text-muted)]">(facultatif)</span><input type="date" value={f.birthDate} onChange={set("birthDate")} className={field} /></label>
        <label className="block text-[14px] font-semibold sm:col-span-2">Message <span className="font-normal text-[var(--color-text-muted)]">(facultatif)</span>
          <textarea rows={3} maxLength={600} value={f.note} onChange={set("note")} placeholder="Niveau actuel, besoins particuliers, questions…" className={`${field} h-auto py-3`} />
        </label>
      </div>

      <label className="flex items-start gap-3 text-[14px] leading-relaxed">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--color-primary)]" />
        <span>J&apos;accepte d&apos;être recontacté par l&apos;établissement au sujet de cette inscription. Aucun paiement n&apos;est demandé en ligne.</span>
      </label>
      {error && <p role="alert" className="text-[15px] font-semibold text-[var(--color-danger)]">{error}</p>}
      <button type="submit" disabled={pending} className="flex min-h-[52px] w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary)] text-[15.5px] font-semibold text-white disabled:opacity-60 sm:w-auto sm:px-9">
        {pending ? "Envoi…" : "Envoyer la demande d'inscription"}
      </button>
    </form>
  );
}
