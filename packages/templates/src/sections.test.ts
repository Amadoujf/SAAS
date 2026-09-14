import { describe, expect, it } from "vitest";
import {
  validateSectionInstance,
  validateSectionParams,
  isValidVariant,
  sectionStyleOverrideSchema,
  sectionSpacingOverrideSchema,
  sectionAnimationDetailSchema,
} from "./sections";

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
        images: [
          { url: "https://example.com/look-1.jpg", hotspots: [{ x: 140, y: 60, productId: "x" }] },
        ],
      }),
    ).toThrow();
  });

  it("valide la variante « editorial » pour categories et testimonials", () => {
    expect(isValidVariant("categories", "editorial")).toBe(true);
    expect(isValidVariant("testimonials", "editorial")).toBe(true);
  });
});

describe("sections ajoutées pour Teranga Atelier (20 septembre 2026)", () => {
  it("accepte un produit signature avec mécaniques édition limitée", () => {
    expect(() =>
      validateSectionParams("signature_product", {
        title: "Le Boubou Sabar",
        media: { url: "https://example.com/signature.jpg" },
        piecesRemaining: 7,
        isPreorder: true,
        preorderReleaseDate: "2026-12-01",
      }),
    ).not.toThrow();
  });

  it("accepte une section créateurs en vedette", () => {
    expect(() =>
      validateSectionParams("designers", { designerIds: ["aissatou-diop"] }),
    ).not.toThrow();
  });

  it("rejette une section créateurs sans identifiant", () => {
    expect(() => validateSectionParams("designers", { designerIds: [] })).toThrow();
  });

  it("accepte une section provenance avec régions valides", () => {
    expect(() =>
      validateSectionParams("provenance", {
        regions: [
          {
            id: "casamance",
            name: "Casamance",
            craft: "Tissage",
            description: "Tissage traditionnel en coton local.",
            media: { url: "https://example.com/casamance.jpg" },
            x: 30,
            y: 70,
          },
        ],
      }),
    ).not.toThrow();
  });

  it("rejette une région de provenance hors bornes (y > 100)", () => {
    expect(() =>
      validateSectionParams("provenance", {
        regions: [
          {
            id: "x",
            name: "x",
            craft: "x",
            description: "x",
            media: { url: "https://example.com/x.jpg" },
            x: 30,
            y: 140,
          },
        ],
      }),
    ).toThrow();
  });
});

describe("section ajoutée pour Dakar Distribution Pro (20 septembre 2026)", () => {
  it("accepte une recherche catalogue valide", () => {
    expect(() =>
      validateSectionParams("catalog_search", {
        title: "Trouvez le produit qu'il vous faut",
        quickCategories: [{ label: "Électronique", href: "/catalogue/electronique" }],
      }),
    ).not.toThrow();
  });

  it("rejette une recherche catalogue sans titre", () => {
    expect(() => validateSectionParams("catalog_search", {})).toThrow();
  });
});

describe("panneaux avancés de personnalisation (20 septembre 2026)", () => {
  it("accepte une instance de section sans aucune surcharge (comportement hérité)", () => {
    const instance = validateSectionInstance({
      id: "s1",
      sectionKey: "cta",
      variant: "banner",
      params: { title: "x", buttonLabel: "y", buttonHref: "/z" },
      order: 0,
    });
    expect(instance.styleOverride).toBeUndefined();
    expect(instance.spacingOverride).toBeUndefined();
    expect(instance.animationDetail).toBeUndefined();
  });

  it("accepte une instance avec les trois surcharges renseignées", () => {
    const instance = validateSectionInstance({
      id: "s2",
      sectionKey: "cta",
      variant: "banner",
      params: { title: "x", buttonLabel: "y", buttonHref: "/z" },
      order: 0,
      styleOverride: { colorPrimary: "#112233", headingSize: "lg", textAlign: "center" },
      spacingOverride: { mobile: { paddingY: "24px" }, desktop: { paddingY: "96px" } },
      animationDetail: { type: "slide", direction: "left", durationMs: 400, hoverEffect: "lift" },
    });
    expect(instance.styleOverride?.colorPrimary).toBe("#112233");
    expect(instance.spacingOverride?.mobile?.paddingY).toBe("24px");
    expect(instance.animationDetail?.hoverEffect).toBe("lift");
  });

  it("rejette une taille de titre hors énumération", () => {
    expect(() => sectionStyleOverrideSchema.parse({ headingSize: "huge" })).toThrow();
  });

  it("rejette une durée d'animation négative ou excessive", () => {
    expect(() => sectionAnimationDetailSchema.parse({ durationMs: -5 })).toThrow();
    expect(() => sectionAnimationDetailSchema.parse({ durationMs: 10_000 })).toThrow();
  });

  it("accepte un espacement partiel (un seul point de rupture renseigné)", () => {
    expect(() => sectionSpacingOverrideSchema.parse({ tablet: { marginTop: "16px" } })).not.toThrow();
  });

  it("rejette une chaîne vide pour un champ de style renseigné", () => {
    expect(() => sectionStyleOverrideSchema.parse({ colorPrimary: "" })).toThrow();
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
