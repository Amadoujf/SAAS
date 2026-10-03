"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { clockLabel, dayChip, durationLabel, priceLabel } from "@/lib/salon/labels";
import { SlotPicker, type Slot } from "./slot-picker";

export interface FlowService {
  id: string;
  slug: string;
  title: string;
  category: string;
  durationMinutes: number;
  price: number | null;
  priceFrom: boolean;
  staffIds: string[];
}

export interface FlowStaff {
  id: string;
  name: string;
  title: string | null;
  photoUrl: string | null;
}

const input = "h-12 w-full rounded-[var(--radius-md)] bg-white px-3.5 text-[15px] ring-1 ring-inset ring-[var(--color-border)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]";
const label = "grid gap-1.5 text-[13px] font-semibold";

function Step({ n, title, done, summary, onEdit, children }: { n: number; title: string; done: boolean; summary?: string | null; onEdit?: () => void; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`etape-${n}`} className="border-b border-[var(--color-border)] py-8 first:pt-0">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={`etape-${n}`} className="flex items-baseline gap-3 font-[family-name:var(--font-heading)] text-[28px] leading-none sm:text-[32px]">
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full font-[family-name:var(--font-body)] text-[13px] font-bold ${done ? "bg-[var(--color-success)] text-white" : "bg-[var(--color-primary)] text-white"}`} aria-hidden="true">{done ? "✓" : n}</span>
          {title}
        </h2>
        {done && onEdit && <button type="button" onClick={onEdit} className="text-[13px] font-semibold text-[var(--color-accent-primary)] underline-offset-4 hover:underline">Modifier</button>}
      </div>
      {done && summary ? <p className="mt-3 pl-11 text-[15px] text-[var(--color-text-secondary)]">{summary}</p> : <div className="mt-6">{children}</div>}
    </section>
  );
}

function Avatar({ staff, size = 44 }: { staff: FlowStaff | null; size?: number }) {
  if (staff?.photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={staff.photoUrl} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-[var(--color-surface)] font-[family-name:var(--font-heading)] text-[18px] italic text-[var(--color-accent-primary)]" style={{ width: size, height: size }} aria-hidden="true">
      {staff ? staff.name.slice(0, 1) : "✦"}
    </span>
  );
}

/**
 * Prise de rendez-vous : prestation → personne (ou sans préférence) → jour et horaire
 * libres (calculés par le serveur) → coordonnées. Le serveur revérifie tout à l'envoi ;
 * aucun prix n'est transmis. Rien n'est payé en ligne.
 */
export function BookingFlow({
  services,
  staff,
  today,
  timezone,
  initialService,
  initialStaff,
  autoConfirm,
  payWays,
  cancelCutoffHours,
}: {
  services: FlowService[];
  staff: FlowStaff[];
  today: string;
  timezone: string;
  initialService: string | null;
  initialStaff: string | null;
  autoConfirm: boolean;
  payWays: string[];
  cancelCutoffHours: number;
}) {
  const router = useRouter();
  const formId = useId();
  const initial = services.find((s) => s.slug === initialService) ?? (initialStaff ? null : null);
  const [serviceSlug, setServiceSlug] = useState<string | null>(initial?.slug ?? null);
  const [staffId, setStaffId] = useState<string | null>(initialStaff && staff.some((s) => s.id === initialStaff) ? initialStaff : null);
  const [staffChosen, setStaffChosen] = useState(Boolean(initial) && Boolean(initialStaff));
  const [slot, setSlot] = useState<Slot | null>(null);
  const [state, setState] = useState<"idle" | "sending">("idle");
  const [error, setError] = useState<string | null>(null);
  const contactRef = useRef<HTMLDivElement>(null);

  const service = services.find((s) => s.slug === serviceSlug) ?? null;
  const staffForService = useMemo(() => (service ? staff.filter((s) => service.staffIds.includes(s.id)) : []), [service, staff]);
  // Une personne présélectionnée qui ne fait pas cette prestation : on repasse en « sans préférence ».
  useEffect(() => {
    if (service && staffId && !service.staffIds.includes(staffId)) setStaffId(null);
  }, [service, staffId]);
  // Prestations proposées : celles de la personne présélectionnée, sinon toutes.
  const offered = initialStaff && !serviceSlug ? services.filter((s) => s.staffIds.includes(initialStaff)) : services;
  const categories = [...new Set(offered.map((s) => s.category))];
  const person = staff.find((s) => s.id === staffId) ?? null;
  const assigned = slot && !staffId ? staff.find((s) => s.id === slot.staffIds[0]) ?? null : null;
  const chip = slot ? dayChip(new Date(slot.startAt).toISOString().slice(0, 10), today) : null;
  const when = slot
    ? `${new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: timezone }).format(new Date(slot.startAt))} à ${clockLabel(slot.minute)}`
    : null;

  useEffect(() => {
    if (slot) contactRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }, [slot]);

  const submit = async (form: HTMLFormElement) => {
    if (!service || !slot) return;
    const f = new FormData(form);
    setError(null);
    setState("sending");
    try {
      const res = await fetch("/api/storefront/salon/book", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ service: service.slug, staffId, startAt: slot.startAt, firstName: f.get("firstName"), lastName: f.get("lastName"), phone: f.get("phone"), email: f.get("email"), note: f.get("note") }),
      });
      const json = (await res.json().catch(() => ({}))) as { data?: { url: string }; error?: string };
      if (!res.ok || !json.data) throw new Error(json.error ?? "Rendez-vous impossible.");
      router.push(json.data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rendez-vous impossible.");
      setSlot(null);
      setState("idle");
    }
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_380px] lg:gap-16">
      <div className="min-w-0">
        <Step n={1} title="Votre prestation" done={Boolean(service)} summary={service ? `${service.title} · ${durationLabel(service.durationMinutes)} · ${priceLabel(service.price, service.priceFrom)}` : null} onEdit={() => { setServiceSlug(null); setSlot(null); setStaffChosen(false); }}>
          <div className="grid gap-8">
            {categories.map((c) => (
              <fieldset key={c}>
                <legend className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-accent-secondary)]">{c}</legend>
                <div className="grid gap-2">
                  {offered.filter((s) => s.category === c).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { setServiceSlug(s.slug); setSlot(null); setStaffChosen(Boolean(initialStaff && s.staffIds.includes(initialStaff))); }}
                      className="flex items-center justify-between gap-4 rounded-[var(--radius-md)] bg-white px-4 py-3.5 text-left ring-1 ring-inset ring-[var(--color-border)] transition-colors hover:ring-[var(--color-accent-primary)]"
                    >
                      <span className="min-w-0">
                        <span className="block text-[15.5px] font-semibold">{s.title}</span>
                        <span className="block text-[13px] text-[var(--color-text-muted)]">{durationLabel(s.durationMinutes)}</span>
                      </span>
                      <span className="shrink-0 text-[14px] font-semibold tabular-nums">{priceLabel(s.price, s.priceFrom)}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
            ))}
            {offered.length === 0 && <p className="text-[15px] text-[var(--color-text-secondary)]">Aucune prestation ne se réserve en ligne pour l&apos;instant. Appelez le salon.</p>}
          </div>
        </Step>

        {service && (
          <Step n={2} title="Avec qui ?" done={staffChosen} summary={person ? person.name : "Sans préférence : la première personne disponible"} onEdit={() => { setStaffChosen(false); setSlot(null); }}>
            <div role="radiogroup" aria-label="Personne" className="grid gap-2 sm:grid-cols-2">
              {[null, ...staffForService].map((s) => {
                const on = (s?.id ?? null) === staffId;
                return (
                  <button
                    key={s?.id ?? "any"}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => { setStaffId(s?.id ?? null); setStaffChosen(true); setSlot(null); }}
                    className={`flex items-center gap-3 rounded-[var(--radius-md)] px-4 py-3 text-left ring-1 ring-inset transition-colors ${on ? "bg-[color-mix(in_srgb,var(--color-accent-primary)_7%,white)] ring-2 ring-[var(--color-accent-primary)]" : "bg-white ring-[var(--color-border)] hover:ring-[var(--color-text-muted)]"}`}
                  >
                    <Avatar staff={s} />
                    <span className="min-w-0">
                      <span className="block text-[15px] font-semibold">{s ? s.name : "Sans préférence"}</span>
                      <span className="block truncate text-[13px] text-[var(--color-text-muted)]">{s ? s.title ?? "Disponible pour cette prestation" : "Plus de choix d'horaires"}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Step>
        )}

        {service && staffChosen && (
          <Step n={3} title="Quand ?" done={false}>
            <SlotPicker service={service.slug} staffId={staffId} today={today} value={slot} onChange={setSlot} />
          </Step>
        )}

        {service && staffChosen && slot && (
          <div ref={contactRef} className="scroll-mt-28">
            <Step n={4} title="Vos coordonnées" done={false}>
              <form id={formId} className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void submit(e.currentTarget); }}>
                <div className="grid grid-cols-2 gap-3">
                  <label className={label}>Prénom<input name="firstName" required maxLength={80} autoComplete="given-name" className={input} /></label>
                  <label className={label}>Nom <span className="-mt-1 text-xs font-normal text-[var(--color-text-muted)]">(facultatif)</span><input name="lastName" maxLength={80} autoComplete="family-name" className={input} /></label>
                </div>
                <label className={label}>Téléphone<input name="phone" type="tel" required inputMode="tel" maxLength={20} autoComplete="tel" placeholder="77 123 45 67" className={input} /></label>
                <label className={label}>E-mail <span className="-mt-1 text-xs font-normal text-[var(--color-text-muted)]">(facultatif)</span><input name="email" type="email" maxLength={200} autoComplete="email" className={input} /></label>
                <label className={label}>Une précision pour le salon ? <span className="-mt-1 text-xs font-normal text-[var(--color-text-muted)]">(facultatif : longueur, allergie…)</span><textarea name="note" rows={2} maxLength={500} className={`${input} h-auto py-3`} /></label>
                {error && <p role="alert" className="rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--color-danger)_8%,white)] px-4 py-3 text-sm font-medium text-[var(--color-danger)]">{error}</p>}
                <button type="submit" disabled={state === "sending"} className="mt-2 inline-flex h-14 items-center justify-center rounded-[var(--radius-full)] bg-[var(--color-accent-primary)] text-[15px] font-semibold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60">
                  {state === "sending" ? "Envoi…" : autoConfirm ? "Confirmer le rendez-vous" : "Envoyer ma demande"}
                </button>
                <p className="text-center text-xs text-[var(--color-text-muted)]">Rien n&apos;est payé en ligne. Vos coordonnées ne sont transmises qu&apos;au salon.</p>
              </form>
            </Step>
          </div>
        )}
        {error && !slot && <p role="alert" className="mt-6 rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--color-danger)_8%,white)] px-4 py-3 text-sm font-medium text-[var(--color-danger)]">{error}</p>}
      </div>

      <aside aria-label="Récapitulatif" className="lg:sticky lg:top-[100px] lg:self-start">
        <div className="overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-primary)] text-white shadow-[var(--shadow-lg)]">
          <div className="px-6 pb-5 pt-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/60">Votre rendez-vous</p>
            <p className="mt-3 font-[family-name:var(--font-heading)] text-[28px] italic leading-tight">{service?.title ?? "Choisissez une prestation"}</p>
            {service && <p className="mt-1 text-[14px] text-white/70">{durationLabel(service.durationMinutes)} · {priceLabel(service.price, service.priceFrom)}</p>}
          </div>
          <dl className="grid gap-3 border-t border-white/10 px-6 py-5 text-[14px]">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-white/60">Avec</dt>
              <dd className="flex items-center gap-2 font-semibold">{person ? person.name : assigned ? `${assigned.name} (disponible)` : "Sans préférence"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-white/60">Quand</dt>
              <dd className="text-right font-semibold first-letter:uppercase">{when ?? "—"}</dd>
            </div>
          </dl>
          {chip && <p className="border-t border-white/10 px-6 py-4 text-[13px] text-white/70">{autoConfirm ? "Confirmé dès l'envoi." : "Le salon confirme votre demande."} Règlement au salon : {payWays.join(", ")}.{cancelCutoffHours > 0 ? ` Modifiable en ligne jusqu'à ${cancelCutoffHours} h avant.` : ""}</p>}
        </div>
      </aside>
    </div>
  );
}
