"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/yc/button";
import { IconSparkles } from "@/components/yc/icons";
import { MediaPickerDialog } from "@/components/media/media-picker-dialog";
import type { loadStudio } from "@/lib/site-ai/pipeline";
import type { SiteBrief } from "@/lib/site-ai/types";
import { StudioPreview, type Device } from "./studio-preview";
import { StudioCreation } from "./studio-creation";
import { StudioComposing } from "./studio-composing";
import { templateFontVariables } from "@/lib/storefront/template-fonts";
import { StudioDirections, type DirectionCard } from "./studio-directions";
import { StudioAssistant, type ConversationItem } from "./studio-assistant";

export type StudioData = NonNullable<Awaited<ReturnType<typeof loadStudio>>>;

async function post<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch("/api/site-ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ...body }) });
  const json = (await res.json().catch(() => ({}))) as { data?: T; error?: string };
  if (!res.ok) throw new Error(json.error ?? "Action impossible. Réessayez.");
  return json.data as T;
}

type Mode = "onboarding" | "directions" | "studio";

function initialMode(s: StudioData): Mode {
  // Site déjà composé (publié, ou direction déjà choisie, ou brouillon retouché) : studio.
  if (s.homeStatus.mode === "editor" || s.directions?.chosen || s.lastRevision) return "studio";
  if (s.directions) return "directions";
  if (s.conversation.length === 0) return "onboarding";
  return "studio";
}

const dateFr = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

/**
 * « Mon site » : point d'entrée de la création et de la personnalisation par IA. Un grand
 * aperçu réel au centre, l'assistant à côté, les états toujours visibles ; la
 * publication reste une action volontaire. Les réglages manuels sont repliés dans
 * « Réglages avancés ».
 */
