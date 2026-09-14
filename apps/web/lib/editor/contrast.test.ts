import { describe, expect, it } from "vitest";
import { contrastRatio, evaluateContrast, parseColor } from "./contrast";

describe("parseColor", () => {
  it("interprète un hex court et un hex long identiquement", () => {
    expect(parseColor("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColor("#ffffff")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("interprète rgb() et rgba()", () => {
    expect(parseColor("rgb(17, 34, 51)")).toEqual({ r: 17, g: 34, b: 51 });
    expect(parseColor("rgba(17, 34, 51, 0.5)")).toEqual({ r: 17, g: 34, b: 51 });
  });

  it("retourne null pour une valeur non interprétable (jamais un faux positif)", () => {
    expect(parseColor("var(--color-primary)")).toBeNull();
    expect(parseColor("rebeccapurple")).toBeNull();
    expect(parseColor("")).toBeNull();
  });
});

describe("contrastRatio", () => {
  it("noir sur blanc donne le ratio maximal (21:1)", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });

  it("une couleur sur elle-même donne un ratio de 1:1", () => {
    expect(contrastRatio("#336699", "#336699")).toBeCloseTo(1, 5);
  });

  it("est symétrique (l'ordre des deux couleurs ne change pas le résultat)", () => {
    const a = contrastRatio("#112233", "#eeeeee");
    const b = contrastRatio("#eeeeee", "#112233");
    expect(a).toBeCloseTo(b!, 10);
  });

  it("retourne null si une couleur n'est pas interprétable", () => {
    expect(contrastRatio("var(--x)", "#ffffff")).toBeNull();
  });
});

describe("evaluateContrast", () => {
  it("noir sur blanc réussit largement (pass)", () => {
    expect(evaluateContrast("#000000", "#ffffff").level).toBe("pass");
  });

  it("gris clair sur blanc échoue (fail, sous 3:1)", () => {
    const result = evaluateContrast("#d0d0d0", "#ffffff");
    expect(result.ratio).toBeLessThan(3);
    expect(result.level).toBe("fail");
  });

  it("un contraste intermédiaire déclenche un avertissement (warn, entre 3:1 et 4.5:1)", () => {
    // #767676 sur blanc est connu pour se situer juste sous le seuil AA (~4.54:1) —
    // on choisit une teinte légèrement plus claire pour retomber dans la zone "warn".
    const result = evaluateContrast("#949494", "#ffffff");
    expect(result.ratio).toBeGreaterThanOrEqual(3);
    expect(result.ratio).toBeLessThan(4.5);
    expect(result.level).toBe("warn");
  });

  it("ne bloque jamais sur une couleur non interprétable (pass par défaut)", () => {
    expect(evaluateContrast("var(--color-primary)", "#ffffff").level).toBe("pass");
  });
});
