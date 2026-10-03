import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { DEFAULT_DESIGN_TOKENS } from "@yamacommerce/design-tokens";
import { PreviewFrameApp } from "./preview-frame-app";
import {
  PREVIEW_CHANNEL,
  PREVIEW_PROTOCOL_VERSION,
  type ParentToFrameMessage,
} from "@/lib/editor/preview-protocol";

const ALLOWED_ORIGIN = "https://boutique.example.com";

const HERO_PAGE = {
  id: "home",
  slug: "accueil",
  title: "Accueil",
  isHome: true,
  blocks: [
    {
      id: "hero-1",
      sectionKey: "hero" as const,
      variant: "split",
      params: { title: "Bienvenue", media: { url: "https://x.test/a.jpg" } },
      order: 0,
      isEnabled: true,
      animationOverride: "inherit" as const,
    },
  ],
};

function contentUpdate(overrides: Partial<typeof HERO_PAGE> = {}): ParentToFrameMessage {
  return {
    channel: PREVIEW_CHANNEL,
    version: PREVIEW_PROTOCOL_VERSION,
    type: "CONTENT_UPDATE",
    payload: {
      page: { ...HERO_PAGE, ...overrides },
      tokens: DEFAULT_DESIGN_TOKENS,
      animationLevel: "dynamic",
      locale: "fr",
      selectedSectionId: null,
    },
  };
}

function dispatchFromParent(data: unknown, origin = ALLOWED_ORIGIN) {
  fireEvent(window, new MessageEvent("message", { data, origin }));
}

