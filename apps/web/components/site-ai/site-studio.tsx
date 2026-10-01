"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/yc/button";
import { IconSparkles } from "@/components/yc/icons";
import { MediaPickerDialog } from "@/components/media/media-picker-dialog";
import type { loadStudio } from "@/lib/site-ai/pipeline";
import type { SiteBrief } from "@/lib/site-ai/types";
import { DeviceToggle, PreviewOverlay, StudioPreview, type Device } from "./studio-preview";
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
  // Directions demandées et pas encore choisies, plus récentes que la dernière retouche :
  // on les retrouve en revenant sur la page.
  const d = s.directions;
  if (d && !d.chosen && (!s.lastRevision || d.at > s.lastRevision.at)) return "directions";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  // Téléphone et tablette : l'assistant s'ouvre en panneau par-dessus l'aperçu.
  const [sheetOpen, setSheetOpen] = useState(false);
  // Direction affichée à l'étape des directions (onglet, plein écran, demande).
  const [activeDirection, setActiveDirection] = useState(0);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !(e.target as HTMLElement).closest("[data-publish-menu]")) setMenuOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [menuOpen]);

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
      setSheetOpen(false);
      requestAnimationFrame(() => document.getElementById("studio-apercu")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  const directionNames = ((studio.directions as unknown as { directions?: DirectionCard[] } | null)?.directions ?? []).map((x) => x.archetypeLabel ?? x.name);
  const chooseDirection = (index: number) =>
    run("write", async () => {
      await post("choose", { jobId: studio.directions!.jobId, index });
      await refresh();
      setMode("studio");
      setNotice("Votre brouillon est prêt. Ajustez-le en conversation, puis publiez quand vous le souhaitez.");
    });

  const aiBlocked = !studio.ai.available ? studio.ai.reason : studio.ai.usage.limit !== null && studio.ai.usage.used >= studio.ai.usage.limit ? "Quota IA du mois atteint." : null;

  return (
    <div id="site-studio" className={`grid scroll-mt-20 gap-5 ${templateFontVariables}`}>
      {/* Barre de l'atelier — toujours visible : état, appareil, plein écran, publication. */}
      <div className="z-20 -mx-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-yc-ink/[0.07] bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 md:sticky md:top-16 lg:top-[68px] lg:-mx-8 lg:px-8">
        <h1 className="text-[19px] font-semibold tracking-[-0.01em] text-yc-ink sm:text-[21px]">Atelier de création</h1>
        {mode === "studio" && previewJobId && (
          <span className="hidden items-center gap-2 md:flex">
            <Button size="sm" loading={busy === "write"} onClick={() => applyProposal(previewJobId)}>Appliquer</Button>
            <Button size="sm" variant="ghost" onClick={() => setPreviewJobId(null)}>Revenir au brouillon</Button>
          </span>
        )}
        {mode !== "onboarding" && (
          <span className="hidden items-center gap-1 sm:flex lg:ml-6">
            <DeviceToggle device={device} onChange={setDevice} />
            <button type="button" onClick={() => setFullscreen(true)} aria-label="Aperçu plein écran" title="Plein écran" className="grid h-11 w-11 place-items-center rounded-xl text-yc-ink-soft hover:bg-[#F1F3F7] hover:text-yc-ink">
              <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
            </button>
          </span>
        )}
        {mode !== "onboarding" && (
          <div className="ml-auto flex items-center gap-3">
            <span role="status" className={`hidden items-center gap-2 text-[13px] md:inline-flex ${mode === "directions" ? "text-yc-ink-soft" : state.tone === "live" ? "text-yc-success" : state.tone === "pending" ? "text-[rgb(146_84_0)]" : "text-yc-ink-soft"}`}>
              {state.tone === "busy" ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" aria-hidden="true" />
              ) : (
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="m8.5 12.2 2.4 2.3 4.6-4.8" /></svg>
              )}
              {mode === "directions" && state.tone !== "busy" ? "Trois directions prêtes" : state.text}
            </span>
            {confirmPublish ? (
              <span className="flex items-center gap-2 rounded-full bg-white py-1 pl-3 pr-1 ring-1 ring-yc-ink/10">
                <span className="text-[13px] text-yc-ink">{mode === "directions" ? `Mettre en ligne « ${directionNames[activeDirection] ?? "cette direction"} » ?` : "Mettre en ligne ?"}</span>
                <Button
                  size="sm"
                  loading={busy === "publish"}
                  onClick={() =>
                    run("publish", async () => {
                      // Depuis les directions : la direction affichée devient le brouillon, puis elle est publiée.
                      if (mode === "directions" && studio.directions) await post("choose", { jobId: studio.directions.jobId, index: activeDirection });
                      const r = await post<{ versionNumber: number | null }>("publish");
                      setConfirmPublish(false);
                      await refresh();
                      if (mode === "directions") setModeState("studio");
                      setNotice(`Site publié${r.versionNumber ? ` (version ${r.versionNumber})` : ""}. Il est en ligne.`);
                    })
                  }
                >
                  Publier
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmPublish(false)}>Pas encore</Button>
              </span>
            ) : (
              <div data-publish-menu className="relative flex">
                {canPublish && (
                  <button type="button" disabled={(mode === "studio" && !publishable) || busy !== null} onClick={() => setConfirmPublish(true)} title={mode === "directions" ? "Publier la direction affichée" : publishable ? undefined : "Rien de nouveau à publier"} className="inline-flex min-h-11 items-center gap-2 rounded-l-xl bg-yc-night-950 pl-4 pr-4 text-[15px] font-semibold text-white hover:bg-yc-night-900 disabled:bg-yc-night-950/45 sm:pl-5">
                    <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 20h14" /></svg>
                    Publier
                  </button>
                )}
                <button type="button" aria-haspopup="menu" aria-expanded={menuOpen} aria-label="Plus d'actions" onClick={() => setMenuOpen((o) => !o)} className={`grid min-h-11 w-11 place-items-center text-white ${canPublish ? "rounded-r-xl border-l border-white/15" : "rounded-xl"} bg-yc-night-950 hover:bg-yc-night-900`}>
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                </button>
                {menuOpen && (
                  <div role="menu" className="absolute right-0 top-[calc(100%+8px)] z-30 grid w-64 gap-0.5 rounded-2xl bg-white p-1.5 text-[14px] text-yc-ink shadow-yc-float ring-1 ring-yc-ink/[0.08]">
                    {siteUrl && <a role="menuitem" href={siteUrl} target="_blank" rel="noreferrer" className="rounded-xl px-3 py-2.5 hover:bg-[#F6F7FB]">Voir le site en ligne ↗</a>}
                    {studio.canUndo && !previewJobId && (
                      <button role="menuitem" type="button" disabled={busy !== null} onClick={() => { setMenuOpen(false); run("write", async () => { const r = await post<{ label: string }>("undo"); await refresh(); setNotice(`Annulé : ${r.label}`); }); }} className="rounded-xl px-3 py-2.5 text-left hover:bg-[#F6F7FB] disabled:opacity-50">Annuler la dernière modification</button>
                    )}
                    <button role="menuitem" type="button" onClick={() => { setMenuOpen(false); setFullscreen(true); }} className="rounded-xl px-3 py-2.5 text-left hover:bg-[#F6F7FB]">Aperçu plein écran</button>
                    {mode === "studio" && <button role="menuitem" type="button" onClick={() => { setMenuOpen(false); setPicker({ kind: "logo" }); }} className="rounded-xl px-3 py-2.5 text-left hover:bg-[#F6F7FB]">{studio.draft.snapshot.settings.identity.logoUrl ? "Changer le logo" : "Ajouter un logo"}</button>}
                    <button role="menuitem" type="button" onClick={() => { setMenuOpen(false); setMode("onboarding"); }} className="rounded-xl px-3 py-2.5 text-left hover:bg-[#F6F7FB]">Recréer avec l&apos;IA</button>
                    <a role="menuitem" href="#reglages-avances" onClick={() => setMenuOpen(false)} className="rounded-xl px-3 py-2.5 hover:bg-[#F6F7FB]">Réglages avancés</a>
                  </div>
                )}
              </div>
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
          device={device}
          active={activeDirection}
          onActive={setActiveDirection}
          request={studio.brief?.activity ?? null}
          initial={(studio.tenantName.trim()[0] ?? "Y").toUpperCase()}
          onAsk={(index, message) =>
            // La demande porte sur la direction affichée : elle devient le brouillon,
            // puis la modification est proposée (à appliquer ou ignorer).
            run("generate", async () => {
              await post("choose", { jobId: studio.directions!.jobId, index });
              await refresh();
              setModeState("studio");
              const { jobId } = await post<{ jobId: string }>("propose", { message });
              const data = await refresh();
              const item = data?.conversation.find((c) => c.jobId === jobId) as ConversationItem | undefined;
              showProposal(item?.changes?.length ? jobId : null);
            })
          }
          onBack={() => setMode("onboarding")}
          onRegenerate={() => studio.brief && generateDirections(studio.brief)}
          onChoose={chooseDirection}
        />
      )}

      {mode === "studio" && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
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
              <span>Touchez une section de l&apos;aperçu pour la modifier ou remplacer ses images.</span>
              <span className="sm:hidden"><DeviceToggle device={device} onChange={setDevice} /></span>
            </div>
          </div>
          {/* Ordinateur : colonne à droite de l'aperçu. Téléphone : panneau qui monte du bas. */}
          <div
            id="directeur-artistique"
            className={`flex flex-col xl:sticky xl:top-[136px] xl:h-[calc(100vh-152px)] max-xl:fixed max-xl:inset-x-0 max-xl:bottom-0 max-xl:z-[70] max-xl:h-[min(84vh,720px)] max-xl:rounded-t-[28px] max-xl:bg-white max-xl:shadow-[0_-24px_60px_rgba(15,23,42,0.25)] max-xl:transition-[transform,visibility] max-xl:duration-300 ${sheetOpen ? "" : "max-xl:invisible max-xl:translate-y-[105%]"}`}
          >
            <div className="flex items-center justify-between px-5 pb-1 pt-3 xl:hidden">
              <span className="mx-auto h-1.5 w-10 rounded-full bg-yc-ink/15" aria-hidden="true" />
              <button type="button" onClick={() => setSheetOpen(false)} className="absolute right-3 top-2 min-h-10 rounded-full px-3 text-[13px] font-semibold text-yc-ink-soft hover:text-yc-ink">Fermer</button>
            </div>
            <div className="min-h-0 flex-1 max-xl:[&>section]:rounded-none max-xl:[&>section]:shadow-none max-xl:[&>section]:ring-0">
            <StudioAssistant
              mode={studio.catalog.mode}
              initial={(studio.tenantName.trim()[0] ?? "Y").toUpperCase()}
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
        </div>
      )}
      {mode === "studio" && sheetOpen && <button type="button" aria-label="Fermer l'assistant" onClick={() => setSheetOpen(false)} className="fixed inset-0 z-[65] bg-yc-night-950/30 xl:hidden" />}
      {mode === "studio" && !sheetOpen && !previewJobId && (
        <button type="button" onClick={() => setSheetOpen(true)} aria-controls="directeur-artistique" className="fixed bottom-[84px] right-4 z-40 inline-flex min-h-12 items-center gap-2 rounded-full bg-yc-night-950 pl-4 pr-5 text-[14px] font-semibold text-white shadow-yc-float md:bottom-6 xl:hidden">
          <IconSparkles size={15} /> Directeur artistique
        </button>
      )}
      {fullscreen && mode === "directions" && studio.directions && (
        <PreviewOverlay
          src={`/editeur/site?job=${studio.directions.jobId}&d=${activeDirection}`}
          label="Direction"
          initialDevice={device}
          tabs={(studio.directions as unknown as { directions: DirectionCard[] }).directions.map((x) => x.archetypeLabel ?? x.name)}
          activeTab={activeDirection}
          onTab={setActiveDirection}
          onClose={() => setFullscreen(false)}
          actions={
            <button type="button" disabled={busy !== null} onClick={() => { setFullscreen(false); chooseDirection(activeDirection); }} className="min-h-10 rounded-full bg-white px-4 text-[13px] font-semibold text-[#101114] disabled:opacity-50">
              Choisir cette direction
            </button>
          }
        />
      )}
      {fullscreen && mode === "studio" && (
        <PreviewOverlay
          src={previewJobId ? `/editeur/site?job=${previewJobId}` : `/editeur/site?v=${studio.draft.signature}`}
          label={previewJobId ? "Proposition — non appliquée" : "Brouillon"}
          initialDevice={device}
          onClose={() => setFullscreen(false)}
          actions={previewJobId ? <button type="button" disabled={busy !== null} onClick={() => { setFullscreen(false); applyProposal(previewJobId); }} className="min-h-10 rounded-full bg-white px-4 text-[13px] font-semibold text-[#101114] disabled:opacity-50">Appliquer</button> : undefined}
        />
      )}

      <details id="reglages-avances" className="group scroll-mt-28 rounded-2xl bg-white shadow-yc ring-1 ring-yc-ink/[0.06]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block text-[15px] font-semibold text-yc-ink">Réglages avancés</span>
            <span className="block text-[13px] text-yc-ink-soft">Pour aller plus loin à la main : style, identité, bandeau, éditeur section par section.</span>
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
