import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MarketHero } from "./hero-carousel";
import type { HeroSlide } from "@/lib/storefront/home-content";

vi.mock("./cart-provider", () => ({ useStoreCart: () => ({ add: vi.fn(), busyLine: null, error: null }), fcfa: (n: number) => `${n} FCFA` }));

const slides: HeroSlide[] = ["Un", "Deux", "Trois"].map((t, i) => ({ id: `s${i}`, imageUrl: `/demo-templates/x/${i}.webp`, mobileImageUrl: null, imageAlt: "", demo: true, eyebrow: "", title: t, subtitle: "", ctaLabel: "", ctaHref: "", theme: "dark", productId: i === 0 ? "p1" : null }));
const products = { p1: { slug: "lampe", name: "Lampe Aura", price: 45000, category: "Décoration" } };

function mockReducedMotion(reduced: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: reduced && q.includes("reduce"), addEventListener: vi.fn(), removeEventListener: vi.fn() }));
}
const current = () => screen.getAllByRole("group", { hidden: true }).filter((g) => g.getAttribute("aria-roledescription") === "diapositive" && g.getAttribute("aria-hidden") === "false")[0]!;

describe("Carrousel d'accueil", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("défile automatiquement, et le bouton Pause l'arrête", () => {
    mockReducedMotion(false);
    render(<MarketHero slides={slides} autoplaySeconds={5} products={products} />);
    expect(current()).toHaveAttribute("aria-label", "1 sur 3");
    act(() => { vi.advanceTimersByTime(5000); });
    expect(current()).toHaveAttribute("aria-label", "2 sur 3");
    fireEvent.click(screen.getByRole("button", { name: "Mettre en pause le défilement" }));
    act(() => { vi.advanceTimersByTime(20000); });
    expect(current()).toHaveAttribute("aria-label", "2 sur 3");
  });

  it("aucun défilement automatique si l'utilisateur réduit les animations ; flèches clavier", () => {
    mockReducedMotion(true);
    render(<MarketHero slides={slides} autoplaySeconds={5} products={products} />);
    act(() => { vi.advanceTimersByTime(20000); });
    expect(current()).toHaveAttribute("aria-label", "1 sur 3");
    fireEvent.keyDown(current(), { key: "ArrowRight" });
    expect(current()).toHaveAttribute("aria-label", "2 sur 3");
    fireEvent.keyDown(current(), { key: "ArrowLeft" });
    fireEvent.keyDown(current(), { key: "ArrowLeft" });
    expect(current()).toHaveAttribute("aria-label", "3 sur 3");
  });

  it("le produit mis en scène change avec la diapositive (texte réel, prix, aperçu rapide)", () => {
    mockReducedMotion(true);
    render(<MarketHero slides={slides} autoplaySeconds={5} products={products} />);
    expect(screen.getAllByText("Lampe Aura").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Aperçu rapide : Lampe Aura" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Diapositive suivante" }));
    expect(screen.queryByRole("button", { name: "Aperçu rapide : Lampe Aura" })).toBeNull();
  });
});
