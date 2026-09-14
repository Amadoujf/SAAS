import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DEFAULT_DESIGN_TOKENS } from "@yamacommerce/design-tokens";
import type { SectionInstance } from "@yamacommerce/templates";
import { createEmptySiteSettings } from "@/lib/editor/site-settings";
import { CustomizationPanel } from "./customization-panel";

const baseSection: SectionInstance = {
  id: "hero-1",
  sectionKey: "hero",
  variant: "split",
  params: { title: "Bienvenue", media: { url: "https://x.test/a.jpg" } },
  order: 0,
  isEnabled: true,
  animationOverride: "inherit",
};

function renderPanel(overrides?: Partial<Parameters<typeof CustomizationPanel>[0]>) {
  const handlers = {
    onModeChange: vi.fn(),
    onUpdateParams: vi.fn(),
    onUpdateStyle: vi.fn(),
    onUpdateSpacing: vi.fn(),
    onUpdateAnimation: vi.fn(),
    onUpdateSiteSettings: vi.fn(),
  };
  render(
    <CustomizationPanel
      mode="section"
      section={baseSection}
      originalSection={baseSection}
      tokens={DEFAULT_DESIGN_TOKENS}
      viewport="desktop"
      siteSettings={createEmptySiteSettings()}
      originalSiteSettings={createEmptySiteSettings()}
      {...handlers}
      {...overrides}
    />,
  );
  return handlers;
}

describe("CustomizationPanel — mode section", () => {
  it("affiche un message d'invitation quand aucune section n'est sélectionnée", () => {
    renderPanel({ section: undefined, originalSection: undefined });
    expect(screen.getByText(/Sélectionnez une section/)).toBeInTheDocument();
  });

  it("affiche les 4 onglets et le contenu généré pour la section sélectionnée", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: "Contenu" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Style" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Espacement" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Animation" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Bienvenue")).toBeInTheDocument();
  });

  it("modifier un champ du contenu appelle onUpdateParams avec les paramètres complets", () => {
    const handlers = renderPanel();
    fireEvent.change(screen.getByDisplayValue("Bienvenue"), { target: { value: "Nouveau titre" } });
    expect(handlers.onUpdateParams).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Nouveau titre" }),
    );
  });

  it("passer à l'onglet Style puis modifier une couleur appelle onUpdateStyle", () => {
    const handlers = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Style" }));
    const colorTextInputs = screen.getAllByPlaceholderText(/var\(--color-primary\)/);
    fireEvent.change(colorTextInputs[0]!, { target: { value: "#112233" } });
    expect(handlers.onUpdateStyle).toHaveBeenCalledWith(
      expect.objectContaining({ colorPrimary: "#112233" }),
    );
  });

  it("affiche le bouton de retour au template et un indicateur quand une section a une surcharge", () => {
    const customized: SectionInstance = {
      ...baseSection,
      styleOverride: { colorPrimary: "#ff0000" },
    };
    const handlers = renderPanel({ section: customized });
    fireEvent.click(screen.getByRole("button", { name: /^Style/ }));
    expect(screen.getByRole("button", { name: /Retour aux valeurs du template/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Retour aux valeurs du template/ }));
    expect(handlers.onUpdateStyle).toHaveBeenCalledWith(baseSection.styleOverride);
  });
});

describe("CustomizationPanel — mode site", () => {
  it("affiche les paramètres généraux du site quand le mode est 'site'", () => {
    renderPanel({ mode: "site" });
    expect(screen.getByText("Palette")).toBeInTheDocument();
    expect(screen.getByText("Polices")).toBeInTheDocument();
    expect(screen.getByLabelText("Logo")).toBeInTheDocument();
  });

  it("modifier le logo appelle onUpdateSiteSettings", () => {
    const handlers = renderPanel({ mode: "site" });
    fireEvent.change(screen.getByLabelText("Logo"), { target: { value: "https://x.test/logo.png" } });
    expect(handlers.onUpdateSiteSettings).toHaveBeenCalledWith(
      expect.objectContaining({ logoUrl: "https://x.test/logo.png" }),
    );
  });
});
