import { describe, expect, it } from "vitest";
import { validateSectionInstance, validateSectionParams, isValidVariant } from "./sections";

describe("validateSectionParams", () => {
  it("accepte des paramètres hero valides", () => {
    expect(() =>
      validateSectionParams("hero", {
        title: "Bienvenue",
        media: { url: "https://example.com/hero.jpg" },
      }),
    ).not.toThrow();
  });

  it("rejette des paramètres hero incomplets (titre manquant)", () => {
    expect(() =>
      validateSectionParams("hero", { media: { url: "https://example.com/x.jpg" } }),
    ).toThrow();
  });

  it("rejette une URL de média invalide", () => {
    expect(() =>
      validateSectionParams("hero", { title: "Bienvenue", media: { url: "pas-une-url" } }),
    ).toThrow();
  });
});

describe("sections ajoutées pour la refonte artistique (16 septembre 2026)", () => {
  it("accepte un manifeste de marque valide", () => {
    expect(() =>
      validateSectionParams("brand_manifesto", {
        statement: "Le luxe se porte, il se transmet.",
        media: { url: "https://example.com/manifesto.jpg" },
      }),
    ).not.toThrow();
  });

  it("accepte un produit signature valide", () => {
    expect(() =>
      validateSectionParams("signature_product", {
        title: "Le Sac Almadies",
        media: { url: "https://example.com/signature.jpg" },
      }),
    ).not.toThrow();
  });

  it("accepte une section héritage/savoir-faire valide", () => {
    expect(() =>
      validateSectionParams("heritage", {
        title: "Un savoir-faire dakarois",
        body: "Chaque pièce est façonnée à la main.",
        media: { url: "https://example.com/heritage.jpg" },
      }),
    ).not.toThrow();
  });

  it("accepte un lookbook avec hotspots produits", () => {
    expect(() =>
      validateSectionParams("lookbook", {
        images: [
          {
            url: "https://example.com/look-1.jpg",
            hotspots: [{ x: 40, y: 60, productId: "sac-cabas-cuir" }],
          },
        ],
      }),
    ).not.toThrow();
  });

  it("rejette un hotspot de lookbook hors bornes (x > 100)", () => {
    expect(() =>
      validateSectionParams("lookbook", {
        images: [{ url: "https://example.com/look-1.jpg", hotspots: [{ x: 140, y: 60, productId: "x" }] }],
      }),
    ).toThrow();
  });

  it("valide la variante « editorial » pour categories et testimonials", () => {
    expect(isValidVariant("categories", "editorial")).toBe(true);
    expect(isValidVariant("testimonials", "editorial")).toBe(true);
  });
});

describe("isValidVariant", () => {
  it("valide une variante connue", () => {
    expect(isValidVariant("hero", "split")).toBe(true);
  });

  it("refuse une variante inconnue", () => {
    expect(isValidVariant("hero", "n-importe-quoi")).toBe(false);
  });
});

describe("validateSectionInstance", () => {
  it("valide une instance complète et cohérente", () => {
    const instance = validateSectionInstance({
      id: "sec-1",
      sectionKey: "cta",
      variant: "banner",
      params: { title: "Profitez-en", buttonLabel: "Acheter", buttonHref: "/catalogue" },
      order: 3,
    });
    expect(instance.isEnabled).toBe(true);
    expect(instance.animationOverride).toBe("inherit");
  });

  it("rejette une variante incompatible avec la section", () => {
    expect(() =>
      validateSectionInstance({
        id: "sec-2",
        sectionKey: "cta",
        variant: "carousel", // n'existe pas pour "cta"
        params: { title: "x", buttonLabel: "y", buttonHref: "/z" },
        order: 1,
      }),
    ).toThrow(/Variante/);
  });

  it("rejette des paramètres invalides pour la section", () => {
    expect(() =>
      validateSectionInstance({
        id: "sec-3",
        sectionKey: "faq",
        variant: "accordion",
        params: { items: [] }, // min(1) requis
        order: 1,
      }),
    ).toThrow();
  });
});