export function SiteStudio({ initial, canPublish, siteUrl, advanced }: { initial: StudioData; canPublish: boolean; siteUrl: string | null; advanced: ReactNode }) {
  const [studio, setStudio] = useState(initial);
  const [mode, setModeState] = useState<Mode>(() => initialMode(initial));
  // Changer d'étape ramène en haut du studio : chaque étape commence par son titre.
  const setMode = useCallback((next: Mode) => {
    setModeState(next);
    requestAnimationFrame(() => document.getElementById("site-studio")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, []);
  const [device, setDevice] = useState<Device>("desktop");
  // Sur téléphone, l'aperçu montre d'abord le site tel qu'il apparaîtra sur téléphone.
  useEffect(() => {
    if (window.matchMedia?.("(max-width: 767px)").matches) setDevice("phone");
  }, []);
  const [busy, setBusy] = useState<null | "generate" | "write" | "publish">(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewJobId, setPreviewJobId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [picker, setPicker] = useState<null | { kind: "logo" } | { kind: "image"; sectionId: string; field: string }>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/site-ai", { cache: "no-store" });
    const json = (await res.json().catch(() => ({}))) as { data?: StudioData };
    if (json.data) setStudio(json.data);
    return json.data;
  }, []);

  const run = async (kind: "generate" | "write" | "publish", task: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    setNotice(null);
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action impossible.");
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const selected = useMemo(() => {
    const s = studio.draft.sections.find((x) => x.id === selectedId);
    return s ? { id: s.id, label: s.label, images: s.images } : null;
  }, [studio.draft.sections, selectedId]);

  const hs = studio.homeStatus;
  const state =
    busy === "generate"
      ? { tone: "busy", text: "Génération en cours…" }
      : busy === "publish"
        ? { tone: "busy", text: "Publication…" }
        : previewJobId
          ? { tone: "pending", text: "Proposition affichée — pas encore appliquée" }
          : hs.mode === "editor"
            ? hs.pendingChanges
              ? { tone: "pending", text: "Brouillon enregistré — modifications non publiées" }
              : { tone: "live", text: `En ligne${hs.versionNumber ? ` — version ${hs.versionNumber}` : ""}${hs.publishedAt ? `, ${dateFr.format(new Date(hs.publishedAt))}` : ""}` }
            : studio.lastRevision
              ? { tone: "pending", text: "Brouillon enregistré — pas encore en ligne" }
              : { tone: "idle", text: "Accueil standard en ligne" };
  const publishable = !previewJobId && (hs.mode !== "editor" || hs.pendingChanges);

  const generateDirections = (brief: SiteBrief) =>
    run("generate", async () => {
      await post("directions", { ...brief });
      await refresh();
      setMode("directions");
    });

  const applyProposal = (jobId: string) =>
    run("write", async () => {
      const r = await post<{ changes: string[] }>("apply", { jobId });
      setPreviewJobId(null);
      await refresh();
      setNotice(`${r.changes.length} modification${r.changes.length > 1 ? "s" : ""} appliquée${r.changes.length > 1 ? "s" : ""} au brouillon. Annulable tant que rien d'autre ne change.`);
    });

  // Sur téléphone, l'aperçu est au-dessus de la conversation : une proposition y amène.
  const showProposal = (jobId: string | null) => {
    setPreviewJobId(jobId);
    if (jobId && window.matchMedia?.("(max-width: 1279px)").matches) {
      requestAnimationFrame(() => document.getElementById("studio-apercu")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  const aiBlocked = !studio.ai.available ? studio.ai.reason : studio.ai.usage.limit !== null && studio.ai.usage.used >= studio.ai.usage.limit ? "Quota IA du mois atteint." : null;

  return (
    <div id="site-studio" className={`grid scroll-mt-20 gap-5 ${templateFontVariables}`}>
      {/* Barre d'état — toujours visible */}
      <div className="z-20 -mx-4 flex flex-wrap items-center gap-3 md:sticky md:top-16 lg:top-[68px] border-b border-yc-ink/[0.06] bg-[#F6F7FB]/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <span role="status" className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-semibold ${state.tone === "live" ? "bg-yc-success/12 text-yc-success" : state.tone === "busy" ? "bg-yc-electric/10 text-yc-electric" : state.tone === "pending" ? "bg-yc-warning/[0.14] text-[rgb(146_84_0)]" : "bg-yc-ink/[0.06] text-yc-ink-soft"}`}>
          {state.tone === "busy" ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" aria-hidden="true" /> : <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />}
          {state.text}
        </span>
        {mode === "studio" && previewJobId && (
          <span className="hidden items-center gap-2 md:flex">
            <Button size="sm" loading={busy === "write"} onClick={() => applyProposal(previewJobId)}>Appliquer</Button>
            <Button size="sm" variant="ghost" onClick={() => setPreviewJobId(null)}>Revenir au brouillon</Button>
          </span>
        )}
        {mode === "studio" && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl bg-white p-1 ring-1 ring-inset ring-yc-ink/10" role="group" aria-label="Aperçu">
              {(["desktop", "phone"] as const).map((d) => (
                <button key={d} type="button" aria-pressed={device === d} onClick={() => setDevice(d)} className={`min-h-9 rounded-lg px-3 text-[13px] font-semibold ${device === d ? "bg-yc-night-900 text-white" : "text-yc-ink-soft hover:text-yc-ink"}`}>
                  {d === "desktop" ? "Ordinateur" : "Téléphone"}
                </button>
              ))}
            </div>
            {studio.canUndo && !previewJobId && (
              <Button size="sm" variant="secondary" loading={busy === "write"} onClick={() => run("write", async () => { const r = await post<{ label: string }>("undo"); await refresh(); setNotice(`Annulé : ${r.label}`); })}>
                Annuler la dernière modification
              </Button>
            )}
            {siteUrl && <a href={siteUrl} target="_blank" rel="noreferrer" className="px-2 text-[13px] font-semibold text-yc-ink-soft hover:text-yc-ink">Voir le site en ligne ↗</a>}
            {canPublish && (
              confirmPublish ? (
                <span className="flex items-center gap-2 rounded-xl bg-white px-3 py-1.5 ring-1 ring-yc-ink/10">
                  <span className="text-[13px] text-yc-ink">Mettre ce brouillon en ligne ?</span>
                  <Button size="sm" loading={busy === "publish"} onClick={() => run("publish", async () => { const r = await post<{ versionNumber: number | null }>("publish"); setConfirmPublish(false); await refresh(); setNotice(`Site publié${r.versionNumber ? ` (version ${r.versionNumber})` : ""}. Il est en ligne.`); })}>Publier</Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmPublish(false)}>Pas encore</Button>
                </span>
              ) : (
                <Button size="sm" disabled={!publishable || busy !== null} onClick={() => setConfirmPublish(true)} title={publishable ? undefined : "Rien de nouveau à publier"}>Publier</Button>
              )
            )}
          </div>
        )}
      </div>

      {error && <p role="alert" className="rounded-xl bg-yc-danger/[0.08] px-4 py-3 text-sm font-medium text-yc-danger">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-yc-success/[0.1] px-4 py-3 text-sm font-medium text-yc-success">{notice}</p>}

      {busy === "generate" && mode !== "studio" ? (
        <StudioComposing catalog={studio.catalog} />
      ) : mode === "onboarding" ? (
        <StudioCreation
          tenantName={studio.tenantName}
          initial={studio.brief}
          catalog={studio.catalog}
          logoUrl={studio.draft.snapshot.settings.identity.logoUrl}
          advice={studio.audit.advice}
          busy={busy === "generate"}
          disabledReason={aiBlocked}
          onChooseLogo={() => setPicker({ kind: "logo" })}
          onSubmit={generateDirections}
          onCancel={studio.homeStatus.mode === "editor" || studio.lastRevision ? () => setMode("studio") : undefined}
        />
      ) : null}

      {mode === "directions" && studio.directions && busy !== "generate" && (
        <StudioDirections
          mode={studio.catalog.mode}
          jobId={studio.directions.jobId}
          directions={(studio.directions as unknown as { directions: DirectionCard[] }).directions}
          advice={(studio.directions as unknown as { audit?: string[] }).audit ?? []}
          simulated={Boolean((studio.directions as { simulated?: boolean }).simulated)}
          unavailableReason={aiBlocked}
          busy={busy !== null}
          onBack={() => setMode("onboarding")}
          onRegenerate={() => studio.brief && generateDirections(studio.brief)}
          onChoose={(index) =>
            run("write", async () => {
              await post("choose", { jobId: studio.directions!.jobId, index });
              await refresh();
              setMode("studio");
              setNotice("Votre brouillon est prêt. Ajustez-le en conversation, puis publiez quand vous le souhaitez.");
            })
          }
        />
      )}

      {mode === "studio" && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div id="studio-apercu" className="grid min-w-0 scroll-mt-24 content-start gap-3">
            <StudioPreview
              src={previewJobId ? `/editeur/site?job=${previewJobId}` : `/editeur/site?v=${studio.draft.signature}`}
              device={device}
              label={previewJobId ? "Proposition — non appliquée" : "Brouillon"}
              tone={previewJobId ? "proposal" : "draft"}
              highlight={previewJobId ? ((studio.conversation as ConversationItem[]).find((c) => c.jobId === previewJobId)?.focus ?? null) : selectedId}
              onSelect={previewJobId ? undefined : setSelectedId}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-yc-ink-soft">
              <span>Cliquez une section de l&apos;aperçu pour la modifier ou remplacer ses images.</span>
              <span className="flex gap-3">
                <button type="button" onClick={() => setPicker({ kind: "logo" })} className="font-semibold text-yc-electric hover:underline">{studio.draft.snapshot.settings.identity.logoUrl ? "Changer le logo" : "Ajouter un logo"}</button>
                <button type="button" onClick={() => setMode("onboarding")} className="inline-flex items-center gap-1 font-semibold text-yc-electric hover:underline"><IconSparkles size={13} /> Recréer avec l&apos;IA</button>
              </span>
            </div>
          </div>
          <div className="xl:sticky xl:top-[136px] xl:h-[calc(100vh-152px)]">
            <StudioAssistant
              mode={studio.catalog.mode}
              items={studio.conversation as ConversationItem[]}
              available={studio.ai.available}
              simulated={studio.ai.simulated}
              unavailableReason={studio.ai.reason}
              usage={studio.ai.usage}
              busy={busy === "generate"}
              selected={selected}
              previewJobId={previewJobId}
              onClearSelection={() => setSelectedId(null)}
              onReplaceImage={(sectionId, field) => setPicker({ kind: "image", sectionId, field })}
              onPreview={showProposal}
              onSend={(message) =>
                run("generate", async () => {
                  const { jobId } = await post<{ jobId: string }>("propose", { message, selectedSectionId: selectedId });
                  const data = await refresh();
                  const item = data?.conversation.find((c) => c.jobId === jobId) as ConversationItem | undefined;
                  showProposal(item?.changes?.length ? jobId : null);
                })
              }
              onImprove={() =>
                run("generate", async () => {
                  const { jobId } = await post<{ jobId: string }>("propose", { message: "Améliorer mon site avec l'IA", improve: true });
                  const data = await refresh();
                  const item = data?.conversation.find((c) => c.jobId === jobId) as ConversationItem | undefined;
                  showProposal(item?.changes?.length ? jobId : null);
                })
              }
              onApply={applyProposal}
            />
          </div>
        </div>
      )}

      <details className="group rounded-2xl bg-white shadow-yc ring-1 ring-yc-ink/[0.06]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block text-[15px] font-semibold text-yc-ink">Réglages avancés</span>
            <span className="block text-[13px] text-yc-ink-soft">Style, identité, bandeau d&apos;annonce, accueil standard et éditeur section par section.</span>
          </span>
          <span className="text-yc-ink-soft transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
        </summary>
        <div className="border-t border-yc-ink/[0.06] p-4 sm:p-5">
          <p className="mb-4 flex flex-wrap items-center gap-2 text-[13px] text-yc-ink-soft">
            Ces réglages s&apos;appliquent immédiatement au site en ligne.
            <a href="/editeur" className="font-semibold text-yc-electric hover:underline">Ouvrir l&apos;éditeur section par section →</a>
          </p>
          {advanced}
        </div>
      </details>

      {mode === "studio" && previewJobId && (
        <div className="fixed inset-x-3 bottom-[76px] z-40 flex items-center gap-2 rounded-2xl bg-yc-night-950 p-2 pl-4 text-white shadow-yc-float md:hidden" role="region" aria-label="Proposition en aperçu">
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">Proposition en aperçu</span>
          <button type="button" onClick={() => setPreviewJobId(null)} className="min-h-10 rounded-xl px-3 text-[13px] font-semibold text-white/75">Ignorer</button>
          <button type="button" disabled={busy !== null} onClick={() => applyProposal(previewJobId)} className="min-h-10 rounded-xl bg-white px-4 text-[13px] font-semibold text-yc-night-950 disabled:opacity-50">Appliquer</button>
        </div>
      )}

      {picker && (
        <MediaPickerDialog
          size={picker.kind === "logo" ? "medium" : "large"}
          onClose={() => setPicker(null)}
          onPick={(url, alt) =>
            run("write", async () => {
              await post("manual", picker.kind === "logo" ? { kind: "logo", url } : { kind: "image", sectionId: picker.sectionId, field: picker.field, url, alt: alt || undefined });
              await refresh();
              setNotice(picker.kind === "logo" ? "Logo mis à jour dans le brouillon." : "Image remplacée dans le brouillon.");
            })
          }
        />
      )}
    </div>
  );
}
