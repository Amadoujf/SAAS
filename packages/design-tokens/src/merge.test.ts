import { describe, expect, it } from "vitest";
import { DEFAULT_DESIGN_TOKENS } from "./defaults";
import { mergeDesignTokens } from "./merge";
import { designTokensSchema } from "./schema";

describe("mergeDesignTokens", () => {
  it("ne modifie pas l'objet de base (immutabilité)", () => {
    const before = structuredClone(DEFAULT_DESIGN_TOKENS);
    mergeDesignTokens(DEFAULT_DESIGN_TOKENS, { colors: { primary: "#000000" } });
    expect(DEFAULT_DESIGN_TOKENS).toEqual(before);
  });

  it("la surcharge d'une clé remplace uniquement cette clé, pas tout le groupe", () => {
    const merged = mergeDesignTokens(DEFAULT_DESIGN_TOKENS, { colors: { primary: "#111111" } });
    expect(merged.colors.primary).toBe("#111111");
    expect(merged.colors.secondary).toBe(DEFAULT_DESIGN_TOKENS.colors.secondary);
  });

  it("sans surcharge, retourne l'équivalent de la base", () => {
    const merged = mergeDesignTokens(DEFAULT_DESIGN_TOKENS, undefined);
    expect(merged).toEqual(DEFAULT_DESIGN_TOKENS);
  });

  it("le résultat reste un DesignTokens valide", () => {
    const merged = mergeDesignTokens(DEFAULT_DESIGN_TOKENS, {
      buttonStyle: { shape: "pill" },
      animation: { level: "immersive" },
    });
    expect(() => designTokensSchema.parse(merged)).not.toThrow();
    expect(merged.buttonStyle.shape).toBe("pill");
    expect(merged.buttonStyle.variant).toBe(DEFAULT_DESIGN_TOKENS.buttonStyle.variant);
    expect(merged.animation.level).toBe("immersive");
  });

  it("rejette une fusion qui produirait un thème invalide", () => {
    expect(() =>
      mergeDesignTokens(DEFAULT_DESIGN_TOKENS, {
        // @ts-expect-error — valeur volontairement invalide pour ce test
        buttonStyle: { shape: "triangle" },
      }),
    ).toThrow();
  });
});

describe("DEFAULT_DESIGN_TOKENS", () => {
  it("est lui-même un DesignTokens valide", () => {
    expect(() => designTokensSchema.parse(DEFAULT_DESIGN_TOKENS)).not.toThrow();
  });
});
