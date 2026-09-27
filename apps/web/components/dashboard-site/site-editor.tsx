"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/yc/button";
import { IconArrowRight, IconCheck, IconPlus, IconX } from "@/components/yc/icons";
import { MediaLibrary } from "@/components/media/media-library";
import type { HomeContent, HeroSlide } from "@/lib/storefront/home-content";
import { contrastRatio, REASSURANCE_ICONS } from "@/lib/storefront/home-content";

export interface EditorTemplate { slug: string; name: string; tagline: string; layout: string; bg: string; ink: string; primary: string; accent: string }
export interface EditorProduct { id: string; name: string; imageUrl: string | null; price: number }
export interface EditorCategory { id: string; name: string }
export interface SiteEditorProps {
  storeUrl: string | null;
  templates: EditorTemplate[];
  products: EditorProduct[];
  categories: EditorCategory[];
  initial: { templatePreference: string; logoUrl: string | null; primaryColor: string | null; accentColor: string | null; content: HomeContent };
}

const input = "h-11 w-full rounded-lg bg-white px-3 text-[15px] ring-1 ring-inset ring-yc-ink/12 focus:outline-none focus:ring-2 focus:ring-yc-electric";
const label = "grid gap-1.5 text-[13px] font-semibold text-yc-ink";
const ICON_LABELS: Record<(typeof REASSURANCE_ICONS)[number], string> = { truck: "Livraison", box: "Colis", card: "Paiement", leaf: "Durable", phone: "Téléphone", shield: "Garantie" };
const uid = () => Math.random().toString(36).slice(2, 10);

type MediaPick = { id: string; altText: string | null; variants?: { key: string }[] };
function mediaUrl(asset: MediaPick, size: "large" | "medium" = "large") {
  const keys = (asset.variants ?? []).map((v) => v.key);
  const variant = keys.includes(size) ? size : keys.includes("medium") ? "medium" : null;
  return `/api/media/${asset.id}/file${variant ? `?variant=${variant}` : ""}`;
}

function Section({ title, description, children, defaultOpen = false }: { title: string; description?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-xl bg-white shadow-[0_1px_2px_rgb(12_22_48/0.04),0_8px_24px_-16px_rgb(12_22_48/0.12)] ring-1 ring-yc-ink/[0.07]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
        <span>
          <span className="block text-[17px] font-bold tracking-[-0.01em]">{title}</span>
          {description && <span className="block text-sm text-yc-ink-soft">{description}</span>}
        </span>
        <span className="text-xl text-yc-electric transition-transform group-open:rotate-45" aria-hidden="true">+</span>
      </summary>
      <div className="border-t border-yc-ink/[0.06] px-5 py-5">{children}</div>
    </details>
  );
}

function ImageField({ value, demo, onPick, onClear, labelText }: { value: string | null; demo?: boolean; onPick: () => void; onClear: () => void; labelText: string }) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <span className="text-[13px] font-semibold">{labelText}</span>
      <div className="flex items-center gap-3">
        <span className="relative grid h-20 w-24 sm:w-28 shrink-0 place-items-center overflow-hidden rounded-lg bg-yc-ivory-100 ring-1 ring-yc-ink/10">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : <span className="text-xs text-yc-ink-soft">Aucune</span>}
          {demo && value && <span className="absolute inset-x-0 bottom-0 bg-yc-warning px-1 py-0.5 text-center text-[10px] font-bold uppercase text-white">Démo</span>}
        </span>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Button type="button" variant="secondary" size="sm" onClick={onPick} className="h-auto min-h-9 !whitespace-normal py-1.5 text-left">{value ? "Remplacer" : "Choisir"} dans la médiathèque</Button>
          {value && <button type="button" onClick={onClear} className="text-left text-xs text-yc-ink-soft underline-offset-2 hover:underline">Retirer</button>}
          {demo && value && <span className="text-xs text-[rgb(146_84_0)]">Visuel de démonstration : remplacez-le par une photo de vos produits.</span>}
        </div>
      </div>
    </div>
  );
}

