"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/yc/button";
import { IconCheck, IconSparkles, IconX } from "@/components/yc/icons";

export interface ConversationItem {
  jobId: string;
  status: string;
  request: string;
  simulated: boolean;
  applied: boolean;
  error: string | null;
  reply?: string;
  changes?: string[];
  rejected?: string[];
  /** Section sur laquelle l'aperçu de la proposition se positionne. */
  focus?: string | null;
}

export interface SelectedSection {
  id: string;
  label: string;
  images: { field: string; label: string; url: string | null }[];
}

const SUGGESTIONS = [
  "Mets mes nouveautés en premier.",
  "Fais une version plus luxueuse.",
  "Ajoute une galerie de mes produits.",
  "Ajoute un récit qui présente mes pièces.",
  "Une typographie plus moderne.",
  "Des formes plus arrondies.",
  "Plus d'espace entre les sections.",
  "Réduis les animations sur téléphone.",
];
const SELECTED_SUGGESTIONS = ["Remplace ce fond par une couleur crème.", "Centre le texte de cette section.", "Présente-la en carrousel.", "Retire cette section."];

/**
 * Assistant conversationnel : chaque demande produit une PROPOSITION (liste des
 * changements + aperçu), jamais une modification directe ; l'entreprise l'applique ou
 * l'ignore. La section sélectionnée dans l'aperçu donne le contexte (« ce fond ») et
 * permet de remplacer ses images à la main, sans IA.
 */
