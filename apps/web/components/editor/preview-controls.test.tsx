import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PreviewControls } from "./preview-controls";
import { CUSTOM_DEVICE_ID, DEVICE_PRESETS } from "@/lib/editor/device-presets";

function setup(overrides: Partial<Parameters<typeof PreviewControls>[0]> = {}) {
  const handlers = {
    onSelectDevice: vi.fn(),
    onCustomDimensionsChange: vi.fn(),
    onRotate: vi.fn(),
    onZoomChange: vi.fn(),
    onReload: vi.fn(),
  };
  render(
    <PreviewControls
      deviceId="desktop-1440"
      dimensions={{ width: 1440, height: 900 }}
      zoom={1}
      {...handlers}
      {...overrides}
    />,
  );
  return handlers;
}

describe("PreviewControls — DIFFÉRENTS APPAREILS", () => {
  it("propose une option pour chacun des 7 préréglages", () => {
    setup();
    const select = screen.getByLabelText("Préréglage d'appareil") as HTMLSelectElement;
    for (const preset of DEVICE_PRESETS) {
      expect(
        Array.from(select.options).some((option) => option.value === preset.id),
      ).toBe(true);
    }
  });

  it("change d'appareil au choix dans le menu", () => {
    const handlers = setup();
    fireEvent.change(screen.getByLabelText("Préréglage d'appareil"), {
      target: { value: "mobile-390" },
    });
    expect(handlers.onSelectDevice).toHaveBeenCalledWith("mobile-390");
  });

  it("affiche les champs de dimensions personnalisées uniquement en mode Personnalisé", () => {
    setup();
    expect(screen.queryByLabelText("Largeur personnalisée")).not.toBeInTheDocument();
  });

  it("dimensions personnalisées : modifier la largeur ou la hauteur appelle onCustomDimensionsChange", () => {
    const handlers = setup({ deviceId: CUSTOM_DEVICE_ID, dimensions: { width: 500, height: 800 } });
    fireEvent.change(screen.getByLabelText("Largeur personnalisée"), { target: { value: "600" } });
    expect(handlers.onCustomDimensionsChange).toHaveBeenCalledWith({ width: 600, height: 800 });
  });

  it("le bouton de rotation appelle onRotate", () => {
    const handlers = setup();
    fireEvent.click(screen.getByLabelText("Rotation portrait/paysage"));
    expect(handlers.onRotate).toHaveBeenCalled();
  });

  it("le sélecteur de zoom appelle onZoomChange", () => {
    const handlers = setup();
    fireEvent.change(screen.getByLabelText("Zoom de l'aperçu"), { target: { value: "0.5" } });
    expect(handlers.onZoomChange).toHaveBeenCalledWith(0.5);
  });

  it("le bouton de rechargement appelle onReload", () => {
    const handlers = setup();
    fireEvent.click(screen.getByLabelText("Recharger l'aperçu"));
    expect(handlers.onReload).toHaveBeenCalled();
  });
});