function ColorField({ labelText, value, onChange, hint }: { labelText: string; value: string | null; onChange: (v: string | null) => void; hint: string }) {
  const ratio = value && /^#[0-9a-fA-F]{6}$/.test(value) ? contrastRatio(value, "#FFFFFF") : null;
  const ok = ratio === null || ratio >= 4.5;
  return (
    <div className="grid gap-1.5">
      <span className="text-[13px] font-semibold">{labelText}</span>
      <div className="flex items-center gap-2">
        <input type="color" aria-label={`${labelText} (sélecteur)`} value={value ?? "#10224F"} onChange={(e) => onChange(e.target.value.toUpperCase())} className="h-11 w-14 cursor-pointer rounded-lg ring-1 ring-yc-ink/12" />
        <input value={value ?? ""} placeholder="Couleur du template" onChange={(e) => onChange(e.target.value || null)} aria-label={labelText} className={`${input} max-w-[160px] font-mono`} />
        {value && <button type="button" onClick={() => onChange(null)} className="text-xs text-yc-ink-soft hover:underline">Réinitialiser</button>}
      </div>
      <span className={`text-xs ${ok ? "text-yc-ink-soft" : "font-semibold text-yc-danger"}`}>{ok ? hint : "Trop claire : le texte blanc des boutons ne serait pas lisible (contraste insuffisant)."}</span>
    </div>
  );
}