describe("PreviewFrameApp — document de l'iframe d'aperçu", () => {
  beforeEach(() => {
    vi.spyOn(window.parent, "postMessage");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("signale READY au parent dès le montage", () => {
    render(<PreviewFrameApp allowedParentOrigin={ALLOWED_ORIGIN} />);
    expect(window.parent.postMessage).toHaveBeenCalledWith(
      { channel: PREVIEW_CHANNEL, version: PREVIEW_PROTOCOL_VERSION, type: "READY" },
      ALLOWED_ORIGIN,
    );
  });

  it("POIGNÉE DE MAIN ROBUSTE : continue de renvoyer READY tant qu'aucun CONTENT_UPDATE n'est arrivé", () => {
    // Reproduit la vraie course détectée le 21 septembre 2026 : si le PARENT attache
    // son écouteur `message` APRÈS le tout premier READY (chargement complet d'une
    // page, pas un simple remontage d'iframe déjà monté), ce premier envoi est perdu
    // sans aucune erreur ni des deux côtés — l'aperçu reste bloqué indéfiniment sur
    // "En attente du contenu…". Le renvoi périodique doit couvrir ce cas.
    vi.useFakeTimers();
    render(<PreviewFrameApp allowedParentOrigin={ALLOWED_ORIGIN} />);
    const callsAfterMount = (window.parent.postMessage as ReturnType<typeof vi.fn>).mock.calls.length;

    vi.advanceTimersByTime(650); // ~3 renvois supplémentaires à 200ms d'intervalle

    const readyCalls = (window.parent.postMessage as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call) => (call[0] as { type?: string })?.type === "READY",
    );
    expect(readyCalls.length).toBeGreaterThan(callsAfterMount);
    vi.useRealTimers();
  });

  it("POIGNÉE DE MAIN ROBUSTE : arrête de renvoyer READY une fois un CONTENT_UPDATE reçu", () => {
    vi.useFakeTimers();
    render(<PreviewFrameApp allowedParentOrigin={ALLOWED_ORIGIN} />);

    dispatchFromParent(contentUpdate());
    (window.parent.postMessage as ReturnType<typeof vi.fn>).mockClear();

    vi.advanceTimersByTime(1000);

    const readyCallsAfterContent = (window.parent.postMessage as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call) => (call[0] as { type?: string })?.type === "READY",
    );
    expect(readyCallsAfterContent).toHaveLength(0);
    vi.useRealTimers();
  });

  it("affiche un état d'attente tant qu'aucun CONTENT_UPDATE n'est reçu", () => {
    render(<PreviewFrameApp allowedParentOrigin={ALLOWED_ORIGIN} />);
    expect(screen.getByText(/En attente du contenu/)).toBeInTheDocument();
  });

  it("applique un CONTENT_UPDATE reçu de l'origine autorisée", () => {
    render(<PreviewFrameApp allowedParentOrigin={ALLOWED_ORIGIN} />);
    dispatchFromParent(contentUpdate());
    expect(screen.getByText("Bienvenue")).toBeInTheDocument();
  });

  it("REFUS D'ORIGINE : ignore un CONTENT_UPDATE provenant d'une origine non autorisée", () => {
    render(<PreviewFrameApp allowedParentOrigin={ALLOWED_ORIGIN} />);
    dispatchFromParent(contentUpdate(), "https://attaquant.example.com");
    expect(screen.queryByText("Bienvenue")).not.toBeInTheDocument();
    expect(screen.getByText(/En attente du contenu/)).toBeInTheDocument();
  });

  it("VALIDATION DE event.source : ignore un message dont la source n'est pas window.parent", () => {
    render(<PreviewFrameApp allowedParentOrigin={ALLOWED_ORIGIN} />);
    const message = new MessageEvent("message", { data: contentUpdate(), origin: ALLOWED_ORIGIN });
    // jsdom ne permet pas de passer `source` au constructeur `MessageEvent` — on le
    // pose directement (il est normalement en lecture seule côté navigateur, mais pas
    // sur l'implémentation jsdom utilisée par les tests).
    Object.defineProperty(message, "source", { value: {}, configurable: true });
    fireEvent(window, message);
    expect(screen.queryByText("Bienvenue")).not.toBeInTheDocument();
    expect(screen.getByText(/En attente du contenu/)).toBeInTheDocument();
  });

  it("ignore un message mal formé même depuis l'origine autorisée", () => {
    render(<PreviewFrameApp allowedParentOrigin={ALLOWED_ORIGIN} />);
    dispatchFromParent({ channel: PREVIEW_CHANNEL, version: PREVIEW_PROTOCOL_VERSION, type: "CONTENT_UPDATE", payload: {} });
    expect(screen.getByText(/En attente du contenu/)).toBeInTheDocument();
  });

  it("SÉLECTION DE SECTION : un clic sur une section poste SECTION_CLICKED au parent", () => {
    render(<PreviewFrameApp allowedParentOrigin={ALLOWED_ORIGIN} />);
    dispatchFromParent(contentUpdate());
    fireEvent.click(screen.getByLabelText("Sélectionner la section Bannière d'accueil"));
    expect(window.parent.postMessage).toHaveBeenCalledWith(
      {
        channel: PREVIEW_CHANNEL,
        version: PREVIEW_PROTOCOL_VERSION,
        type: "SECTION_CLICKED",
        payload: { sectionId: "hero-1" },
      },
      ALLOWED_ORIGIN,
    );
  });

  it("met en évidence la section sélectionnée reçue via SELECT_SECTION", () => {
    render(<PreviewFrameApp allowedParentOrigin={ALLOWED_ORIGIN} />);
    dispatchFromParent(contentUpdate());
    dispatchFromParent({
      channel: PREVIEW_CHANNEL,
      version: PREVIEW_PROTOCOL_VERSION,
      type: "SELECT_SECTION",
      payload: { sectionId: "hero-1" },
    });
    expect(screen.getByLabelText("Sélectionner la section Bannière d'accueil")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("SCROLL_TO_SECTION fait défiler jusqu'à la section correspondante", () => {
    render(<PreviewFrameApp allowedParentOrigin={ALLOWED_ORIGIN} />);
    dispatchFromParent(contentUpdate());
    const scrollIntoViewMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;
    dispatchFromParent({
      channel: PREVIEW_CHANNEL,
      version: PREVIEW_PROTOCOL_VERSION,
      type: "SCROLL_TO_SECTION",
      payload: { sectionId: "hero-1" },
    });
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });
});
