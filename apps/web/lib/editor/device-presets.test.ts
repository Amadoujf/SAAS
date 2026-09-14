import { describe, expect, it } from "vitest";
import {
  DEVICE_PRESETS,
  clampDimension,
  clampZoom,
  findDevicePreset,
  rotateDimensions,
  spacingBreakpointForWidth,
} from "./device-presets";

describe("DEVICE_PRESETS — largeurs à vérifier", () => {
  it("couvre exactement les 7 largeurs demandées : 320, 375, 390, 768, 1024, 1440, 1920", () => {
    const widths = DEVICE_PRESETS.map((preset) => preset.width).sort((a, b) => a - b);
    expect(widths).toEqual([320, 375, 390, 768, 1024, 1440, 1920]);
  });

  it("chaque préréglage a un id unique", () => {
    const ids = DEVICE_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("findDevicePreset retrouve un préréglage par id et renvoie undefined sinon", () => {
    expect(findDevicePreset("mobile-390")?.width).toBe(390);
    expect(findDevicePreset("introuvable")).toBeUndefined();
  });
});

describe("clampDimension", () => {
  it("laisse passer une valeur raisonnable", () => {
    expect(clampDimension(768)).toBe(768);
  });
  it("relève une valeur trop petite au minimum", () => {
    expect(clampDimension(10)).toBe(200);
  });
  it("plafonne une valeur trop grande au maximum", () => {
    expect(clampDimension(100000)).toBe(3840);
  });
  it("retombe sur le minimum pour une valeur non finie (NaN, Infinity)", () => {
    expect(clampDimension(Number.NaN)).toBe(200);
    expect(clampDimension(Number.POSITIVE_INFINITY)).toBe(200);
  });
  it("arrondit une valeur décimale", () => {
    expect(clampDimension(500.7)).toBe(501);
  });
});

describe("rotateDimensions", () => {
  it("permute largeur et hauteur", () => {
    expect(rotateDimensions({ width: 390, height: 844 })).toEqual({ width: 844, height: 390 });
  });
  it("appliquée deux fois, redonne les dimensions d'origine", () => {
    const original = { width: 1024, height: 768 };
    expect(rotateDimensions(rotateDimensions(original))).toEqual(original);
  });
});

describe("spacingBreakpointForWidth — mêmes seuils que les règles @media générées", () => {
  it("320/375/390 -> mobile", () => {
    expect(spacingBreakpointForWidth(320)).toBe("mobile");
    expect(spacingBreakpointForWidth(390)).toBe("mobile");
    expect(spacingBreakpointForWidth(639)).toBe("mobile");
  });
  it("640/768 -> tablet", () => {
    expect(spacingBreakpointForWidth(640)).toBe("tablet");
    expect(spacingBreakpointForWidth(768)).toBe("tablet");
    expect(spacingBreakpointForWidth(1023)).toBe("tablet");
  });
  it("1024/1440/1920 -> desktop (limite incluse, comme min-width: 1024px)", () => {
    expect(spacingBreakpointForWidth(1024)).toBe("desktop");
    expect(spacingBreakpointForWidth(1440)).toBe("desktop");
    expect(spacingBreakpointForWidth(1920)).toBe("desktop");
  });
});

describe("clampZoom", () => {
  it("laisse passer une valeur dans la plage", () => {
    expect(clampZoom(0.75)).toBe(0.75);
  });
  it("plafonne au maximum et relève au minimum", () => {
    expect(clampZoom(5)).toBe(1.5);
    expect(clampZoom(0.01)).toBe(0.25);
  });
  it("retombe sur 1 (100%) pour une valeur non finie", () => {
    expect(clampZoom(Number.NaN)).toBe(1);
  });
});
