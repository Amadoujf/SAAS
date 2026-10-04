import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QuickViewButton } from "./quick-view";

const add = vi.fn().mockResolvedValue(true);
vi.mock("./cart-provider", () => ({ useStoreCart: () => ({ add, busyLine: null, error: null }), fcfa: (n: number) => `${n} FCFA` }));

describe("Aperçu rapide", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("charge le produit publié, permet de choisir une variante disponible et l'ajoute au panier", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      product: { slug: "robe", name: "Robe drapée", shortDescription: "Lin", category: "Mode", images: [{ url: "/x.webp", alt: "Robe" }],
        variants: [{ id: "v-s", name: "S", price: 72000, available: 0 }, { id: "v-m", name: "M", price: 72000, available: 3 }] },
    }), { status: 200 })));
    render(<QuickViewButton slug="robe" name="Robe drapée" />);
    fireEvent.click(screen.getByRole("button", { name: "Aperçu rapide : Robe drapée" }));
    expect(await screen.findByRole("dialog", { name: "Aperçu : Robe drapée" })).toBeInTheDocument();
    await screen.findByText("Lin");
    expect(screen.getByRole("button", { name: "S" })).toBeDisabled(); // épuisée : visible mais non sélectionnable
    fireEvent.click(screen.getByRole("button", { name: "Ajouter au panier" }));
    await waitFor(() => expect(add).toHaveBeenCalledWith("v-m", 1));
  });

  it("se ferme avec Échap et rend le focus au bouton", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Produit introuvable." }), { status: 404 })));
    render(<QuickViewButton slug="x" name="X" />);
    const trigger = screen.getByRole("button", { name: "Aperçu rapide : X" });
    fireEvent.click(trigger);
    expect(await screen.findByRole("alert")).toHaveTextContent("Produit introuvable.");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });
});
