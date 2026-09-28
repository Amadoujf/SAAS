"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MenuDish, MenuSectionData } from "@/lib/restaurant/restaurant-data";
import { BADGE_LABELS, clockLabel, formatXof } from "@/lib/restaurant/labels";

interface CartLine {
  key: string;
  dishId: string;
  quantity: number;
  optionIds: string[];
  note: string;
}

export interface MenuOrderProps {
  storageKey: string;
  sections: MenuSectionData[];
  service: { open: boolean; minute: number; closesAt: number | null; next: { date: string; minute: number } | null; today: string; pickup: { minute: number; at: string }[] };
  rules: { acceptTakeaway: boolean; acceptDelivery: boolean; acceptDineInQr: boolean; deliveryFee: number; minDeliveryOrder: number; prepMinutes: number };
  table: { label: string; qrToken: string } | null;
  payWays: string[];
}

const inWindow = (s: MenuSectionData, minute: number) => !s.window || (minute >= s.window.from && minute < s.window.to);
const lineKey = (dishId: string, optionIds: string[], note: string) => `${dishId}|${[...optionIds].sort().join(",")}|${note}`;

/**
 * Carte et commande : rubriques en onglets collants, plats avec options, panier toujours
 * à portée du pouce. Les montants affichés sont indicatifs : le serveur recalcule chaque
 * ligne depuis la carte à l'envoi (aucun prix n'est transmis).
 */