function move<T>(list: T[], i: number, d: number) {
  const next = [...list];
  const j = i + d;
  if (j < 0 || j >= next.length) return list;
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

/** Éditeur « Mon site » : template, identité, carrousel, univers, produits en vedette,
 *  collections, bandeau et engagements. Tout est revalidé par le serveur. */
export function SiteEditor({ storeUrl, templates, products, categories, initial }: SiteEditorProps) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [picker, setPicker] = useState<null | { size: "large" | "medium"; apply: (url: string, alt: string) => void }>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const content = state.content;
  const setContent = (patch: Partial<HomeContent>) => setState((s) => ({ ...s, content: { ...s.content, ...patch } }));
  // Mises à jour FONCTIONNELLES : un choix fait dans la médiathèque (fenêtre ouverte
  // plus tôt) ne doit jamais écraser une modification faite entre-temps.
  const setSlide = (i: number, patch: Partial<HeroSlide>) =>
    setState((st) => ({ ...st, content: { ...st.content, hero: { ...st.content.hero, slides: st.content.hero.slides.map((x, j) => (j === i ? { ...x, ...patch } : x)) } } }));
  const setCollection = (i: number, patch: Partial<HomeContent["collections"][number]>) =>
    setState((st) => ({ ...st, content: { ...st.content, collections: st.content.collections.map((x, j) => (j === i ? { ...x, ...patch } : x)) } }));
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const demoCount = [...content.hero.slides.filter((s) => s.demo && s.imageUrl), ...content.collections.filter((c) => c.demo && c.imageUrl)].length;

  async function save() {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/dashboard/site", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(state) });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (res.ok) {
      setMessage({ ok: true, text: "Enregistré : votre boutique est à jour." });
      router.refresh();
    } else setMessage({ ok: false, text: json.error ?? "Enregistrement impossible." });
  }

  return (
    <div className="flex flex-col gap-4 pb-24">
      {demoCount > 0 && (
        <p role="status" className="rounded-xl bg-yc-warning/[0.12] px-4 py-3 text-sm">
          <strong>{demoCount} visuel{demoCount > 1 ? "s" : ""} de démonstration</strong> affiché{demoCount > 1 ? "s" : ""} sur votre boutique. Remplacez-les par des photos représentant fidèlement vos produits.
        </p>
      )}

      <Section title="Template" description="La composition et le style de votre boutique. Vos contenus sont conservés si vous changez." defaultOpen>
        <div role="radiogroup" aria-label="Template" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {templates.map((t) => {
            const active = state.templatePreference === t.slug;
            return (
              <button key={t.slug} type="button" role="radio" aria-checked={active} onClick={() => setState((s) => ({ ...s, templatePreference: t.slug }))}
                className={`overflow-hidden rounded-xl text-left ring-1 ring-inset transition-all ${active ? "ring-2 ring-yc-electric" : "ring-yc-ink/10 hover:ring-yc-ink/30"}`}>
                <span className="flex h-20 items-end gap-1.5 p-3" style={{ background: t.bg, color: t.ink }}>
                  <span className="text-lg font-semibold leading-none" style={{ fontFamily: t.layout === "editorial" ? "Georgia, serif" : "inherit" }}>{t.name}</span>
                  <span className="ml-auto flex gap-1"><span className="h-4 w-4 rounded-full" style={{ background: t.primary }} /><span className="h-4 w-4 rounded-full" style={{ background: t.accent }} /></span>
                </span>
                <span className="flex items-center justify-between bg-white px-3 py-2 text-xs text-yc-ink-soft">{t.tagline}{active && <IconCheck size={14} className="text-yc-electric" />}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Identité" description="Votre logo et vos couleurs, appliqués par-dessus le template.">
        <div className="grid gap-5 lg:grid-cols-3">
          <ImageField labelText="Logo" value={state.logoUrl} onPick={() => setPicker({ size: "medium", apply: (url) => setState((s) => ({ ...s, logoUrl: url })) })} onClear={() => setState((s) => ({ ...s, logoUrl: null }))} />
          <ColorField labelText="Couleur principale" value={state.primaryColor} onChange={(v) => setState((s) => ({ ...s, primaryColor: v }))} hint="Boutons, bandeau, liens forts." />
          <ColorField labelText="Couleur d'accent" value={state.accentColor} onChange={(v) => setState((s) => ({ ...s, accentColor: v }))} hint="Pastilles, promotions, détails." />
        </div>
      </Section>

      <Section title={`Carrousel d'accueil (${content.hero.slides.length})`} description="Chaque diapositive associe un visuel, un texte et, si vous le souhaitez, un produit mis en scène." defaultOpen>
        <label className={`${label} mb-5 max-w-xs`}>Défilement automatique (secondes)
          <input type="number" min={3} max={15} value={content.hero.autoplaySeconds} onChange={(e) => setContent({ hero: { ...content.hero, autoplaySeconds: Math.min(15, Math.max(3, Number(e.target.value) || 6)) } })} className={input} />
        </label>
        <ol className="flex flex-col gap-4">
          {content.hero.slides.map((s, i) => (
            <li key={s.id} className="rounded-xl bg-yc-ivory-50 p-4 ring-1 ring-yc-ink/[0.07]">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-sm font-bold">Diapositive {i + 1}</span>
                <span className="flex gap-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setContent({ hero: { ...content.hero, slides: move(content.hero.slides, i, -1) } })} disabled={i === 0} aria-label="Monter">↑</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setContent({ hero: { ...content.hero, slides: move(content.hero.slides, i, 1) } })} disabled={i === content.hero.slides.length - 1} aria-label="Descendre">↓</Button>
                  <Button type="button" variant="ghost" size="sm" disabled={content.hero.slides.length === 1} onClick={() => setContent({ hero: { ...content.hero, slides: content.hero.slides.filter((_, j) => j !== i) } })} aria-label={`Supprimer la diapositive ${i + 1}`}><IconX size={16} /></Button>
                </span>
              </div>
              <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
                <div className="grid min-w-0 gap-3">
                  <ImageField labelText="Visuel (ordinateur)" value={s.imageUrl} demo={s.demo} onPick={() => setPicker({ size: "large", apply: (url: string, alt: string) => setSlide(i, { imageUrl: url, imageAlt: s.imageAlt || alt, demo: false }) })} onClear={() => setSlide(i, { imageUrl: null, demo: false })} />
                  <ImageField labelText="Visuel mobile (facultatif)" value={s.mobileImageUrl} onPick={() => setPicker({ size: "medium", apply: (url) => setSlide(i, { mobileImageUrl: url }) })} onClear={() => setSlide(i, { mobileImageUrl: null })} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={label}>Sur-titre<input value={s.eyebrow} maxLength={60} onChange={(e) => setSlide(i, { eyebrow: e.target.value })} className={input} /></label>
                  <label className={label}>Titre<input value={s.title} maxLength={90} required onChange={(e) => setSlide(i, { title: e.target.value })} className={input} /></label>
                  <label className={`${label} sm:col-span-2`}>Texte<textarea value={s.subtitle} maxLength={220} rows={2} onChange={(e) => setSlide(i, { subtitle: e.target.value })} className={`${input} h-auto py-2`} /></label>
                  <label className={label}>Bouton<input value={s.ctaLabel} maxLength={40} onChange={(e) => setSlide(i, { ctaLabel: e.target.value })} className={input} placeholder="Découvrir la collection" /></label>
                  <label className={label}>Lien du bouton<input value={s.ctaHref} maxLength={300} onChange={(e) => setSlide(i, { ctaHref: e.target.value })} className={input} placeholder="/catalogue" /></label>
                  <label className={label}>Description de l&apos;image (accessibilité)<input value={s.imageAlt} maxLength={140} onChange={(e) => setSlide(i, { imageAlt: e.target.value })} className={input} /></label>
                  <label className={label}>Produit mis en scène
                    <select value={s.productId ?? ""} onChange={(e) => setSlide(i, { productId: e.target.value || null })} className={input}>
                      <option value="">Aucun</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </label>
                </div>
              </div>
            </li>
          ))}
        </ol>
        {content.hero.slides.length < 6 && (
          <Button type="button" variant="secondary" size="sm" className="mt-4" onClick={() => setContent({ hero: { ...content.hero, slides: [...content.hero.slides, { id: uid(), imageUrl: null, mobileImageUrl: null, imageAlt: "", demo: false, eyebrow: "", title: "Nouvelle diapositive", subtitle: "", ctaLabel: "Découvrir", ctaHref: "/catalogue", theme: "dark", productId: null }] } })}>
            <IconPlus size={16} /> Ajouter une diapositive
          </Button>
        )}
      </Section>

      <Section title="Univers mis en avant" description="Les catégories affichées sur l'accueil, dans l'ordre choisi (8 maximum). Aucune : les 5 premières.">
        <ul className="grid gap-2 sm:grid-cols-2">
          {categories.map((c) => {
            const idx = content.featuredCategoryIds.indexOf(c.id);
            return (
              <li key={c.id}>
                <label className="flex items-center gap-3 rounded-lg bg-yc-ivory-50 px-3 py-2.5 text-sm ring-1 ring-yc-ink/[0.06]">
                  <input type="checkbox" checked={idx >= 0} disabled={idx < 0 && content.featuredCategoryIds.length >= 8}
                    onChange={(e) => setContent({ featuredCategoryIds: e.target.checked ? [...content.featuredCategoryIds, c.id] : content.featuredCategoryIds.filter((id) => id !== c.id) })} />
                  <span className="flex-1">{c.name}</span>
                  {idx >= 0 && <span className="text-xs font-bold text-yc-electric">#{idx + 1}</span>}
                </label>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title={`Produits en vedette (${content.featuredProductIds.length}/12)`} description="Affichés dans l'ordre de sélection, avec aperçu rapide. Aucun : les plus récents.">
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((p) => {
            const idx = content.featuredProductIds.indexOf(p.id);
            return (
              <li key={p.id}>
                <label className="flex items-center gap-3 rounded-lg bg-yc-ivory-50 p-2 text-sm ring-1 ring-yc-ink/[0.06]">
                  <input type="checkbox" checked={idx >= 0} disabled={idx < 0 && content.featuredProductIds.length >= 12}
                    onChange={(e) => setContent({ featuredProductIds: e.target.checked ? [...content.featuredProductIds, p.id] : content.featuredProductIds.filter((id) => id !== p.id) })} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-10 w-10 rounded object-cover" /> : <span className="h-10 w-10 rounded bg-yc-ivory-100" />}
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  {idx >= 0 && <span className="text-xs font-bold text-yc-electric">#{idx + 1}</span>}
                </label>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title={`Collections (${content.collections.length}/4)`} description="Grands blocs visuels menant à une sélection.">
        <ol className="flex flex-col gap-3">
          {content.collections.map((c, i) => (
            <li key={c.id} className="grid gap-3 rounded-xl bg-yc-ivory-50 p-4 ring-1 ring-yc-ink/[0.07] lg:grid-cols-[auto_1fr_auto]">
              <ImageField labelText="Visuel" value={c.imageUrl} demo={c.demo} onPick={() => setPicker({ size: "large", apply: (url) => setCollection(i, { imageUrl: url, demo: false }) })} onClear={() => setCollection(i, { imageUrl: null, demo: false })} />
              <div className="grid gap-3 sm:grid-cols-2">
                {(["eyebrow", "title", "subtitle", "href"] as const).map((k) => (
                  <label key={k} className={label}>{{ eyebrow: "Sur-titre", title: "Titre", subtitle: "Texte", href: "Lien" }[k]}
                    <input value={c[k]} onChange={(e) => setCollection(i, { [k]: e.target.value })} className={input} />
                  </label>
                ))}
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setContent({ collections: content.collections.filter((_, j) => j !== i) })} aria-label={`Supprimer la collection ${i + 1}`}><IconX size={16} /></Button>
            </li>
          ))}
        </ol>
        {content.collections.length < 4 && (
          <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => setContent({ collections: [...content.collections, { id: uid(), eyebrow: "", title: "Nouvelle collection", subtitle: "", imageUrl: null, demo: false, href: "/catalogue" }] })}>
            <IconPlus size={16} /> Ajouter une collection
          </Button>
        )}
      </Section>

      <Section title="Bandeau d'annonce" description="Une courte phrase en haut de toutes les pages (livraison offerte, nouveauté…).">
        <div className="grid gap-3 sm:grid-cols-[1fr_280px]">
          <label className={label}>Texte (vide = pas de bandeau)
            <input value={content.announcement?.text ?? ""} maxLength={120} onChange={(e) => setContent({ announcement: e.target.value ? { text: e.target.value, href: content.announcement?.href ?? "" } : null })} className={input} />
          </label>
          <label className={label}>Lien (facultatif)
            <input value={content.announcement?.href ?? ""} disabled={!content.announcement} onChange={(e) => content.announcement && setContent({ announcement: { ...content.announcement, href: e.target.value } })} className={input} placeholder="/catalogue" />
          </label>
        </div>
      </Section>

      <Section title={`Engagements (${content.reassurance.length}/4)`} description="La bande de réassurance sous le carrousel.">
        <ol className="flex flex-col gap-3">
          {content.reassurance.map((r, i) => (
            <li key={i} className="grid gap-3 sm:grid-cols-[160px_1fr_1fr_auto] sm:items-end">
              <label className={label}>Icône
                <select value={r.icon} onChange={(e) => setContent({ reassurance: content.reassurance.map((x, j) => (j === i ? { ...x, icon: e.target.value as typeof r.icon } : x)) })} className={input}>
                  {REASSURANCE_ICONS.map((ic) => <option key={ic} value={ic}>{ICON_LABELS[ic]}</option>)}
                </select>
              </label>
              <label className={label}>Titre<input value={r.title} maxLength={50} onChange={(e) => setContent({ reassurance: content.reassurance.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} className={input} /></label>
              <label className={label}>Texte<input value={r.text} maxLength={80} onChange={(e) => setContent({ reassurance: content.reassurance.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} className={input} /></label>
              <Button type="button" variant="ghost" size="sm" onClick={() => setContent({ reassurance: content.reassurance.filter((_, j) => j !== i) })} aria-label={`Supprimer l'engagement ${i + 1}`}><IconX size={16} /></Button>
            </li>
          ))}
        </ol>
        {content.reassurance.length < 4 && (
          <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => setContent({ reassurance: [...content.reassurance, { icon: "truck", title: "Nouvel engagement", text: "" }] })}><IconPlus size={16} /> Ajouter</Button>
        )}
      </Section>

      <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 border-t border-yc-ink/10 bg-white/95 backdrop-blur lg:bottom-0 lg:left-[268px]">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-3 px-4 py-3 sm:px-8 max-lg:pb-20">
          {message && <p role={message.ok ? "status" : "alert"} className={`text-sm font-medium ${message.ok ? "text-[rgb(4_120_87)]" : "text-yc-danger"}`}>{message.text}</p>}
          <div className="ml-auto flex gap-2">
            {storeUrl && <a href={storeUrl} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-yc-electric hover:bg-yc-electric/5">Voir ma boutique <IconArrowRight size={16} /></a>}
            <Button type="button" variant="royal" loading={saving} onClick={save} className="rounded-lg">Enregistrer</Button>
          </div>
        </div>
      </div>

      {picker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Médiathèque">
          <div className="max-h-[85vh] w-full max-w-4xl overflow-auto rounded-xl bg-white p-4">
            <MediaLibrary
              apiBase="/api/media"
              onClose={() => setPicker(null)}
              onSelect={(asset) => {
                picker.apply(mediaUrl(asset, picker.size), asset.altText ?? "");
                setPicker(null);
              }}
            />
          </div>
        </div>
      )}
      {productById.size === 0 && <p className="text-sm text-yc-ink-soft">Ajoutez des produits au catalogue pour les mettre en avant.</p>}
    </div>
  );
}
