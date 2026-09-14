import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { DEFAULT_DESIGN_TOKENS } from "@yamacommerce/design-tokens";
import { PreviewStage } from "./preview-stage";
import { PREVIEW_CHANNEL, PREVIEW_PROTOCOL_VERSION } from "@/lib/editor/preview-protocol";
import type { EditorPage } from "@/lib/editor/editor-reducer";

const PAGE: EditorPage = {
  id: "home",
  slug: "accueil",
  title: "Accueil",
  isHome: true,
  blocks: [
    {
      id: "hero-1",
      sectionKey: "hero",
      variant: "split",
      params: { title: "Bienvenue", media: { url: "https://x.test/a.jpg" } },
      order: 0,
      isEnabled: true,
      animationOverride: "inherit",
    },
  ],
};

function baseProps(overrides: Partial<Parameters<typeof PreviewStage>[0]> = {}) {
  return {
    page: PAGE,
    tokens: DEFAULT_DESIGN_TOKENS,
    animationLevel: "dynamic" as const,
    locale: "fr" as const,
    selectedSectionId: null,
    onSelectSection: vi.fn(),
    previewSrc: "/demo/editeur-visuel/apercu",
    width: 1440,
    height: 900,
    zoom: 1,
    reloadToken: 0,
    ...overrides,
  };
}

function getIframe(container: HTMLElement): HTMLIFrameElement {
  return container.querySelector("iframe") as HTMLIFrameElement;
}

/** Simule un message REÇU DEPUIS l'iframe rendue — construit un vrai `MessageEvent`
 *  dont `source` pointe sur le `contentWindow` de CETTE iframe (jsdom le permet via
 *  `MessageEventInit.source`), exactement ce que `PreviewStage` vérifie avant de faire
 *  confiance à un message (voir la garde `event.source !== iframeRef.current?.contentWindow`). */
function dispatchFromFrame(iframe: HTMLIFrameElement, data: unknown, origin = window.location.origin) {
  fireEvent(
    window,
    new MessageEvent("message", { data, origin, source: iframe.contentWindow as unknown as Window }),
  );
}

