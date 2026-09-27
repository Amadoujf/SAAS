import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { sectionParamSchemas } from "@yamacommerce/templates";
import { ImmersiveShowcaseSection } from "./immersive-showcase";
import { ImmersiveHeroSection } from "./immersive-hero";
import { ScrollStorySection } from "./scroll-story";
import { AnimationLevelProvider } from "@/lib/motion/animation-level-context";
import type { ShowcaseItem } from "@/lib/showcase/showcase";

const items: ShowcaseItem[] = [
  { id: "1", title: "Lampe Aura", subtitle: "Décoration", imageUrl: "/demo-templates/x/1.webp", href: "/p/lampe-aura", priceLabel: "45 000 FCFA" },
  { id: "2", title: "Vase Terre Bleue", imageUrl: "/demo-templates/x/2.webp", href: "/p/vase" },
  { id: "3", title: "Circuit Casamance", imageUrl: "/demo-templates/x/3.webp" },
];
const showcase = (over: Record<string, unknown> = {}) => sectionParamSchemas.immersive_showcase.parse({ title: "En vedette", intervalSeconds: 4, ...over });
const title = () => screen.getByRole("heading", { level: 3 }).textContent;

function stubMedia(reduced: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: reduced && q.includes("reduce"), addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }));
  // jsdom n'implémente pas PointerEvent : sans lui, clientX serait perdu au balayage.
  vi.stubGlobal("PointerEvent", class extends MouseEvent {});
}

