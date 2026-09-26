import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { SectorUniverses } from "./sector-universes";

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ fill: _fill, priority: _priority, ...props }: Record<string, unknown>) => <img {...(props as object)} alt="" />,
}));

describe("SectorUniverses — univers par secteur", () => {
  it("seul le commerce propose un lien ; les autres secteurs sont annoncés « bientôt »", () => {
    render(<SectorUniverses />);
    const links = screen.getAllByRole("link", { name: /Découvrir/ });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/creer-ma-boutique");
    expect(screen.getAllByText("Bientôt disponible")).toHaveLength(2);
  });

  it("les onglets se pilotent au clavier et mettent à jour la description", () => {
    render(<SectorUniverses />);
    const commerce = screen.getByRole("tab", { name: "Commerce" });
    expect(commerce).toHaveAttribute("aria-selected", "true");
    expect(within(screen.getByRole("tabpanel")).getByText(/· disponible/)).toBeInTheDocument();

    fireEvent.keyDown(commerce, { key: "ArrowRight" });
    const immobilier = screen.getByRole("tab", { name: "Immobilier" });
    expect(immobilier).toHaveAttribute("aria-selected", "true");
    expect(immobilier).toHaveFocus();
    expect(within(screen.getByRole("tabpanel")).getByText(/· bientôt/)).toBeInTheDocument();

    fireEvent.keyDown(immobilier, { key: "ArrowLeft" });
    fireEvent.keyDown(screen.getByRole("tab", { name: "Commerce" }), { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: "Services" })).toHaveAttribute("aria-selected", "true");
  });
});
