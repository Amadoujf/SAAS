"use client";

import { usePrefersReducedMotion } from "@/lib/motion/animation-level-context";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IconArrowLeft, IconArrowRight, IconCheck, IconMapPin, IconShield, IconStore, IconTruck, IconWallet } from "@/components/yc/icons";
import { fcfa, useStoreCart } from "./cart-provider";

interface Zone { id: string; label: string; region: string; commune: string | null; estimatedDays: number | null; freeThreshold: number | null; fee: number | null; available: boolean; unavailableReason: string | null; freeShippingApplied: boolean }
interface Quote { subtotal: number; pickup: { enabled: boolean; address: string | null; instructions: string | null }; deliveryAllowed: boolean; deliveryBlockedReason: string | null; deliveryInstructions: string | null; zones: Zone[] }
interface Method { method: "cod" | "online" | "manual_wave" | "manual_orange_money"; label: string; description: string; accountNumber?: string }
interface Options { methods: Method[]; quote: Quote }

const STEPS = ["Coordonnées", "Livraison", "Paiement", "Vérification"] as const;
const inputCls = "h-12 w-full rounded-[var(--radius-md)] bg-[var(--color-background)] px-4 text-base ring-1 ring-inset ring-[var(--color-border)] transition focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] aria-[invalid=true]:ring-[var(--color-danger)]";

function Label({ htmlFor, children, optional }: { htmlFor: string; children: React.ReactNode; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold">
      {children} {optional && <span className="font-normal text-[var(--color-text-muted)]">(facultatif)</span>}
    </label>
  );
}

/**
 * Checkout en 4 étapes, pensé mobile d'abord. Le récapitulatif affiche le montant de
 * livraison RENVOYÉ PAR LE SERVEUR pour la zone choisie ; le total final est celui de
 * la commande créée (recalculée côté serveur), jamais un calcul du navigateur envoyé
 * au serveur.
 */