export function StudioAssistant({
  items,
  available,
  simulated,
  unavailableReason,
  usage,
  busy,
  selected,
  previewJobId,
  onSend,
  onImprove,
  onPreview,
  onApply,
  onClearSelection,
  onReplaceImage,
}: {
  items: ConversationItem[];
  available: boolean;
  simulated: boolean;
  unavailableReason: string | null;
  usage: { used: number; limit: number | null };
  busy: boolean;
  selected: SelectedSection | null;
  previewJobId: string | null;
  onSend: (message: string) => void;
  onImprove: () => void;
  onPreview: (jobId: string | null) => void;
  onApply: (jobId: string) => void;
  onClearSelection: () => void;
  onReplaceImage: (sectionId: string, field: string) => void;
}) {
  const [message, setMessage] = useState("");
  const list = useRef<HTMLOListElement>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [items.length, busy]);
  const quotaReached = usage.limit !== null && usage.used >= usage.limit;
  const disabled = !available || busy || quotaReached;
  const send = (text: string) => {
    const value = text.trim();
    if (!value || disabled) return;
    onSend(value);
    setMessage("");
  };

  return (
    <section aria-labelledby="assistant" className="flex h-full min-h-[420px] flex-col overflow-hidden rounded-2xl bg-white shadow-yc ring-1 ring-yc-ink/[0.06]">
      <header className="flex items-center justify-between gap-3 border-b border-yc-ink/[0.06] px-5 py-4">
        <div>
          <h2 id="assistant" className="flex items-center gap-2 text-[15px] font-semibold text-yc-ink"><IconSparkles size={16} className="text-yc-electric" /> Assistant</h2>
          <p className="text-[12px] text-yc-ink-soft">{usage.limit === null ? `${usage.used} demande${usage.used > 1 ? "s" : ""} ce mois` : `${usage.used} / ${usage.limit} demandes ce mois`}</p>
        </div>
        {simulated && <span className="rounded-full bg-yc-warning/[0.14] px-2.5 py-1 text-[11px] font-semibold text-[rgb(146_84_0)]" title="Le fournisseur IA n'est pas configuré : réponses produites par des règles locales de développement.">Simulation</span>}
      </header>

      {selected && (
        <div className="border-b border-yc-ink/[0.06] bg-yc-electric/[0.04] px-5 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-[13px] text-yc-ink"><span className="text-yc-ink-soft">Section : </span><span className="font-semibold">{selected.label}</span></p>
            <button type="button" onClick={onClearSelection} aria-label="Désélectionner la section" className="grid h-8 w-8 place-items-center rounded-full text-yc-ink-soft hover:bg-yc-ink/5"><IconX size={14} /></button>
          </div>
          {selected.images.length > 0 && (
            <ul className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {selected.images.map((img) => (
                <li key={img.field} className="shrink-0">
                  <button type="button" onClick={() => onReplaceImage(selected.id, img.field)} className="group flex w-[112px] flex-col gap-1 text-left" title={`Remplacer : ${img.label}`}>
                    <span className="relative block h-16 w-full overflow-hidden rounded-lg bg-yc-ink/[0.06] ring-1 ring-yc-ink/10">
                      {img.url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img.url} alt="" className="h-full w-full object-cover" />
                      )}
                      <span className="absolute inset-0 grid place-items-center bg-yc-night-950/0 text-[11px] font-semibold text-white opacity-0 transition group-hover:bg-yc-night-950/55 group-hover:opacity-100 group-focus-visible:bg-yc-night-950/55 group-focus-visible:opacity-100">Remplacer</span>
                    </span>
                    <span className="truncate text-[11px] text-yc-ink-soft">{img.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ol ref={list} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4" aria-live="polite">
        {items.length === 0 && (
          <li className="rounded-xl bg-yc-ivory-50 p-4 text-[13px] leading-relaxed text-yc-ink-soft">
            Demandez une modification en une phrase. Je vous montre la proposition dans l&apos;aperçu ; rien ne change tant que vous ne l&apos;appliquez pas. Cliquez une section de l&apos;aperçu pour la désigner.
          </li>
        )}
        {items.map((item) => {
          const hasChanges = Boolean(item.changes?.length);
          const previewing = previewJobId === item.jobId;
          return (
            <li key={item.jobId} className="grid gap-2">
              <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-yc-night-900 px-3.5 py-2 text-[14px] text-white">{item.request}</p>
              {item.status === "failed" ? (
                <p className="max-w-[92%] rounded-2xl rounded-bl-md bg-yc-danger/[0.08] px-3.5 py-2 text-[13px] text-yc-danger">{item.error ?? "La demande a échoué."} Votre site n&apos;a pas été modifié.</p>
              ) : item.status !== "completed" ? (
                <p className="text-[13px] text-yc-ink-soft">En cours…</p>
              ) : (
                <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-[#F3F4F8] px-3.5 py-3 text-[14px] text-yc-ink">
                  <p className="leading-relaxed">{item.reply}</p>
                  {item.simulated && <p className="mt-1.5 text-[11px] font-semibold text-[rgb(146_84_0)]">Réponse simulée (règles locales), pas une génération IA</p>}
                  {hasChanges && (
                    <ul className="mt-2.5 grid gap-1 text-[13px]">
                      {item.changes!.map((c) => (
                        <li key={c} className="flex gap-1.5"><IconCheck size={14} className="mt-0.5 shrink-0 text-yc-success" /> {c}</li>
                      ))}
                    </ul>
                  )}
                  {Boolean(item.rejected?.length) && (
                    <details className="mt-2 text-[12px] text-yc-ink-soft">
                      <summary className="cursor-pointer">Non retenu ({item.rejected!.length})</summary>
                      <ul className="mt-1 grid gap-1 pl-4">{item.rejected!.map((r) => <li key={r} className="list-disc">{r}</li>)}</ul>
                    </details>
                  )}
                  {hasChanges && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {item.applied ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-yc-success/12 px-2.5 py-1 text-[12px] font-semibold text-yc-success"><IconCheck size={12} /> Appliqué au brouillon</span>
                      ) : dismissed.has(item.jobId) ? (
                        <span className="text-[12px] text-yc-ink-soft">Ignorée</span>
                      ) : (
                        <>
                          <Button size="sm" onClick={() => onApply(item.jobId)} disabled={busy}>Appliquer</Button>
                          <Button size="sm" variant="secondary" onClick={() => onPreview(previewing ? null : item.jobId)} aria-pressed={previewing}>{previewing ? "Voir le brouillon" : "Aperçu"}</Button>
                          <Button size="sm" variant="ghost" onClick={() => { setDismissed(new Set([...dismissed, item.jobId])); if (previewing) onPreview(null); }}>Ignorer</Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
        {busy && (
          <li className="flex items-center gap-2 text-[13px] text-yc-ink-soft">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-yc-ink/15 border-t-yc-electric" aria-hidden="true" /> Génération en cours…
          </li>
        )}
      </ol>

      <div className="border-t border-yc-ink/[0.06] p-4">
        {!available && <p className="mb-3 rounded-xl bg-yc-warning/[0.12] px-3 py-2 text-[13px] text-yc-ink">{unavailableReason ?? "Assistant indisponible."}</p>}
        {quotaReached && <p className="mb-3 rounded-xl bg-yc-warning/[0.12] px-3 py-2 text-[13px] text-yc-ink">Quota IA du mois atteint. Vous pouvez toujours modifier le site à la main (réglages avancés, éditeur).</p>}
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          <button type="button" disabled={disabled} onClick={onImprove} className="shrink-0 whitespace-nowrap rounded-full bg-yc-electric/10 px-3 py-2 text-[13px] font-semibold text-yc-electric hover:bg-yc-electric/15 disabled:opacity-40">Améliorer mon site avec l&apos;IA</button>
          {(selected ? SELECTED_SUGGESTIONS : SUGGESTIONS).map((s) => (
            <button key={s} type="button" disabled={disabled} onClick={() => send(s)} className="shrink-0 whitespace-nowrap rounded-full bg-white px-3 py-2 text-[13px] text-yc-ink ring-1 ring-inset ring-yc-ink/12 hover:ring-yc-ink/30 disabled:opacity-40">{s}</button>
          ))}
        </div>
        <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); send(message); }}>
          <label className="sr-only" htmlFor="assistant-message">Votre demande</label>
          <textarea
            id="assistant-message"
            rows={2}
            maxLength={500}
            value={message}
            disabled={disabled}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(message); } }}
            placeholder={selected ? "Que changer dans cette section ?" : "Ex. : mets la vitrine juste après l'ouverture"}
            className="min-h-11 flex-1 resize-none rounded-xl bg-[#F6F7FB] px-3.5 py-2.5 text-[15px] text-yc-ink placeholder:text-yc-ink-soft/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-yc-electric disabled:opacity-60"
          />
          <Button type="submit" disabled={disabled || !message.trim()} aria-label="Envoyer">Envoyer</Button>
        </form>
      </div>
    </section>
  );
}