describe("PreviewStage — communication avec l'iframe d'aperçu", () => {
  let postMessageSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // `contentWindow` d'une iframe fraîchement montée est un vrai objet `Window`
    // jsdom : on espionne sa méthode `postMessage`, jamais celle de la fenêtre de
    // test elle-même (les deux sont des objets distincts, contrairement au document
    // de l'iframe testé isolément dans preview-frame-app.test.tsx).
  });

  afterEach(() => {
    cleanup();
    postMessageSpy?.mockRestore();
  });

  it("SANDBOX MINIMAL : l'iframe ne porte que allow-scripts et allow-same-origin", () => {
    const { container } = render(<PreviewStage {...baseProps()} />);
    const iframe = getIframe(container);
    expect(iframe.getAttribute("sandbox")).toBe("allow-scripts allow-same-origin");
  });

  it("n'envoie AUCUN CONTENT_UPDATE avant que l'iframe ait signalé READY", () => {
    const { container } = render(<PreviewStage {...baseProps()} />);
    const iframe = getIframe(container);
    postMessageSpy = vi.spyOn(iframe.contentWindow!, "postMessage");
    expect(postMessageSpy).not.toHaveBeenCalled();
  });

  it("SYNCHRONISATION : envoie un CONTENT_UPDATE dès réception de READY", () => {
    const { container } = render(<PreviewStage {...baseProps()} />);
    const iframe = getIframe(container);
    postMessageSpy = vi.spyOn(iframe.contentWindow!, "postMessage");

    dispatchFromFrame(iframe, {
      channel: PREVIEW_CHANNEL,
      version: PREVIEW_PROTOCOL_VERSION,
      type: "READY",
    });

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "CONTENT_UPDATE" }),
      window.location.origin,
    );
  });

  it("REFUS D'ORIGINE : ignore un READY provenant d'une origine non autorisée", () => {
    const { container } = render(<PreviewStage {...baseProps()} />);
    const iframe = getIframe(container);
    postMessageSpy = vi.spyOn(iframe.contentWindow!, "postMessage");

    dispatchFromFrame(
      iframe,
      { channel: PREVIEW_CHANNEL, version: PREVIEW_PROTOCOL_VERSION, type: "READY" },
      "https://attaquant.example.com",
    );

    expect(postMessageSpy).not.toHaveBeenCalled();
  });

  it("ignore un message dont la source n'est pas cette iframe (usurpation)", () => {
    const { container } = render(<PreviewStage {...baseProps()} />);
    const iframe = getIframe(container);
    postMessageSpy = vi.spyOn(iframe.contentWindow!, "postMessage");

    // `source: window` (la fenêtre de test elle-même, PAS l'iframe) — un attaquant
    // dans le même document ne peut jamais se faire passer pour l'iframe attendue.
    fireEvent(
      window,
      new MessageEvent("message", {
        data: { channel: PREVIEW_CHANNEL, version: PREVIEW_PROTOCOL_VERSION, type: "READY" },
        origin: window.location.origin,
        source: window,
      }),
    );

    expect(postMessageSpy).not.toHaveBeenCalled();
  });

  it("SÉLECTION DE SECTION : un SECTION_CLICKED reçu appelle onSelectSection", () => {
    const onSelectSection = vi.fn();
    const { container } = render(<PreviewStage {...baseProps({ onSelectSection })} />);
    const iframe = getIframe(container);

    dispatchFromFrame(iframe, {
      channel: PREVIEW_CHANNEL,
      version: PREVIEW_PROTOCOL_VERSION,
      type: "SECTION_CLICKED",
      payload: { sectionId: "hero-1" },
    });

    expect(onSelectSection).toHaveBeenCalledWith("hero-1");
  });

  it("SYNCHRONISATION DU BROUILLON : une modification non enregistrée (page mise à jour) déclenche un nouveau CONTENT_UPDATE", () => {
    const { container, rerender } = render(<PreviewStage {...baseProps()} />);
    const iframe = getIframe(container);
    postMessageSpy = vi.spyOn(iframe.contentWindow!, "postMessage");

    dispatchFromFrame(iframe, {
      channel: PREVIEW_CHANNEL,
      version: PREVIEW_PROTOCOL_VERSION,
      type: "READY",
    });
    postMessageSpy.mockClear();

    const editedPage: EditorPage = {
      ...PAGE,
      blocks: [{ ...PAGE.blocks[0]!, params: { ...PAGE.blocks[0]!.params, title: "Titre modifié" } }],
    };
    rerender(<PreviewStage {...baseProps({ page: editedPage })} />);

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "CONTENT_UPDATE",
        payload: expect.objectContaining({
          page: expect.objectContaining({
            blocks: [expect.objectContaining({ params: expect.objectContaining({ title: "Titre modifié" }) })],
          }),
        }),
      }),
      window.location.origin,
    );
  });

  it("envoie SCROLL_TO_SECTION quand la sélection change depuis l'EXTÉRIEUR (la liste), mais pas depuis un clic dans l'aperçu", () => {
    const onSelectSection = vi.fn();
    const { container, rerender } = render(
      <PreviewStage {...baseProps({ onSelectSection, selectedSectionId: null })} />,
    );
    const iframe = getIframe(container);
    postMessageSpy = vi.spyOn(iframe.contentWindow!, "postMessage");

    dispatchFromFrame(iframe, {
      channel: PREVIEW_CHANNEL,
      version: PREVIEW_PROTOCOL_VERSION,
      type: "READY",
    });
    postMessageSpy.mockClear();

    // Sélection depuis la LISTE (changement externe de prop) : doit déclencher un défilement.
    rerender(<PreviewStage {...baseProps({ onSelectSection, selectedSectionId: "hero-1" })} />);
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "SCROLL_TO_SECTION", payload: { sectionId: "hero-1" } }),
      window.location.origin,
    );

    postMessageSpy.mockClear();

    // Un clic DANS l'aperçu (SECTION_CLICKED) puis la même prop appliquée ensuite ne
    // doit PAS redéclencher un défilement redondant (la section est déjà en vue).
    dispatchFromFrame(iframe, {
      channel: PREVIEW_CHANNEL,
      version: PREVIEW_PROTOCOL_VERSION,
      type: "SECTION_CLICKED",
      payload: { sectionId: "hero-1" },
    });
    rerender(<PreviewStage {...baseProps({ onSelectSection, selectedSectionId: "hero-1" })} />);
    const scrollCalls = postMessageSpy.mock.calls.filter(
      (call) => (call[0] as { type?: string })?.type === "SCROLL_TO_SECTION",
    );
    expect(scrollCalls).toHaveLength(0);
  });
});