describe("Carrousel immersif", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("défile seul, le bouton pause l'arrête, et le titre, le prix et le lien changent ensemble", () => {
    stubMedia(false);
    render(<ImmersiveShowcaseSection variant="depth" params={showcase()} items={items} />);
    expect(title()).toBe("Lampe Aura");
    expect(screen.getByText("45 000 FCFA")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Découvrir/ })).toHaveAttribute("href", "/p/lampe-aura");
    act(() => { vi.advanceTimersByTime(4000); });
    expect(title()).toBe("Vase Terre Bleue");
    expect(screen.queryByText("45 000 FCFA")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Mettre en pause le défilement automatique" }));
    act(() => { vi.advanceTimersByTime(20000); });
    expect(title()).toBe("Vase Terre Bleue");
    expect(screen.getByRole("button", { name: "Reprendre le défilement automatique" })).toHaveAttribute("aria-pressed", "true");
  });

  it("se met en pause au survol ; flèches, clavier et balayage", () => {
    stubMedia(false);
    render(<ImmersiveShowcaseSection variant="depth" params={showcase()} items={items} />);
    const section = screen.getByRole("region", { name: "En vedette" });
    fireEvent.mouseEnter(section);
    act(() => { vi.advanceTimersByTime(20000); });
    expect(title()).toBe("Lampe Aura");
    fireEvent.click(screen.getByRole("button", { name: "Élément suivant" }));
    expect(title()).toBe("Vase Terre Bleue");
    fireEvent.keyDown(section, { key: "ArrowLeft" });
    fireEvent.keyDown(section, { key: "ArrowLeft" });
    expect(title()).toBe("Circuit Casamance");
    // Élément sans page publique : aucun bouton « Découvrir » (jamais un lien mort).
    expect(screen.queryByRole("link", { name: /Découvrir/ })).toBeNull();
    const stage = section.querySelector(".touch-pan-y")!;
    fireEvent.pointerDown(stage, { clientX: 300, clientY: 100 });
    fireEvent.pointerUp(stage, { clientX: 100, clientY: 110 });
    expect(title()).toBe("Lampe Aura");
  });

  it("mouvement réduit : pas de défilement automatique ni de bouton pause", () => {
    stubMedia(true);
    render(<AnimationLevelProvider level="dynamic"><ImmersiveShowcaseSection variant="stack" params={showcase()} items={items} /></AnimationLevelProvider>);
    act(() => { vi.advanceTimersByTime(20000); });
    expect(title()).toBe("Lampe Aura");
    expect(screen.queryByRole("button", { name: /pause/ })).toBeNull();
  });

  it("objets en arc : objets détourés sans cadre, lien réel et navigation identiques", () => {
    stubMedia(false);
    render(<ImmersiveShowcaseSection variant="arc" params={showcase({ imageStyle: "cutout", backdrop: "dark" })} items={items.map((it, i) => ({ ...it, accentColor: ["#1d3f8f", "#4f8a6e", "#b4552d"][i] }))} />);
    const central = screen.getByRole("img", { name: "Lampe Aura" });
    expect(central).toHaveClass("object-contain");
    expect(central.parentElement).not.toHaveClass("overflow-hidden"); // pas de cadre rogné autour de l'objet
    expect(screen.getByRole("link", { name: /Découvrir/ })).toHaveAttribute("href", "/p/lampe-aura");
    fireEvent.click(screen.getByRole("button", { name: "Élément suivant" }));
    expect(title()).toBe("Vase Terre Bleue");
  });

  it("aucun contenu : la section ne s'affiche pas", () => {
    const { container } = render(<ImmersiveShowcaseSection variant="depth" params={showcase()} items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("Hero immersif", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("titre, accent et boutons réels vers les vraies pages ; titre très long sans débordement", () => {
    stubMedia(false);
    const params = sectionParamSchemas.immersive_hero.parse({ title: "Anticonstitutionnellement".repeat(4), titleAccent: "en lumière", primaryCtaLabel: "Voir le catalogue", primaryCtaHref: "/catalogue", secondaryCtaLabel: "La lampe", secondaryCtaHref: "/p/lampe-aura" });
    render(<ImmersiveHeroSection variant="stage" params={params} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveStyle({ overflowWrap: "anywhere" });
    expect(screen.getByRole("link", { name: /Voir le catalogue/ })).toHaveAttribute("href", "/catalogue");
    expect(screen.getByRole("link", { name: "La lampe" })).toHaveAttribute("href", "/p/lampe-aura");
  });
  it("image qui ne charge pas : repli discret, texte et boutons toujours là", () => {
    stubMedia(false);
    const params = sectionParamSchemas.immersive_hero.parse({ title: "Villa", subjectImage: "/api/media/manquant/file", subjectAlt: "Villa", primaryCtaLabel: "Voir", primaryCtaHref: "/biens" });
    render(<ImmersiveHeroSection variant="architectural" params={params} />);
    fireEvent.error(screen.getByRole("img", { name: "Villa" }));
    expect(screen.getByRole("img", { name: "Villa" }).tagName).toBe("SPAN");
    expect(screen.getByRole("link", { name: /Voir/ })).toHaveAttribute("href", "/biens");
  });
});

describe("Récit au défilement", () => {
  it("toutes les étapes sont lisibles ; frise numérotée ; bouton final", () => {
    stubMedia(false);
    const params = sectionParamSchemas.scroll_story.parse({ title: "La visite", steps: [{ title: "Le séjour", body: "80 m² traversants" }, { title: "La terrasse" }, { title: "La piscine" }], ctaLabel: "Demander une visite", ctaHref: "/biens/villa" });
    render(<ScrollStorySection variant="timeline" params={params} />);
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Le séjour", "La terrasse", "La piscine"]);
    expect(screen.getByText("80 m² traversants")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Demander une visite" })).toHaveAttribute("href", "/biens/villa");
  });

  it("objet mis en scène : étapes lisibles, points de progression qui ramènent à l'étape (défilement natif)", () => {
    stubMedia(false);
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const params = sectionParamSchemas.scroll_story.parse({ title: "Jarre", image: "/demo-templates/ceramiques/jarre-indigo.webp", imageAlt: "Jarre Indigo", steps: [{ title: "Le tournage", rotate: -14, accentColor: "#1d3f8f" }, { title: "L'émail", rotate: 9 }], ctaLabel: "Voir la jarre", ctaHref: "/p/jarre-indigo" });
    render(<ScrollStorySection variant="product" params={params} />);
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Le tournage", "L'émail"]);
    expect(screen.getByRole("button", { name: "Étape 1 : Le tournage" })).toHaveAttribute("aria-current", "step");
    fireEvent.click(screen.getByRole("button", { name: "Étape 2 : L'émail" }));
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect(screen.getByRole("link", { name: "Voir la jarre" })).toHaveAttribute("href", "/p/jarre-indigo");
  });
});
