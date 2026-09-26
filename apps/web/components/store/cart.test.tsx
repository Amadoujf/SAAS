import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StoreCartProvider, useStoreCart, type StoreCart } from "./cart-provider";
import { CartLineRow } from "./cart-drawer";

const line = (over: Partial<StoreCart["lines"][number]> = {}) => ({
  id: "l1", productVariantId: "v1", productId: "p1", productName: "Boubou", variantName: "M", imageUrl: null,
  unitPrice: 45000, quantity: 1, lineTotal: 45000, availableQuantity: 3, ...over,
});
const cartOf = (lines: ReturnType<typeof line>[]): StoreCart => ({ id: "c", lines, subtotal: lines.reduce((s, l) => s + l.lineTotal, 0), itemCount: lines.reduce((s, l) => s + l.quantity, 0) });

function Lines() {
  const { cart, notice, error } = useStoreCart();
  return (
    <div>
      {notice && <p>{notice}</p>}
      {error && <p>{error}</p>}
      <ul>{cart?.lines.map((l) => <CartLineRow key={l.id} line={l} />)}</ul>
    </div>
  );
}

describe("Panier boutique (connecté au serveur)", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("n'envoie jamais de prix : seulement la quantité ; affiche le panier recalculé par le serveur", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ cart: cartOf([line()]) })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ cart: cartOf([line({ quantity: 2, lineTotal: 90000 })]) })));
    render(<StoreCartProvider><Lines /></StoreCartProvider>);
    await screen.findByText("Boubou");
    fireEvent.click(screen.getByRole("button", { name: "Augmenter" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [, init] = fetchMock.mock.calls[1]!;
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ quantity: 2 });
    await screen.findByText(/90\s000 FCFA/);
  });

  it("signale clairement une ligne dont le stock a baissé et bloque l'augmentation", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ cart: cartOf([line({ quantity: 3, lineTotal: 135000, availableQuantity: 1 })]) })));
    render(<StoreCartProvider><Lines /></StoreCartProvider>);
    expect(await screen.findByText(/Il ne reste que 1/)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/Plus que 1 disponible/);
    expect(screen.getByRole("button", { name: "Augmenter" })).toBeDisabled();
  });

  it("revient à l'état serveur et affiche l'erreur si la mise à jour est refusée", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ cart: cartOf([line()]) })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "Stock insuffisant : il ne reste que 1 exemplaire." }), { status: 400 }));
    render(<StoreCartProvider><Lines /></StoreCartProvider>);
    await screen.findByText("Boubou");
    fireEvent.click(screen.getByRole("button", { name: "Augmenter" }));
    expect(await screen.findByText(/Stock insuffisant/)).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });
});
