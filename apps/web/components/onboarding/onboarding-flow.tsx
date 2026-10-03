"use client";

import { usePrefersReducedMotion } from "@/lib/motion/animation-level-context";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { YcLogo } from "@/components/yc/logo";
import { Button } from "@/components/yc/button";
import { Field, Input } from "@/components/yc/field";
import { IconArrowLeft, IconArrowRight, IconCheck, IconGlobe } from "@/components/yc/icons";
import type { OnboardingState } from "@/app/creer-ma-boutique/actions";

export interface SectorOption { key: string; name: string; available: boolean }
export interface TemplateOption { slug: string; name: string; tagline: string; bg: string; ink: string; accent: string; serif: boolean }

const STEP_TITLES = ["Votre compte", "Votre boutique", "Votre secteur", "Votre style"];

function Submit() {
  const { pending } = useFormStatus();
  return <Button type="submit" size="lg" variant="royal" loading={pending} className="rounded-lg">{pending ? "Création en cours…" : "Créer ma boutique"}</Button>;
}

export function OnboardingFlow({
  loggedIn, sectors, templates, plan, action,
}: {
  loggedIn: boolean;
  sectors: SectorOption[];
  templates: TemplateOption[];
  plan: string | null;
  action: (state: OnboardingState, form: FormData) => Promise<OnboardingState>;
}) {
  const reduce = usePrefersReducedMotion();
  const [state, formAction] = useFormState(action, { error: null });
  const first = loggedIn ? 1 : 0;
  const [step, setStep] = useState(first);
  const [dir, setDir] = useState(1);
  const [v, setV] = useState({ fullName: "", email: "", password: "", storeName: "", subdomain: "", sector: "", template: templates[0]?.slug ?? "" });
  const [touchedSub, setTouchedSub] = useState(false);
  const [check, setCheck] = useState<{ available: boolean; message: string | null; suffix: string; suggestions?: string[]; normalized: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Adresse proposée à partir du nom, modifiable ensuite.
  useEffect(() => {
    if (touchedSub) return;
    const slug = v.storeName.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setV((x) => ({ ...x, subdomain: slug }));
  }, [v.storeName, touchedSub]);

  useEffect(() => {
    if (!v.subdomain) { setCheck(null); return; }
    const t = setTimeout(() => {
      fetch(`/api/onboarding/subdomain?value=${encodeURIComponent(v.subdomain)}`).then((r) => r.json()).then(setCheck).catch(() => undefined);
    }, 350);
    return () => clearTimeout(t);
  }, [v.subdomain]);

  useEffect(() => {
    if (!state.error) return;
    const map: Record<string, number> = { email: 0, password: 0, name: first, subdomain: 1, sector: 2 };
    if (state.field && map[state.field] !== undefined) setStep(map[state.field]!);
  }, [state, first]);

  const template = templates.find((t) => t.slug === v.template) ?? templates[0]!;
  const sectorName = sectors.find((s) => s.key === v.sector)?.name;

  function validate(s: number) {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (v.fullName.trim().length < 2) e.fullName = "Indiquez votre nom.";
      if (!/^\S+@\S+\.\S+$/.test(v.email)) e.email = "Adresse e-mail invalide.";
      if (v.password.length < 8) e.password = "8 caractères minimum.";
    }
    if (s === 1) {
      if (v.storeName.trim().length < 2) e.storeName = "Indiquez le nom de votre boutique.";
      if (!check?.available) e.subdomain = check?.message ?? "Choisissez une adresse disponible.";
    }
    if (s === 2 && !v.sector) e.sector = "Choisissez votre secteur.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }
  const go = (to: number) => {
    if (to > step && !validate(step)) return;
    setDir(to > step ? 1 : -1);
    setStep(to);
  };

  const preview = useMemo(() => (
    <div className="relative w-full max-w-[380px] overflow-hidden rounded-xl shadow-[0_50px_120px_-30px_rgb(0_0_0/0.6)] ring-1 ring-white/15 transition-colors duration-500" style={{ background: template.bg, color: template.ink }} aria-hidden="true">
      <div className="flex items-center gap-2 bg-black/5 px-4 py-2.5 text-[11px] opacity-80"><IconGlobe size={12} /><span className="truncate">{(v.subdomain || "votre-boutique")}.{check?.suffix ?? "yamacommerce.ai"}</span></div>
      <div className="p-6">
        <p className={`text-2xl font-semibold tracking-tight ${template.serif ? "font-serif" : "font-display"}`}>{v.storeName || "Votre boutique"}</p>
        <p className="mt-1 text-xs opacity-60">{sectorName ?? "Votre secteur"}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {["boubou", "sac-wax", "bracelet", "huile"].map((i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={`/demo-commerce/${i}.svg`} alt="" className="aspect-[4/5] w-full rounded-xl object-cover" />
          ))}
        </div>
        <div className="mt-5 rounded-full py-2.5 text-center text-xs font-semibold text-white" style={{ background: template.accent }}>Commander</div>
      </div>
    </div>
  ), [template, v.storeName, v.subdomain, sectorName, check]);

  return (
    <div className="grid min-h-screen font-ui lg:grid-cols-[1fr_1.1fr]">
      {/* Aperçu vivant : la boutique se dessine à mesure qu'on la décrit. */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-yc-navy p-10 text-yc-paper lg:flex">
        <Link href="/" className="relative w-fit"><YcLogo tone="light" /></Link>
        <div className="relative flex justify-center">{preview}</div>
        <p className="relative text-sm text-yc-paper/70">Essai gratuit{plan ? ` · formule ${plan}` : ""}. Aucun prélèvement automatique.</p>
      </aside>

      <main className="flex flex-col bg-yc-paper px-4 py-8 text-yc-navy-ink sm:px-10 lg:px-16 lg:py-12">
        <div className="mb-10 flex items-center justify-between lg:hidden"><Link href="/"><YcLogo /></Link></div>
        <ol className="mb-10 grid grid-cols-4 gap-2" aria-label="Étapes">
          {STEP_TITLES.map((t, i) => (
            <li key={t} className={i < first ? "hidden" : ""} aria-current={i === step ? "step" : undefined}>
              <span className="block h-1 overflow-hidden rounded-full bg-yc-ink/10"><span className="block h-full bg-yc-royal transition-all duration-500" style={{ width: i <= step ? "100%" : "0%" }} /></span>
              <span className={`mt-2 hidden text-xs font-semibold sm:block ${i === step ? "text-yc-ink" : "text-yc-ink-soft"}`}>{t}</span>
            </li>
          ))}
        </ol>

        <form action={formAction} className="flex flex-1 flex-col" noValidate>
          {Object.entries(v).map(([k, val]) => <input key={k} type="hidden" name={k} value={val} />)}
          {plan && <input type="hidden" name="plan" value={plan} />}
          <div className="flex-1">
            <AnimatePresence mode="wait" custom={dir} initial={false}>
              <motion.div key={step} initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 40 }} animate={{ opacity: 1, x: 0 }} exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -40 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-yc-ink-soft">Étape {step - first + 1} sur {4 - first}</p>
                <h1 className="mt-3 font-editorial text-[36px] leading-[1.04] sm:text-[46px]">
                  {["Créons votre compte", "Comment s'appelle votre boutique ?", "Que vendez-vous ?", "Quel style vous ressemble ?"][step]}
                </h1>

                {step === 0 && (
                  <div className="mt-8 grid max-w-md gap-4">
                    <Field label="Nom complet" error={errors.fullName}>{(p) => <Input {...p} autoComplete="name" value={v.fullName} onChange={(e) => setV({ ...v, fullName: e.target.value })} />}</Field>
                    <Field label="E-mail" error={errors.email}>{(p) => <Input {...p} type="email" autoComplete="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />}</Field>
                    <Field label="Mot de passe" hint="8 caractères minimum." error={errors.password}>{(p) => <Input {...p} type="password" autoComplete="new-password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} />}</Field>
                    <p className="text-sm text-yc-ink-soft">Déjà un compte ? <Link href="/connexion?suite=/creer-ma-boutique" className="font-semibold text-yc-royal underline-offset-4 hover:underline">Connectez-vous</Link></p>
                  </div>
                )}

                {step === 1 && (
                  <div className="mt-8 grid max-w-md gap-4">
                    <Field label="Nom de la boutique" error={errors.storeName}>{(p) => <Input {...p} value={v.storeName} onChange={(e) => setV({ ...v, storeName: e.target.value })} placeholder="Boutique Aïda" />}</Field>
                    <Field label="Adresse de votre site" error={errors.subdomain} hint={check?.available ? <span className="font-semibold text-[rgb(4_120_87)]">✓ Disponible</span> : check?.message ?? undefined}>
                      {(p) => (
                        <div className="flex items-stretch overflow-hidden rounded-xl bg-white ring-1 ring-inset ring-yc-ink/12 focus-within:ring-2 focus-within:ring-yc-royal">
                          <input {...p} value={v.subdomain} onChange={(e) => { setTouchedSub(true); setV({ ...v, subdomain: e.target.value }); }} className="h-11 min-w-0 flex-1 bg-transparent px-3.5 text-[15px] outline-none" />
                          <span className="flex items-center bg-yc-ivory-100 px-3 text-sm text-yc-ink-soft">.{check?.suffix ?? "yamacommerce.ai"}</span>
                        </div>
                      )}
                    </Field>
                    {check && !check.available && (check.suggestions?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-2">{check.suggestions!.map((s) => <button key={s} type="button" onClick={() => { setTouchedSub(true); setV({ ...v, subdomain: s }); }} className="yc-focus rounded-full bg-white px-3 py-1.5 text-sm font-semibold ring-1 ring-yc-ink/10 hover:ring-yc-royal">{s}</button>)}</div>
                    )}
                    <p className="text-sm text-yc-ink-soft">Vous pourrez connecter votre propre nom de domaine plus tard.</p>
                  </div>
                )}

                {step === 2 && (
                  <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Secteur">
                    {[...sectors].sort((a, b) => Number(b.available) - Number(a.available)).map((s) => (
                      <button key={s.key} type="button" role="radio" aria-checked={v.sector === s.key} aria-disabled={!s.available || undefined}
                        disabled={!s.available} onClick={() => s.available && setV({ ...v, sector: s.key })}
                        className={`yc-focus flex items-center justify-between gap-3 rounded-xl p-4 text-left text-[15px] font-semibold ring-1 ring-inset transition-all duration-300 ${s.available ? "bg-white hover:-translate-y-0.5" : "cursor-not-allowed bg-white/50 text-yc-ink-soft"} ${v.sector === s.key ? "ring-2 ring-yc-royal shadow-yc" : "ring-yc-ink/10"}`}>
                        {s.name}
                        {!s.available && <span className="shrink-0 rounded-full bg-yc-ink/[0.06] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">À venir</span>}
                        {v.sector === s.key && <span className="yc-pop grid h-6 w-6 shrink-0 place-items-center rounded-full bg-yc-royal text-white"><IconCheck size={14} /></span>}
                      </button>
                    ))}
                    {errors.sector && <p role="alert" className="text-sm text-yc-danger sm:col-span-2">{errors.sector}</p>}
                  </div>
                )}

                {step === 3 && (
                  <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Template">
                    {templates.map((t) => (
                      <button key={t.slug} type="button" role="radio" aria-checked={v.template === t.slug} onClick={() => setV({ ...v, template: t.slug })}
                        className={`yc-focus overflow-hidden rounded-xl text-left ring-1 ring-inset transition-all duration-300 hover:-translate-y-0.5 ${v.template === t.slug ? "ring-2 ring-yc-royal shadow-yc-float" : "ring-yc-ink/10"}`}>
                        <span className="block h-24" style={{ background: `linear-gradient(135deg, ${t.bg} 0%, ${t.bg} 45%, ${t.accent} 140%)` }}>
                          <span className={`block p-4 text-lg font-semibold ${t.serif ? "font-serif" : "font-display"}`} style={{ color: t.ink }}>{t.name}</span>
                        </span>
                        <span className="flex items-center justify-between bg-white px-4 py-3 text-sm"><span className="text-yc-ink-soft">{t.tagline}</span>{v.template === t.slug && <IconCheck size={16} className="text-yc-royal" />}</span>
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {state.error && <p role="alert" className="mt-6 rounded-xl bg-yc-danger/[0.07] px-4 py-3 text-sm font-medium text-[rgb(185_28_28)]">{state.error}</p>}

          <div className="mt-10 flex items-center gap-3 border-t border-yc-ink/10 pt-6">
            {step > first && <Button type="button" variant="secondary" size="lg" className="rounded-lg" onClick={() => go(step - 1)} aria-label="Étape précédente"><IconArrowLeft size={18} /></Button>}
            {step < 3 ? (
              <Button type="button" variant="royal" size="lg" className="rounded-lg" onClick={() => go(step + 1)}>Continuer <IconArrowRight size={18} /></Button>
            ) : (
              <Submit />
            )}
          </div>
        </form>
      </main>
    </div>
  );
}