export function MenuOrder({ storageKey, sections, service, rules, table, payWays }: MenuOrderProps) {
  const router = useRouter();
  const dishes = useMemo(() => new Map(sections.flatMap((s) => s.dishes.map((d) => [d.id, { dish: d, section: s }] as const))), [sections]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sheet, setSheet] = useState<MenuDish | null>(null);
  const [checkout, setCheckout] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [active, setActive] = useState(sections[0]?.id ?? "");
  const tabsRef = useRef<HTMLDivElement>(null);

  const canDineIn = !!table && rules.acceptDineInQr && service.open;
  const remoteModes = [rules.acceptTakeaway && "takeaway", rules.acceptDelivery && "delivery"].filter(Boolean) as ("takeaway" | "delivery")[];
  const canOrder = table ? canDineIn : remoteModes.length > 0 && (service.open || service.pickup.length > 0);

  // Panier conservé sur cet appareil (confort) ; relu contre la carte du moment.
  useEffect(() => {
    try {
      const raw = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]") as CartLine[];
      if (Array.isArray(raw)) setCart(raw.filter((l) => l && dishes.has(l.dishId) && Number.isInteger(l.quantity) && l.quantity > 0).slice(0, 40));
    } catch {
      /* stockage indisponible : panier vide */
    }
    setLoaded(true);
  }, [storageKey, dishes]);
  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(cart));
    } catch {
      /* stockage indisponible */
    }
  }, [cart, loaded, storageKey]);
  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 1800);
    return () => window.clearTimeout(t);
  }, [flash]);

  // Onglet actif = rubrique visible.
  useEffect(() => {
    const els = sections.map((s) => document.getElementById(`rubrique-${s.id}`)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver((entries) => {
      const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (top) setActive(top.target.id.replace("rubrique-", ""));
    }, { rootMargin: "-140px 0px -60% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [sections]);
  useEffect(() => {
    tabsRef.current?.querySelector(`[data-tab="${active}"]`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [active]);

  const unitOf = (l: Pick<CartLine, "dishId" | "optionIds">) => {
    const d = dishes.get(l.dishId)?.dish;
    if (!d) return 0;
    return d.price + d.groups.flatMap((g) => g.options).filter((o) => l.optionIds.includes(o.id)).reduce((s, o) => s + o.priceDelta, 0);
  };
  const count = cart.reduce((s, l) => s + l.quantity, 0);
  const subtotal = cart.reduce((s, l) => s + unitOf(l) * l.quantity, 0);

  const add = (dishId: string, optionIds: string[], quantity: number, note: string) => {
    const key = lineKey(dishId, optionIds, note);
    setCart((c) => {
      const found = c.find((l) => l.key === key);
      return found ? c.map((l) => (l.key === key ? { ...l, quantity: Math.min(50, l.quantity + quantity) } : l)) : [...c, { key, dishId, optionIds, quantity, note }];
    });
    setFlash(`${dishes.get(dishId)?.dish.name ?? "Plat"} ajouté`);
  };

  return (
    <>
      <div className="sticky top-[68px] z-30 border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-background)_96%,transparent)] backdrop-blur">
        <div ref={tabsRef} role="tablist" aria-label="Rubriques de la carte" className="mx-auto flex max-w-[var(--content-max-width,1240px)] gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] sm:px-8">
          {sections.map((s) => (
            <a
              key={s.id}
              data-tab={s.id}
              role="tab"
              aria-selected={active === s.id}
              href={`#rubrique-${s.id}`}
              className={`shrink-0 rounded-full px-4 py-2 text-[14px] font-semibold transition-colors ${active === s.id ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"}`}
            >
              {s.name}
            </a>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-[var(--content-max-width,1240px)] px-4 pb-40 sm:px-8">
        {!canOrder && (
          <p className="mt-6 rounded-[var(--radius-md)] bg-[var(--color-surface)] px-4 py-3 text-[15px]">
            {table && !rules.acceptDineInQr
              ? "La commande à table est fermée : adressez-vous au personnel."
              : service.next
                ? `Fermé pour le moment : nous rouvrons ${service.next.date === service.today ? "aujourd'hui" : "prochainement"} à ${clockLabel(service.next.minute)}. Vous pouvez consulter la carte.`
                : "Les commandes en ligne sont fermées pour le moment. Vous pouvez consulter la carte."}
          </p>
        )}
        {sections.map((s) => {
          const served = inWindow(s, service.minute);
          return (
            <section key={s.id} id={`rubrique-${s.id}`} aria-labelledby={`t-${s.id}`} className="scroll-mt-[140px] pt-10">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 id={`t-${s.id}`} className="font-[family-name:var(--font-heading)] text-[34px] uppercase leading-none tracking-[-0.01em] sm:text-[44px]">{s.name}</h2>
                {s.window && <p className={`text-[13px] font-semibold ${served ? "text-[var(--color-text-muted)]" : "text-[var(--color-accent-secondary)]"}`}>Servi de {clockLabel(s.window.from)} à {clockLabel(s.window.to)}</p>}
              </div>
              {s.description && <p className="mt-2 max-w-2xl text-[15px] text-[var(--color-text-secondary)]">{s.description}</p>}
              <ul className="mt-5 grid gap-3 md:grid-cols-2">
                {s.dishes.map((d) => {
                  const addable = canOrder && served && d.isAvailable;
                  return (
                    <li key={d.id} className={`flex gap-4 rounded-[var(--radius-lg)] bg-white p-3.5 ring-1 ring-[var(--color-border)] sm:p-4 ${d.isAvailable ? "" : "opacity-55"}`}>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex flex-wrap gap-1.5">
                          {d.badges.map((b) => (
                            <span key={b} className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.08em] ${b === "spicy" ? "bg-[color-mix(in_srgb,var(--color-accent-secondary)_14%,white)] text-[var(--color-accent-secondary)]" : b === "signature" ? "bg-[var(--color-primary)] text-[var(--color-accent-primary)]" : "bg-[var(--color-surface)] text-[var(--color-text-secondary)]"}`}>{BADGE_LABELS[b] ?? b}</span>
                          ))}
                          {!d.isAvailable && <span className="rounded-full bg-[var(--color-text-primary)] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-white">Épuisé</span>}
                        </div>
                        <h3 className="mt-1.5 text-[17px] font-bold leading-snug">{d.name}</h3>
                        {d.description && <p className="mt-1 line-clamp-2 text-[14px] leading-snug text-[var(--color-text-secondary)]">{d.description}</p>}
                        <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                          <p className="yc-num text-[16px] font-bold">{formatXof(d.price)}{d.groups.some((g) => g.options.some((o) => o.priceDelta > 0)) && <span className="ml-1 text-[12px] font-medium text-[var(--color-text-muted)]">et +</span>}</p>
                          {addable && (
                            <button
                              type="button"
                              aria-label={`Ajouter ${d.name}`}
                              onClick={() => (d.groups.length ? setSheet(d) : add(d.id, [], 1, ""))}
                              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--color-accent-primary)] text-[var(--color-primary)] transition-transform hover:scale-105 active:scale-95"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                            </button>
                          )}
                        </div>
                      </div>
                      {d.imageUrl && (
                        <div className="relative h-[104px] w-[104px] shrink-0 overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-surface)] sm:h-[124px] sm:w-[124px]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={d.imageUrl} alt={d.name} loading="lazy" className="h-full w-full object-cover" />
                          {d.imageDemo && <span className="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-center text-[8.5px] font-semibold uppercase tracking-[0.1em] text-white">Illustration</span>}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <p aria-live="polite" className={`pointer-events-none fixed inset-x-0 bottom-24 z-40 mx-auto w-max rounded-full bg-[var(--color-primary)] px-4 py-2 text-[13px] font-semibold text-white shadow-lg transition-opacity ${flash ? "opacity-100" : "opacity-0"}`}>{flash ?? ""}</p>

      {count > 0 && !checkout && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
          <button type="button" onClick={() => setCheckout(true)} className="mx-auto flex h-14 w-full max-w-xl items-center justify-between gap-3 rounded-full bg-[var(--color-primary)] pl-6 pr-2 text-white shadow-[var(--shadow-lg)]">
            <span className="text-[15px] font-bold">Ma commande · {count} article{count > 1 ? "s" : ""}</span>
            <span className="yc-num rounded-full bg-[var(--color-accent-primary)] px-4 py-2.5 text-[15px] font-bold text-[var(--color-primary)]">{formatXof(subtotal)}</span>
          </button>
        </div>
      )}

      {sheet && <DishSheet dish={sheet} onClose={() => setSheet(null)} onAdd={(ids, qty, note) => { add(sheet.id, ids, qty, note); setSheet(null); }} />}
      {checkout && (
        <Checkout
          lines={cart.map((l) => {
            const d = dishes.get(l.dishId)!.dish;
            return { ...l, name: d.name, unit: unitOf(l), options: d.groups.flatMap((g) => g.options).filter((o) => l.optionIds.includes(o.id)).map((o) => o.name) };
          })}
          subtotal={subtotal}
          table={table}
          service={service}
          rules={rules}
          modes={remoteModes}
          payWays={payWays}
          onQty={(key, q) => setCart((c) => (q <= 0 ? c.filter((l) => l.key !== key) : c.map((l) => (l.key === key ? { ...l, quantity: Math.min(50, q) } : l))))}
          onClose={() => setCheckout(false)}
          onDone={(url) => {
            setCart([]);
            try {
              window.localStorage.removeItem(storageKey);
            } catch {
              /* stockage indisponible */
            }
            router.push(url);
          }}
        />
      )}
    </>
  );
}

function useDialog(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  // Une seule fois à l'ouverture : focus initial, Échap, défilement bloqué.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close.current();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLElement>("button, input, select, textarea")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, []);
  return ref;
}

/** Choix des options d'un plat : bornes de chaque groupe respectées avant l'ajout. */
function DishSheet({ dish, onClose, onAdd }: { dish: MenuDish; onClose: () => void; onAdd: (optionIds: string[], quantity: number, note: string) => void }) {
  const ref = useDialog(onClose);
  const [picked, setPicked] = useState<Record<string, string[]>>(() => Object.fromEntries(dish.groups.map((g) => [g.id, g.min === 1 && g.max === 1 ? [g.options.find((o) => o.isAvailable)?.id].filter(Boolean) as string[] : []])));
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const all = Object.values(picked).flat();
  const unit = dish.price + dish.groups.flatMap((g) => g.options).filter((o) => all.includes(o.id)).reduce((s, o) => s + o.priceDelta, 0);
  const missing = dish.groups.find((g) => (picked[g.id]?.length ?? 0) < g.min);
  const toggle = (gid: string, oid: string, single: boolean, max: number) =>
    setPicked((p) => {
      const cur = p[gid] ?? [];
      if (single) return { ...p, [gid]: [oid] };
      if (cur.includes(oid)) return { ...p, [gid]: cur.filter((x) => x !== oid) };
      return cur.length >= max ? p : { ...p, [gid]: [...cur, oid] };
    });
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--color-overlay)] sm:items-center" onClick={onClose}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="plat-titre" onClick={(e) => e.stopPropagation()} className="flex max-h-[92svh] w-full max-w-lg flex-col overflow-hidden rounded-t-[var(--radius-lg)] bg-[var(--color-background)] sm:rounded-[var(--radius-lg)]">
        {dish.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dish.imageUrl} alt={dish.name} className="h-44 w-full shrink-0 object-cover sm:h-52" />
        )}
        <div className="overflow-y-auto px-5 pb-4 pt-5">
          <div className="flex items-start justify-between gap-4">
            <h2 id="plat-titre" className="font-[family-name:var(--font-heading)] text-[28px] uppercase leading-none">{dish.name}</h2>
            <button type="button" onClick={onClose} aria-label="Fermer" className="-mr-2 -mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-[var(--color-surface)]">
              <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
          {dish.description && <p className="mt-2 text-[15px] text-[var(--color-text-secondary)]">{dish.description}</p>}
          {dish.groups.map((g) => {
            const single = g.max === 1;
            const cur = picked[g.id] ?? [];
            return (
              <fieldset key={g.id} className="mt-6 min-w-0">
                <legend className="flex w-full items-baseline justify-between gap-3">
                  <span className="text-[16px] font-bold">{g.name}</span>
                  <span className={`text-[12px] font-semibold ${cur.length < g.min ? "text-[var(--color-accent-secondary)]" : "text-[var(--color-text-muted)]"}`}>{g.min > 0 ? (single ? "Obligatoire" : `${g.min} à ${g.max} choix`) : `Facultatif · ${g.max} au plus`}</span>
                </legend>
                <div className="mt-2 grid gap-1.5">
                  {g.options.map((o) => {
                    const on = cur.includes(o.id);
                    return (
                      <label key={o.id} className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-[var(--radius-md)] px-3.5 ring-1 ring-inset ${on ? "bg-white ring-2 ring-[var(--color-primary)]" : "bg-white ring-[var(--color-border)]"} ${o.isAvailable ? "" : "cursor-not-allowed opacity-50"}`}>
                        <input type={single ? "radio" : "checkbox"} name={g.id} checked={on} disabled={!o.isAvailable || (!on && !single && cur.length >= g.max)} onChange={() => toggle(g.id, o.id, single, g.max)} className="h-4.5 w-4.5 accent-[var(--color-primary)]" />
                        <span className="flex-1 text-[15px]">{o.name}{!o.isAvailable && " · épuisé"}</span>
                        {o.priceDelta > 0 && <span className="yc-num text-[14px] text-[var(--color-text-secondary)]">+{formatXof(o.priceDelta)}</span>}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
          <label className="mt-6 block text-[14px] font-semibold">
            Une précision pour la cuisine <span className="font-normal text-[var(--color-text-muted)]">(facultatif)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Sans oignons, bien cuit…" className="mt-1.5 h-12 w-full rounded-[var(--radius-md)] bg-white px-3.5 text-[15px] font-normal ring-1 ring-inset ring-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
          </label>
        </div>
        <div className="flex items-center gap-3 border-t border-[var(--color-border)] px-5 py-4">
          <div className="flex items-center rounded-full bg-[var(--color-surface)]">
            <button type="button" aria-label="Retirer un" onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid h-11 w-11 place-items-center text-xl font-bold">−</button>
            <span className="yc-num w-6 text-center text-[16px] font-bold" aria-live="polite">{qty}</span>
            <button type="button" aria-label="Ajouter un" onClick={() => setQty((q) => Math.min(50, q + 1))} className="grid h-11 w-11 place-items-center text-xl font-bold">+</button>
          </div>
          <button type="button" disabled={!!missing} onClick={() => onAdd(all, qty, note.trim())} className="flex h-12 flex-1 items-center justify-between gap-2 rounded-full bg-[var(--color-primary)] px-5 text-[15px] font-bold text-white disabled:opacity-50">
            <span>{missing ? `Choisissez : ${missing.name}` : "Ajouter"}</span>
            <span className="yc-num">{formatXof(unit * qty)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface CheckoutLine {
  key: string;
  dishId: string;
  name: string;
  quantity: number;
  unit: number;
  options: string[];
  optionIds: string[];
  note: string;
}

function Checkout({ lines, subtotal, table, service, rules, modes, payWays, onQty, onClose, onDone }: {
  lines: CheckoutLine[];
  subtotal: number;
  table: MenuOrderProps["table"];
  service: MenuOrderProps["service"];
  rules: MenuOrderProps["rules"];
  modes: ("takeaway" | "delivery")[];
  payWays: string[];
  onQty: (key: string, q: number) => void;
  onClose: () => void;
  onDone: (url: string) => void;
}) {
  const ref = useDialog(onClose);
  const [mode, setMode] = useState<"dine_in" | "takeaway" | "delivery">(table ? "dine_in" : modes[0] ?? "takeaway");
  const [when, setWhen] = useState<string>(service.open ? "" : service.pickup[0]?.at ?? "");
  const [f, setF] = useState({ firstName: "", phone: "", address: "", note: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!lines.length) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines.length]);
  const fee = mode === "delivery" ? rules.deliveryFee : 0;
  const underMin = mode === "delivery" && subtotal < rules.minDeliveryOrder;
  const field = "mt-1.5 h-12 w-full rounded-[var(--radius-md)] bg-white px-3.5 text-[15px] font-normal ring-1 ring-inset ring-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]";
  const submit = async () => {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/storefront/restaurant/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode,
          tableQrToken: table?.qrToken ?? null,
          items: lines.map((l) => ({ dishId: l.dishId, quantity: l.quantity, optionIds: l.optionIds, note: l.note })),
          firstName: f.firstName,
          phone: f.phone,
          requestedFor: mode === "dine_in" || !when ? null : when,
          deliveryAddress: f.address,
          note: f.note,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { data?: { url: string }; error?: string };
      if (!res.ok || !json.data) throw new Error(json.error ?? "Commande impossible pour le moment.");
      onDone(json.data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Commande impossible pour le moment.");
      setPending(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[var(--color-overlay)]" onClick={onClose}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="commande-titre" onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-md flex-col bg-[var(--color-background)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h2 id="commande-titre" className="font-[family-name:var(--font-heading)] text-[26px] uppercase leading-none">Ma commande</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="grid h-10 w-10 place-items-center rounded-full hover:bg-[var(--color-surface)]">
            <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <div className="flex-1 overflow-y-auto px-5 pb-6">
            <ul className="divide-y divide-[var(--color-border)]">
              {lines.map((l) => (
                <li key={l.key} className="flex items-start gap-3 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-bold">{l.name}</p>
                    {(l.options.length > 0 || l.note) && <p className="mt-0.5 text-[13px] text-[var(--color-text-secondary)]">{[l.options.join(", "), l.note && `« ${l.note} »`].filter(Boolean).join(" · ")}</p>}
                    <p className="yc-num mt-1 text-[14px] font-semibold">{formatXof(l.unit * l.quantity)}</p>
                  </div>
                  <div className="flex items-center rounded-full bg-[var(--color-surface)]">
                    <button type="button" aria-label={`Retirer un ${l.name}`} onClick={() => onQty(l.key, l.quantity - 1)} className="grid h-9 w-9 place-items-center text-lg font-bold">−</button>
                    <span className="yc-num w-5 text-center text-[14px] font-bold">{l.quantity}</span>
                    <button type="button" aria-label={`Ajouter un ${l.name}`} onClick={() => onQty(l.key, l.quantity + 1)} className="grid h-9 w-9 place-items-center text-lg font-bold">+</button>
                  </div>
                </li>
              ))}
            </ul>

            {table ? (
              <p className="mt-4 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 py-3 text-[15px] font-semibold text-white">Sur place · table {table.label}</p>
            ) : (
              modes.length > 1 && (
                <div role="radiogroup" aria-label="Mode" className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-[var(--color-surface)] p-1">
                  {modes.map((m) => (
                    <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={`h-11 rounded-full text-[14px] font-bold ${mode === m ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-secondary)]"}`}>{m === "takeaway" ? "À emporter" : "Livraison"}</button>
                  ))}
                </div>
              )
            )}

            <div className="mt-5 grid gap-4">
              {mode !== "dine_in" && (
                <label className="block text-[14px] font-semibold">
                  {mode === "delivery" ? "Heure de livraison souhaitée" : "Heure de retrait"}
                  <select value={when} onChange={(e) => setWhen(e.target.value)} className={field}>
                    {service.open && <option value="">Dès que possible (environ {rules.prepMinutes} min)</option>}
                    {service.pickup.map((s) => <option key={s.at} value={s.at}>Aujourd&apos;hui à {clockLabel(s.minute)}</option>)}
                  </select>
                </label>
              )}
              <label className="block text-[14px] font-semibold">
                Prénom
                <input required maxLength={80} autoComplete="given-name" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} className={field} />
              </label>
              <label className="block text-[14px] font-semibold">
                Téléphone {mode === "dine_in" && <span className="font-normal text-[var(--color-text-muted)]">(facultatif)</span>}
                <input required={mode !== "dine_in"} type="tel" inputMode="tel" autoComplete="tel" maxLength={20} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="77 123 45 67" className={field} />
              </label>
              {mode === "delivery" && (
                <label className="block text-[14px] font-semibold">
                  Adresse de livraison
                  <textarea required rows={2} maxLength={300} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} placeholder="Quartier, rue, repère (près de…)" className={`${field} h-auto py-3`} />
                </label>
              )}
              <label className="block text-[14px] font-semibold">
                Un mot pour le restaurant <span className="font-normal text-[var(--color-text-muted)]">(facultatif)</span>
                <input maxLength={400} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} className={field} />
              </label>
            </div>
          </div>
          <div className="border-t border-[var(--color-border)] bg-white px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-4">
            <dl className="grid gap-1 text-[14px]">
              <div className="flex justify-between"><dt>Sous-total</dt><dd className="yc-num">{formatXof(subtotal)}</dd></div>
              {mode === "delivery" && <div className="flex justify-between"><dt>Livraison</dt><dd className="yc-num">{formatXof(fee)}</dd></div>}
              <div className="flex justify-between text-[17px] font-bold"><dt>Total</dt><dd className="yc-num">{formatXof(subtotal + fee)}</dd></div>
            </dl>
            <p className="mt-2 text-[12.5px] leading-snug text-[var(--color-text-muted)]">Montant vérifié par le restaurant à l&apos;envoi. Rien n&apos;est débité en ligne : vous réglez {mode === "dine_in" ? "à table" : mode === "delivery" ? "à la livraison" : "au retrait"} ({payWays.join(", ")}).</p>
            {underMin && <p className="mt-2 text-[13px] font-semibold text-[var(--color-accent-secondary)]">Livraison à partir de {formatXof(rules.minDeliveryOrder)} de commande.</p>}
            {error && <p role="alert" className="mt-2 text-[14px] font-semibold text-[var(--color-danger)]">{error}</p>}
            <button type="submit" disabled={pending || underMin} className="mt-3 flex h-14 w-full items-center justify-center rounded-full bg-[var(--color-accent-primary)] text-[16px] font-bold text-[var(--color-primary)] disabled:opacity-50">
              {pending ? "Envoi…" : "Envoyer ma commande"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
