import { describe, expect, it } from "vitest";
import { DEFAULT_DESIGN_TOKENS } from "@yamacommerce/design-tokens";
import {
  hasStyleOverride,
  hoverEffectClassName,
  spacingClassNameForSection,
  spacingOverrideToMediaCss,
  spacingValuesToStyle,
  styleOverrideToCssVars,
} from "./section-style";

describe("styleOverrideToCssVars", () => {
  it("ne pose aucune variable quand la surcharge est absente", () => {
    expect(styleOverrideToCssVars(undefined, DEFAULT_DESIGN_TOKENS)).toEqual({});
  });

  it("pose uniquement les variables des champs renseignés (jamais les autres)", () => {
    const style = styleOverrideToCssVars({ colorPrimary: "#112233" }, DEFAULT_DESIGN_TOKENS);
    expect(style).toEqual({ "--color-primary": "#112233" });
  });

  it("résout headingSize/bodySize contre les tokens EFFECTIFS (pas une valeur figée)", () => {
    const style = styleOverrideToCssVars({ headingSize: "lg" }, DEFAULT_DESIGN_TOKENS) as Record<
      string,
      string
    >;
    expect(style["--text-heading-lg"]).toBe(DEFAULT_DESIGN_TOKENS.typography.headingSizes.lg);
    // Toutes les tailles de titre sont alignées sur la même valeur choisie — voir la
    // note de section-style.ts : on ne peut pas savoir laquelle un composant donné
    // utilise réellement, donc on les uniformise toutes au sein de la section.
    expect(style["--text-heading-xs"]).toBe(DEFAULT_DESIGN_TOKENS.typography.headingSizes.lg);
  });

  it('résout radius:"none" en "0px" (pas une clé de `tokens.radii`)', () => {
    const style = styleOverrideToCssVars({ radius: "none" }, DEFAULT_DESIGN_TOKENS) as Record<
      string,
      string
    >;
    expect(style["--card-radius"]).toBe("0px");
  });

  it('résout shadow:"none" en "none"', () => {
    const style = styleOverrideToCssVars({ shadow: "none" }, DEFAULT_DESIGN_TOKENS) as Record<
      string,
      string
    >;
    expect(style["--card-shadow"]).toBe("none");
  });

  it("pose textAlign comme propriété CSS directe (pas une variable)", () => {
    const style = styleOverrideToCssVars({ textAlign: "center" }, DEFAULT_DESIGN_TOKENS);
    expect(style.textAlign).toBe("center");
  });
});

describe("hasStyleOverride", () => {
  it("faux pour undefined ou un objet vide", () => {
    expect(hasStyleOverride(undefined)).toBe(false);
    expect(hasStyleOverride({})).toBe(false);
  });

  it("vrai dès qu'un champ est renseigné", () => {
    expect(hasStyleOverride({ colorPrimary: "#000" })).toBe(true);
  });
});

describe("spacingValuesToStyle", () => {
  it("répartit paddingY/paddingX sur le haut/bas et gauche/droite", () => {
    const style = spacingValuesToStyle({ paddingY: "24px", paddingX: "16px" });
    expect(style).toEqual({
      paddingTop: "24px",
      paddingBottom: "24px",
      paddingLeft: "16px",
      paddingRight: "16px",
    });
  });

  it("ne pose que les champs renseignés", () => {
    expect(spacingValuesToStyle({ marginTop: "8px" })).toEqual({ marginTop: "8px" });
  });
});

describe("spacingOverrideToMediaCss", () => {
  it("génère une règle non conditionnelle pour mobile et des règles @media pour tablette/ordinateur", () => {
    const css = spacingOverrideToMediaCss("sec-space-hero-1", {
      mobile: { paddingY: "24px" },
      tablet: { paddingY: "48px" },
      desktop: { paddingY: "96px" },
    });
    expect(css).toContain(".sec-space-hero-1 { padding-top: 24px; padding-bottom: 24px; }");
    expect(css).toContain("@media (min-width: 640px)");
    expect(css).toContain("@media (min-width: 1024px)");
  });

  it("omet les points de rupture non renseignés", () => {
    const css = spacingOverrideToMediaCss("x", { desktop: { marginTop: "10px" } });
    expect(css).not.toContain("@media (min-width: 640px)");
    expect(css).toContain("@media (min-width: 1024px)");
  });
});

describe("spacingClassNameForSection", () => {
  it("assainit un identifiant en nom de classe CSS valide", () => {
    expect(spacingClassNameForSection("hero-1")).toBe("sec-space-hero-1");
    expect(spacingClassNameForSection("hero_1 copie!")).toBe("sec-space-hero_1-copie-");
  });
});

describe("hoverEffectClassName", () => {
  it('retourne une chaîne vide pour "none" ou absent', () => {
    expect(hoverEffectClassName(undefined)).toBe("");
    expect(hoverEffectClassName("none")).toBe("");
  });

  it("retourne des classes non vides pour lift/zoom/glow", () => {
    expect(hoverEffectClassName("lift")).not.toBe("");
    expect(hoverEffectClassName("zoom")).not.toBe("");
    expect(hoverEffectClassName("glow")).not.toBe("");
  });
});
