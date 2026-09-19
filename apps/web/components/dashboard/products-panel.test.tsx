import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";
import { ProductsPanel } from "./products-panel";

/**
 * Vérifie le panneau "Produits" du dashboard SANS PostgreSQL/serveur Next.js réel :
 * `fetch` simulé avec exactement la forme renvoyée par les VRAIES routes
 * `/api/catalog/products/*` — même convention que admin-domains-panel.test.tsx.
 */
const draftProduct = {
  id: "prod-1",
  name: "Sneakers en cuir",
  slug: "sneakers-cuir",
  status: "DRAFT" as const,
  basePrice: 45_000,
  category: { id: "cat-1", name: "Chaussures" },
  images: [],
  variants: [],
};

const publishedProduct = {
  ...draftProduct,
  id: "prod-2",
  name: "Robe wax",
  status: "PUBLISHED" as const,
  category: null,
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ProductsPanel", () => {
  it("charge et affiche la liste des produits au montage, avec le prix en FCFA et le statut", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ products: [draftProduct, publishedProduct] }) } as Response)),
    );
    render(<ProductsPanel />);

    expect(await screen.findByText("Sneakers en cuir")).toBeInTheDocument();
    expect(screen.getByText("Robe wax")).toBeInTheDocument();
    const draftRow = screen.getByText("Sneakers en cuir").closest("li")!;
    expect(within(draftRow).getByText(/45[\s ]000 FCFA/)).toBeInTheDocument();
  });

  it("un produit BROUILLON propose « Publier » ; un produit PUBLIÉ propose « Archiver », jamais les deux", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ products: [draftProduct, publishedProduct] }) } as Response)),
    );
    render(<ProductsPanel />);
    await screen.findByText("Sneakers en cuir");

    const draftRow = screen.getByText("Sneakers en cuir").closest("li")!;
    const publishedRow = screen.getByText("Robe wax").closest("li")!;
    expect(draftRow.querySelector("button")?.textContent).toContain("Publier");
    expect(publishedRow.textContent).toContain("Archiver");
    expect(publishedRow.textContent).not.toContain("Publier");
  });

  it("cliquer sur « Publier » appelle POST /status avec PUBLISHED puis rafraîchit la liste", async () => {
    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/status") && init?.method === "POST") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ products: [draftProduct] }) } as Response);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ProductsPanel />);
    await screen.findByText("Sneakers en cuir");

    fireEvent.click(screen.getByRole("button", { name: "Publier" }));

    await waitFor(() => expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/status"))).toBe(true));
    const statusCall = fetchMock.mock.calls.find((c) => String(c[0]).includes("/status"))!;
    expect(JSON.parse((statusCall[1] as RequestInit).body as string)).toEqual({ status: "PUBLISHED" });
  });

  it("supprimer demande confirmation puis appelle DELETE — annuler la confirmation n'appelle rien", async () => {
    const fetchMock = vi.fn((_input: string | URL | Request) =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ products: [draftProduct] }) } as Response),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", vi.fn(() => false));
    render(<ProductsPanel />);
    await screen.findByText("Sneakers en cuir");

    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));

    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/prod-1") && !String(c[0]).includes("?"))).toBe(false);
  });
});
