import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StoreCartProvider } from "./cart-provider";
import { CheckoutFlow } from "./checkout-flow";

window.scrollTo = vi.fn() as never;
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const cart = { id: "c", subtotal: 45000, itemCount: 1, lines: [{ id: "l1", productVariantId: "v1", productId: "p1", productName: "Boubou", variantName: "M", imageUrl: null, unitPrice: 45000, quantity: 1, lineTotal: 45000, availableQuantity: 5 }] };
const quote = {
  subtotal: 45000, pickup: { enabled: true, address: "Plateau", instructions: null }, deliveryAllowed: true, deliveryBlockedReason: null, deliveryInstructions: null,
  zones: [
    { id: "z1", label: "Dakar express", region: "Dakar", commune: null, estimatedDays: 1, freeThreshold: null, fee: 2000, available: true, unavailableReason: null, freeShippingApplied: false },
    { id: "z2", label: "Fragile exclu", region: "Dakar", commune: null, estimatedDays: 2, freeThreshold: null, fee: null, available: false, unavailableReason: "Un article de votre panier n'est pas livré dans cette zone", freeShippingApplied: false },
  ],
};

function mockServer() {
  const calls: { url: string; body?: unknown }[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (url.includes("/checkout/options")) return new Response(JSON.stringify({ methods: [{ method: "cod", label: "Paiement à la livraison", description: "" }, { method: "manual_wave", label: "Wave", description: "" }], quote }));
    if (url.includes("/delivery-options")) return new Response(JSON.stringify({ quote }));
    if (url.endsWith("/api/storefront/cart")) return new Response(JSON.stringify({ cart }));
    if (url.endsWith("/api/storefront/checkout")) return new Response(JSON.stringify({ order: { orderId: "o1", accessToken: "t", checkoutUrl: null } }));
    return new Response("{}", { status: 404 });
  });
  return calls;
}

describe("Checkout", () => {
  it("valide les champs, affiche les frais renvoyés par le serveur, zone exclue non sélectionnable, et n'envoie aucun montant", async () => {
    const calls = mockServer();
    render(<StoreCartProvider><CheckoutFlow regions={["Dakar", "Thiès"]} /></StoreCartProvider>);
    await screen.findByLabelText("Prénom");
    fireEvent.click(screen.getByRole("button", { name: /Continuer/ }));
    expect(await screen.findByText("Indiquez votre prénom.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Prénom"), { target: { value: "Awa" } });
    fireEvent.change(screen.getByLabelText("Téléphone"), { target: { value: "12345" } });
    fireEvent.click(screen.getByRole("button", { name: /Continuer/ }));
    expect(await screen.findByText(/Numéro sénégalais attendu/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Téléphone"), { target: { value: "77 123 45 67" } });
    fireEvent.click(screen.getByRole("button", { name: /Continuer/ }));

    await screen.findByRole("radio", { name: /Dakar express/ });
    expect(screen.getByRole("radio", { name: /Fragile exclu/ })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Quartier"), { target: { value: "Mermoz" } });
    await waitFor(() => expect(screen.getAllByText(/2\s000 FCFA/).length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole("button", { name: /Continuer/ }));
    fireEvent.click(await screen.findByRole("radio", { name: /Wave/ }));
    fireEvent.click(screen.getByRole("button", { name: /Continuer/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Confirmer la commande/ }));

    await waitFor(() => expect(calls.some((c) => c.url.endsWith("/api/storefront/checkout"))).toBe(true));
    const body = calls.find((c) => c.url.endsWith("/api/storefront/checkout"))!.body as Record<string, unknown>;
    expect(body).toMatchObject({ deliveryMethod: "delivery", deliveryZoneId: "z1", paymentMethod: "manual_wave" });
    expect(JSON.stringify(body)).not.toMatch(/total|price|fee|subtotal|amount/i);
  });
});
