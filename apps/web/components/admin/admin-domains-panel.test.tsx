import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";
import { AdminDomainsPanel } from "./admin-domains-panel";

/**
 * Vérifie le panneau Super Admin des domaines SANS PostgreSQL/serveur Next.js réel :
 * `fetch` est simulé avec exactement la forme renvoyée par les VRAIES routes
 * `/api/admin/domains/*` (voir ces fichiers pour la forme de référence) — même
 * convention que customization-panel.test.tsx pour un composant client de ce projet.
 *
 * Démarrer un vrai serveur `next dev` contre PostgreSQL/Redis embarqués (revue du 18
 * septembre 2026) est resté bloqué sur ce poste (le premier chargement de page
 * n'aboutit jamais, probablement à cause de la synchronisation OneDrive du dossier de
 * travail qui ralentit considérablement les compilations webpack) — voir le message
 * de fin de tâche pour le détail. Ce test est la vérification la plus proche possible
 * dans cet environnement : le VRAI composant, un contrat d'API fidèle, un rendu React
 * réel (jsdom), aucune simulation de la logique métier elle-même.
 */

const activeDomain = {
  id: "dom-1",
  domain: "boutique-aida-test.com",
  type: "custom",
  isPrimary: false,
  lifecycleStatus: "ACTIVE",
  verificationAttempts: 2,
  expectedDnsRecords: [{ type: "TXT", host: "_yamacommerce-verification.boutique-aida-test.com", value: "abc123" }],
  detectedDnsRecords: null,
  lastCheckedAt: "2026-09-18T10:00:00.000Z",
  managedByPlatform: false,
  registrarProvider: null,
  externalRegistrarId: null,
  purchasedAt: null,
  expiresAt: null,
  autoRenew: false,
  purchaseCostXOF: null,
  priceBilledXOF: null,
  paymentStatus: null,
  legalOwnerName: null,
  transferStatus: null,
  isLocked: true,
  createdAt: "2026-09-01T10:00:00.000Z",
  tenant: { id: "tenant-1", name: "Boutique Aïda", slug: "boutique-aida", status: "ACTIVE" },
};

const suspendedDomain = {
  ...activeDomain,
  id: "dom-2",
  domain: "old-suspended-domain.com",
  lifecycleStatus: "SUSPENDED",
  expectedDnsRecords: [],
};

function mockFetchSequence(handlers: Record<string, unknown>) {
  return vi.fn((input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();
    for (const [pattern, body] of Object.entries(handlers)) {
      if (url.includes(pattern)) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(body),
        } as Response);
      }
    }
    throw new Error(`URL non simulée dans ce test : ${url}`);
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AdminDomainsPanel", () => {
  it("charge et affiche la liste des domaines au montage, avec le badge de statut correct", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchSequence({ "/api/admin/domains?": { domains: [activeDomain, suspendedDomain] } }),
    );
    render(<AdminDomainsPanel />);

    expect(await screen.findByText("boutique-aida-test.com")).toBeInTheDocument();
    expect(screen.getByText("old-suspended-domain.com")).toBeInTheDocument();
    // "Actif"/"Suspendu" apparaissent aussi comme <option> du filtre de statut — on
    // cible donc précisément le badge affiché à côté de chaque ligne de domaine.
    const activeRow = screen.getByText("boutique-aida-test.com").closest("button")!;
    const suspendedRow = screen.getByText("old-suspended-domain.com").closest("button")!;
    expect(within(activeRow).getByText("Actif")).toBeInTheDocument();
    expect(within(suspendedRow).getByText("Suspendu")).toBeInTheDocument();
  });

  it("sélectionner un domaine charge son détail ET son journal d'audit", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchSequence({
        "/api/admin/domains?": { domains: [activeDomain] },
        "/audit-log": {
          entries: [
            { id: "log-1", action: "domain.custom_domain_added", actorType: "owner", createdAt: "2026-09-01T10:00:00.000Z" },
          ],
        },
      }),
    );
    render(<AdminDomainsPanel />);

    fireEvent.click(await screen.findByText("boutique-aida-test.com"));

    expect(await screen.findByText(/domain.custom_domain_added/)).toBeInTheDocument();
    // Détail : DNS attendu affiché, actions pertinentes pour un domaine ACTIF.
    expect(screen.getByText(/_yamacommerce-verification/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Suspendre" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Réactiver" })).not.toBeInTheDocument();
  });

  it("un domaine SUSPENDU propose « Réactiver » mais pas « Suspendre »", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchSequence({ "/api/admin/domains?": { domains: [suspendedDomain] }, "/audit-log": { entries: [] } }),
    );
    render(<AdminDomainsPanel />);

    fireEvent.click(await screen.findByText("old-suspended-domain.com"));

    expect(await screen.findByRole("button", { name: "Réactiver" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Suspendre" })).not.toBeInTheDocument();
  });

  it("retirer un domaine EXIGE une justification d'au moins 10 caractères avant d'appeler l'API", async () => {
    const fetchMock = mockFetchSequence({ "/api/admin/domains?": { domains: [activeDomain] }, "/audit-log": { entries: [] } });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", vi.fn(() => true));
    render(<AdminDomainsPanel />);

    fireEvent.click(await screen.findByText("boutique-aida-test.com"));
    fireEvent.click(await screen.findByRole("button", { name: "Retirer le domaine" }));

    // Justification vide -> le message d'erreur local s'affiche, AUCUN appel réseau
    // vers /remove (voir bodySchema.min(10) côté serveur, doublé ici côté client).
    expect(await screen.findByText(/au moins 10 caractères/)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/remove"))).toBe(false);
  });

  it("retirer un domaine avec une justification valide appelle POST /remove puis rafraîchit", async () => {
    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/remove") && init?.method === "POST") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) } as Response);
      }
      if (url.includes("/audit-log")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ entries: [] }) } as Response);
      }
      if (url.includes("/api/admin/domains?")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ domains: [activeDomain] }) } as Response);
      }
      throw new Error(`URL non simulée : ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", vi.fn(() => true));
    render(<AdminDomainsPanel />);

    fireEvent.click(await screen.findByText("boutique-aida-test.com"));
    fireEvent.change(screen.getByPlaceholderText(/ticket #1234/), {
      target: { value: "Demande du client par e-mail le 18/09, ticket #1234." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Retirer le domaine" }));

    await waitFor(() =>
      expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/remove"))).toBe(true),
    );
    const removeCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/remove"))!;
    expect(JSON.parse((removeCall[1] as RequestInit).body as string)).toEqual({
      justification: "Demande du client par e-mail le 18/09, ticket #1234.",
    });
  });
});