export function CheckoutFlow({ regions }: { regions: string[] }) {
  const router = useRouter();
  const reduce = usePrefersReducedMotion();
  const { cart, loading: cartLoading } = useStoreCart();
  const [options, setOptions] = useState<Options | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [customer, setCustomer] = useState({ firstName: "", lastName: "", phone: "", email: "" });
  const [method, setMethod] = useState<"delivery" | "pickup">("delivery");
  const [region, setRegion] = useState("Dakar");
  const [address, setAddress] = useState({ commune: "", neighborhood: "", street: "" });
  const [quote, setQuote] = useState<Quote | null>(null);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [payment, setPayment] = useState<Method["method"] | null>(null);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/storefront/checkout/options", { cache: "no-store" })
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error((await r.json().catch(() => ({})))?.error ?? "Indisponible"))))
      .then((o: Options) => {
        setOptions(o);
        setQuote(o.quote);
        if (!o.quote.deliveryAllowed && o.quote.pickup.enabled) setMethod("pickup");
        setPayment(o.methods[0]?.method ?? null);
      })
      .catch((e) => setLoadError(e.message));
  }, []);

  useEffect(() => {
    if (method !== "delivery") return;
    let alive = true;
    fetch(`/api/storefront/delivery-options?region=${encodeURIComponent(region)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (!alive || !json.quote) return;
        setQuote(json.quote);
        const firstAvailable = (json.quote as Quote).zones.find((z) => z.available);
        setZoneId((current) => ((json.quote as Quote).zones.some((z) => z.id === current && z.available) ? current : firstAvailable?.id ?? null));
      });
    return () => { alive = false; };
  }, [region, method, cart?.subtotal]);

  const zone = quote?.zones.find((z) => z.id === zoneId) ?? null;
  const shipping = method === "pickup" ? 0 : zone?.fee ?? null;
  const subtotal = cart?.subtotal ?? 0;
  const estimated = shipping === null ? null : subtotal + shipping;
  const chosen = options?.methods.find((m) => m.method === payment);

  function validate(s: number): boolean {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (!customer.firstName.trim()) e.firstName = "Indiquez votre prénom.";
      if (!/^(\+221|00221)?\s?(7[05678])(\s?\d){7}$/.test(customer.phone.trim())) e.phone = "Numéro sénégalais attendu, ex. 77 123 45 67.";
      if (customer.email && !/^\S+@\S+\.\S+$/.test(customer.email)) e.email = "Adresse e-mail invalide.";
    }
    if (s === 1) {
      if (method === "delivery") {
        if (!zone || !zone.available) e.zone = "Choisissez une zone de livraison disponible.";
        if (!address.neighborhood.trim() && !address.street.trim()) e.address = "Indiquez au moins votre quartier ou un repère.";
      }
    }
    if (s === 2 && !payment) e.payment = "Choisissez un moyen de paiement.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }
  function go(to: number) {
    if (to > step && !validate(step)) return;
    setDir(to > step ? 1 : -1);
    setStep(to);
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }

  async function submit() {
    if (![0, 1, 2].every((s) => validate(s))) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/storefront/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customer: { firstName: customer.firstName.trim(), lastName: customer.lastName.trim() || null, phone: customer.phone.trim(), email: customer.email.trim() || null },
          deliveryMethod: method,
          deliveryZoneId: method === "delivery" ? zoneId : null,
          deliveryAddress: method === "delivery" ? { region, commune: address.commune || null, neighborhood: address.neighborhood || null, street: address.street || null } : null,
          paymentMethod: payment,
          notes: notes.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "La commande n'a pas pu être créée.");
      const order = json.order as { orderId: string; accessToken: string; checkoutUrl: string | null };
      if (order.checkoutUrl) window.location.href = order.checkoutUrl;
      else router.push(`/commande/${order.orderId}?token=${order.accessToken}&nouvelle=1`);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "La commande n'a pas pu être créée.");
      setSubmitting(false);
    }
  }

  const summary = useMemo(
    () => (
      <aside className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-5 sm:p-6">
        <h2 className="font-[family-name:var(--font-heading)] text-lg font-semibold">Votre commande</h2>
        <ul className="mt-4 space-y-3">
          {cart?.lines.map((l) => (
            <li key={l.id} className="flex items-center gap-3 text-sm">
              <span className="relative h-14 w-12 shrink-0 overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-surface-muted)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {l.imageUrl && <img src={l.imageUrl} alt="" className="h-full w-full object-cover" />}
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--color-text-primary)] px-1 text-[10px] font-bold text-[var(--color-background)]">{l.quantity}</span>
              </span>
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">{l.productName}</span><span className="text-[var(--color-text-muted)]">{l.variantName}</span></span>
              <span className="tabular-nums">{fcfa(l.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-5 space-y-2 border-t border-[var(--color-border)] pt-4 text-sm">
          <div className="flex justify-between"><dt className="text-[var(--color-text-muted)]">Sous-total</dt><dd className="tabular-nums">{fcfa(subtotal)}</dd></div>
          <div className="flex justify-between">
            <dt className="text-[var(--color-text-muted)]">{method === "pickup" ? "Retrait en boutique" : "Livraison"}</dt>
            <dd className="tabular-nums">{shipping === null ? "—" : shipping === 0 ? "Offerte" : fcfa(shipping)}</dd>
          </div>
          <div className="flex justify-between border-t border-[var(--color-border)] pt-3 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{estimated === null ? "—" : fcfa(estimated)}</dd></div>
        </dl>
        {chosen && step >= 2 && <p className="mt-3 flex items-center gap-2 text-xs text-[var(--color-text-muted)]"><IconWallet size={15} /> {chosen.label}</p>}
        <p className="mt-2 flex items-center gap-2 text-xs text-[var(--color-text-muted)]"><IconShield size={15} /> Montant final confirmé par la boutique à la validation.</p>
      </aside>
    ),
    [cart, subtotal, shipping, estimated, method, chosen, step],
  );

  if (loadError) return <p role="alert" className="mx-auto mt-16 max-w-md rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-8 text-center">{loadError}</p>;
  if (cartLoading || !options) {
    return (
      <div role="status" aria-label="Chargement du paiement" className="mx-auto mt-10 grid max-w-[1100px] gap-8 px-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-surface-muted)]" />)}</div>
        <div className="h-72 animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-surface-muted)]" />
      </div>
    );
  }
  if (!cart || cart.lines.length === 0) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-10 text-center">
        <p className="font-[family-name:var(--font-heading)] text-xl font-semibold">Votre panier est vide</p>
        <Link href="/catalogue" className="mt-6 inline-flex rounded-[var(--radius-full)] bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white">Voir le catalogue</Link>
      </div>
    );
  }
  if (options.methods.length === 0) {
    return <p role="alert" className="mx-auto mt-16 max-w-md rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-8 text-center">Cette boutique n&apos;accepte pas encore de commandes en ligne. Contactez-la directement.</p>;
  }

  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-32 pt-8 sm:px-6 lg:pb-16">
      <ol className="mb-8 flex items-center gap-2" aria-label="Étapes de la commande">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <button type="button" onClick={() => i < step && go(i)} disabled={i > step} aria-current={i === step ? "step" : undefined}
              className={`flex items-center gap-2 text-left text-xs font-semibold sm:text-sm ${i <= step ? "" : "text-[var(--color-text-muted)]"}`}>
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs transition-colors duration-300 ${i < step ? "bg-[var(--color-primary)] text-white" : i === step ? "bg-[var(--color-text-primary)] text-[var(--color-background)]" : "ring-1 ring-inset ring-[var(--color-border)]"}`}>
                {i < step ? <IconCheck size={14} /> : i + 1}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </button>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-[var(--color-border)]"><span className="block h-px bg-[var(--color-primary)] transition-all duration-500" style={{ width: i < step ? "100%" : "0%" }} /></span>}
          </li>
        ))}
      </ol>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 overflow-hidden">
          <details className="mb-6 rounded-[var(--radius-lg)] bg-[var(--color-surface)] lg:hidden">
            <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-semibold">
              Récapitulatif ({cart.itemCount}) <span className="tabular-nums">{estimated === null ? fcfa(subtotal) : fcfa(estimated)}</span>
            </summary>
            <div className="px-1 pb-1">{summary}</div>
          </details>

          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.section
              key={step}
              custom={dir}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -32 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              aria-labelledby={`step-${step}`}
            >
              <h1 id={`step-${step}`} className="font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight sm:text-3xl">{STEPS[step]}</h1>

              {step === 0 && (
                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div><Label htmlFor="c-first">Prénom</Label><input id="c-first" autoComplete="given-name" className={inputCls} value={customer.firstName} aria-invalid={!!errors.firstName} aria-describedby="e-first" onChange={(e) => setCustomer({ ...customer, firstName: e.target.value })} />{errors.firstName && <p id="e-first" role="alert" className="mt-1 text-sm text-[var(--color-danger)]">{errors.firstName}</p>}</div>
                  <div><Label htmlFor="c-last" optional>Nom</Label><input id="c-last" autoComplete="family-name" className={inputCls} value={customer.lastName} onChange={(e) => setCustomer({ ...customer, lastName: e.target.value })} /></div>
                  <div><Label htmlFor="c-phone">Téléphone</Label><input id="c-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="77 123 45 67" className={inputCls} value={customer.phone} aria-invalid={!!errors.phone} aria-describedby="e-phone h-phone" onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} /><p id="h-phone" className="mt-1 text-xs text-[var(--color-text-muted)]">Pour le livreur et le suivi de votre commande.</p>{errors.phone && <p id="e-phone" role="alert" className="mt-1 text-sm text-[var(--color-danger)]">{errors.phone}</p>}</div>
                  <div><Label htmlFor="c-email" optional>E-mail</Label><input id="c-email" type="email" autoComplete="email" className={inputCls} value={customer.email} aria-invalid={!!errors.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} />{errors.email && <p role="alert" className="mt-1 text-sm text-[var(--color-danger)]">{errors.email}</p>}</div>
                </div>
              )}

              {step === 1 && quote && (
                <div className="mt-6 flex flex-col gap-5">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Mode de réception">
                    {[
                      { key: "delivery" as const, icon: <IconTruck size={22} />, title: "Livraison", text: quote.deliveryAllowed ? "À votre adresse" : quote.deliveryBlockedReason ?? "Indisponible", disabled: !quote.deliveryAllowed },
                      { key: "pickup" as const, icon: <IconStore size={22} />, title: "Retrait en boutique", text: quote.pickup.enabled ? "Gratuit" : "Non proposé", disabled: !quote.pickup.enabled },
                    ].map((o) => (
                      <button key={o.key} type="button" role="radio" aria-checked={method === o.key} disabled={o.disabled} onClick={() => setMethod(o.key)}
                        className={`flex items-center gap-3 rounded-[var(--radius-lg)] p-4 text-left ring-1 ring-inset transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-40 ${method === o.key ? "bg-[color-mix(in_srgb,var(--color-primary)_8%,transparent)] ring-2 ring-[var(--color-primary)]" : "ring-[var(--color-border)] hover:ring-[var(--color-text-primary)]"}`}>
                        <span className="text-[var(--color-primary)]">{o.icon}</span>
                        <span><span className="block font-semibold">{o.title}</span><span className="block text-sm text-[var(--color-text-muted)]">{o.text}</span></span>
                      </button>
                    ))}
                  </div>

                  {method === "pickup" ? (
                    <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-5 text-sm">
                      <p className="flex items-start gap-2 font-semibold"><IconMapPin size={18} className="mt-0.5 shrink-0" /> {quote.pickup.address ?? "Adresse communiquée par la boutique"}</p>
                      {quote.pickup.instructions && <p className="mt-2 text-[var(--color-text-muted)]">{quote.pickup.instructions}</p>}
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <Label htmlFor="c-region">Région</Label>
                          <select id="c-region" className={inputCls} value={region} onChange={(e) => setRegion(e.target.value)}>
                            {regions.map((r) => <option key={r}>{r}</option>)}
                          </select>
                        </div>
                        <div><Label htmlFor="c-commune" optional>Commune</Label><input id="c-commune" className={inputCls} value={address.commune} onChange={(e) => setAddress({ ...address, commune: e.target.value })} /></div>
                        <div><Label htmlFor="c-quartier">Quartier</Label><input id="c-quartier" className={inputCls} value={address.neighborhood} aria-invalid={!!errors.address} onChange={(e) => setAddress({ ...address, neighborhood: e.target.value })} placeholder="Sacré-Cœur 3" /></div>
                        <div><Label htmlFor="c-street" optional>Rue, villa, repère</Label><input id="c-street" className={inputCls} value={address.street} onChange={(e) => setAddress({ ...address, street: e.target.value })} placeholder="Villa 12, près de la pharmacie" /></div>
                      </div>
                      {errors.address && <p role="alert" className="-mt-2 text-sm text-[var(--color-danger)]">{errors.address}</p>}
                      <fieldset>
                        <legend className="mb-2 text-sm font-semibold">Zone de livraison</legend>
                        {quote.zones.length === 0 ? (
                          <p className="rounded-[var(--radius-md)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-text-muted)]">La boutique ne livre pas encore dans cette région{quote.pickup.enabled ? " — le retrait en boutique reste possible." : "."}</p>
                        ) : (
                          <div className="grid gap-2" role="radiogroup" aria-label="Zone de livraison">
                            {quote.zones.map((z) => (
                              <button key={z.id} type="button" role="radio" aria-checked={zoneId === z.id} disabled={!z.available} onClick={() => setZoneId(z.id)}
                                className={`flex items-center justify-between gap-3 rounded-[var(--radius-md)] px-4 py-3.5 text-left ring-1 ring-inset transition disabled:cursor-not-allowed disabled:opacity-50 ${zoneId === z.id ? "ring-2 ring-[var(--color-primary)]" : "ring-[var(--color-border)] hover:ring-[var(--color-text-primary)]"}`}>
                                <span>
                                  <span className="block font-semibold">{z.label}</span>
                                  <span className="block text-sm text-[var(--color-text-muted)]">
                                    {z.available ? (z.estimatedDays !== null ? (z.estimatedDays <= 1 ? "Livré sous 24 h" : `Livré sous ${z.estimatedDays} jours`) : "Délai communiqué par la boutique") : z.unavailableReason}
                                    {z.available && z.freeThreshold !== null && !z.freeShippingApplied && ` · offerte dès ${fcfa(z.freeThreshold)}`}
                                  </span>
                                </span>
                                <span className="shrink-0 font-semibold tabular-nums">{z.fee === null ? "—" : z.fee === 0 ? "Offerte" : fcfa(z.fee)}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {errors.zone && <p role="alert" className="mt-2 text-sm text-[var(--color-danger)]">{errors.zone}</p>}
                      </fieldset>
                      {quote.deliveryInstructions && <p className="text-sm text-[var(--color-text-muted)]">{quote.deliveryInstructions}</p>}
                    </>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="mt-6 grid gap-3" role="radiogroup" aria-label="Moyen de paiement">
                  {options.methods.map((m) => (
                    <button key={m.method} type="button" role="radio" aria-checked={payment === m.method} onClick={() => setPayment(m.method)}
                      className={`flex items-start gap-4 rounded-[var(--radius-lg)] p-4 text-left ring-1 ring-inset transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${payment === m.method ? "bg-[color-mix(in_srgb,var(--color-primary)_8%,transparent)] ring-2 ring-[var(--color-primary)]" : "ring-[var(--color-border)] hover:ring-[var(--color-text-primary)]"}`}>
                      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-sm font-bold text-white ${m.method === "manual_wave" ? "bg-gradient-to-br from-[#1dc4ff] to-[#1a8cff]" : m.method === "manual_orange_money" ? "bg-gradient-to-br from-[#ff8a00] to-[#ff5c00]" : "bg-[var(--color-text-primary)]"}`}>
                        {m.method === "manual_wave" ? "W" : m.method === "manual_orange_money" ? "OM" : <IconWallet size={20} />}
                      </span>
                      <span><span className="block font-semibold">{m.label}</span><span className="block text-sm text-[var(--color-text-muted)]">{m.description}</span></span>
                    </button>
                  ))}
                  {errors.payment && <p role="alert" className="text-sm text-[var(--color-danger)]">{errors.payment}</p>}
                  <div className="mt-2"><Label htmlFor="c-notes" optional>Note pour la boutique</Label><textarea id="c-notes" rows={3} maxLength={500} className={`${inputCls} h-auto py-3`} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
                </div>
              )}

              {step === 3 && (
                <div className="mt-6 grid gap-4">
                  {[
                    { title: "Coordonnées", body: `${customer.firstName} ${customer.lastName} · ${customer.phone}${customer.email ? ` · ${customer.email}` : ""}`, to: 0 },
                    { title: method === "pickup" ? "Retrait en boutique" : "Livraison", body: method === "pickup" ? quote?.pickup.address ?? "" : `${[address.street, address.neighborhood, address.commune, region].filter(Boolean).join(", ")} — ${zone?.label ?? ""}`, to: 1 },
                    { title: "Paiement", body: chosen?.label ?? "", to: 2 },
                  ].map((b) => (
                    <div key={b.title} className="flex items-start justify-between gap-4 rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-4">
                      <div><p className="text-sm font-semibold">{b.title}</p><p className="mt-0.5 text-sm text-[var(--color-text-muted)]">{b.body}</p></div>
                      <button type="button" onClick={() => go(b.to)} className="text-sm font-semibold text-[var(--color-primary)] underline-offset-4 hover:underline">Modifier</button>
                    </div>
                  ))}
                  {(payment === "manual_wave" || payment === "manual_orange_money") && (
                    <p className="rounded-[var(--radius-lg)] bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)] p-4 text-sm">
                      Après validation, vous verrez le numéro {chosen?.label} et le montant exact à envoyer. Votre commande restera <strong>en attente de paiement</strong> jusqu&apos;à la vérification de votre transfert par la boutique.
                    </p>
                  )}
                  {payment === "cod" && <p className="text-sm text-[var(--color-text-muted)]">Vous payez à la réception. La boutique peut vous appeler pour confirmer.</p>}
                  {submitError && <p role="alert" className="rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] p-3 text-sm font-medium text-[var(--color-danger)]">{submitError}</p>}
                </div>
              )}
            </motion.section>
          </AnimatePresence>

          {/* Barre d'action : fixe au pouce sur mobile, en ligne sur bureau. */}
          <div className="fixed inset-x-0 bottom-0 z-30 flex gap-3 border-t border-[var(--color-border)] bg-[var(--color-background)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 lg:static lg:mt-8 lg:border-0 lg:bg-transparent lg:p-0">
            {step > 0 && (
              <button type="button" onClick={() => go(step - 1)} className="grid h-14 w-14 shrink-0 place-items-center rounded-[var(--radius-full)] ring-1 ring-inset ring-[var(--color-border)] lg:h-12 lg:w-auto lg:px-5" aria-label="Étape précédente">
                <IconArrowLeft size={20} />
              </button>
            )}
            {step < 3 ? (
              <button type="button" onClick={() => go(step + 1)} className="group flex h-14 flex-1 items-center justify-center gap-2 rounded-[var(--radius-full)] bg-[var(--color-primary)] font-semibold text-white transition hover:brightness-110 lg:h-12 lg:flex-none lg:px-8">
                Continuer <IconArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </button>
            ) : (
              <button type="button" onClick={submit} disabled={submitting} aria-busy={submitting} className="flex h-14 flex-1 items-center justify-center gap-2 rounded-[var(--radius-full)] bg-[var(--color-primary)] font-semibold text-white transition hover:brightness-110 disabled:opacity-60 lg:h-12 lg:flex-none lg:px-8">
                {submitting ? "Validation…" : <>Confirmer la commande{estimated !== null && <span className="tabular-nums opacity-80">· {fcfa(estimated)}</span>}</>}
              </button>
            )}
          </div>
        </div>
        <div className="hidden lg:sticky lg:top-24 lg:block lg:self-start">{summary}</div>
      </div>
    </div>
  );
}
