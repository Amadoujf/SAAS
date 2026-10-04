import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SalesChart, niceMax } from "./sales-chart";
import { sectionLabel } from "@/components/dashboard-shell/topbar";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard", useRouter: () => ({ replace: vi.fn() }), useSearchParams: () => new URLSearchParams() }));

class RO { observe() {} disconnect() {} }
(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;

const series = Array.from({ length: 90 }, (_, i) => ({ date: new Date(Date.UTC(2026, 5, 29) + i * 86_400_000).toISOString().slice(0, 10), revenue: i === 89 ? 45_000 : i >= 80 ? 10_000 : 1_000, orders: 1 }));

describe("Vue d'ensemble — graphique des ventes", () => {
  it("graduation ronde de l'axe", () => {
    expect(niceMax(87_000)).toBe(100_000);
    expect(niceMax(0)).toBe(4);
    expect(niceMax(430_000)).toBe(500_000);
  });

  it("totalise la période choisie (7 / 30 / 90 jours)", () => {
    render(<SalesChart series={series} />);
    expect(screen.getByRole("img", { name: /30 derniers jours : 155.000 FCFA/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "7 jours" }));
    expect(screen.getByRole("button", { name: "7 jours" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("img", { name: /7 derniers jours : 105.000 FCFA/ })).toBeInTheDocument();
  });

  it("se lit au clavier, jour par jour", () => {
    render(<SalesChart series={series} />);
    const chart = screen.getByRole("img");
    fireEvent.keyDown(chart, { key: "ArrowLeft" });
    expect(screen.getByRole("status")).toHaveTextContent(/45.000 FCFA · 1 commande/);
  });
});

describe("Barre supérieure — fil d'Ariane", () => {
  it("nomme la section courante", () => {
    expect(sectionLabel("/dashboard")).toBe("Vue d'ensemble");
    expect(sectionLabel("/dashboard/commandes/abc")).toBe("Commandes");
    expect(sectionLabel("/dashboard/livraison")).toBe("Livraisons");
  });
});
