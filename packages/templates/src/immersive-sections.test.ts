import { describe, expect, it } from "vitest";
import { isValidVariant, validateSectionInstance, validateSectionParams } from "./sections";

const instance = (sectionKey: string, variant: string, params: unknown) => ({ id: "s1", sectionKey, variant, params, order: 0 });

describe("sections immersives", () => {
  it("hero : titre obligatoire, valeurs par défaut sûres, calques bornés", () => {
    const parsed = validateSectionParams("immersive_hero", { title: "Nouvelle collection" }) as Record<string, unknown>;
    expect(parsed).toMatchObject({ focalX: 50, focalY: 50, layers: [], lighting: "halo", scrollEffect: "parallax", floating: true, intensity: "balanced" });
    expect(() => validateSectionParams("immersive_hero", { title: "" })).toThrow();
    const seven = Array.from({ length: 7 }, () => ({ imageUrl: "/demo-templates/x/y.webp" }));
    expect(() => validateSectionParams("immersive_hero", { title: "T", layers: seven })).toThrow();
    expect(() => validateSectionParams("immersive_hero", { title: "T", layers: [{ imageUrl: "/a.webp", depth: 2 }] })).toThrow();
  });

  it("refuse les liens et images dangereux (javascript:, //hôte), accepte médiathèque et chemins internes", () => {
    for (const bad of ["javascript:alert(1)", "//evil.example/x.png", "data:image/png;base64,AAA"]) {
      expect(() => validateSectionParams("immersive_hero", { title: "T", subjectImage: bad })).toThrow();
      expect(() => validateSectionParams("immersive_hero", { title: "T", primaryCtaHref: bad })).toThrow();
    }
    expect(() => validateSectionParams("immersive_hero", { title: "T", primaryCtaHref: "http://site.sn" })).toThrow();
    const ok = validateSectionParams("immersive_hero", { title: "T", subjectImage: "https://app.y-com.sn/api/media/abc/file", primaryCtaHref: "/catalogue" });
    expect(ok).toMatchObject({ subjectImage: "https://app.y-com.sn/api/media/abc/file", primaryCtaHref: "/catalogue" });
  });

  it("carrousel : source produits par défaut, contenus manuels sans prix imposé, intervalle borné", () => {
    const parsed = validateSectionParams("immersive_showcase", {}) as Record<string, unknown>;
    expect(parsed).toMatchObject({ source: "products", displayCount: 6, showPrice: true, autoplay: true, intervalSeconds: 6, items: [] });
    const manual = validateSectionParams("immersive_showcase", { source: "manual", showPrice: false, items: [{ title: "Casamance", imageUrl: "/api/media/x/file", href: "/offres/casamance" }] });
    expect(manual).toMatchObject({ source: "manual", showPrice: false });
    expect(() => validateSectionParams("immersive_showcase", { intervalSeconds: 1 })).toThrow();
    expect(() => validateSectionParams("immersive_showcase", { intervalSeconds: 60 })).toThrow();
  });

  it("récit : au moins une étape, au plus huit, zoom borné", () => {
    expect(() => validateSectionParams("scroll_story", { steps: [] })).toThrow();
    expect(() => validateSectionParams("scroll_story", { steps: Array.from({ length: 9 }, (_, i) => ({ title: `É${i}` })) })).toThrow();
    expect(() => validateSectionParams("scroll_story", { steps: [{ title: "Salon", zoom: 4 }] })).toThrow();
    expect(validateSectionParams("scroll_story", { steps: [{ title: "Salon" }] })).toMatchObject({ steps: [{ title: "Salon", focusX: 50, focusY: 50, zoom: 1 }] });
  });

  it("variantes par section, validées de bout en bout", () => {
    expect(isValidVariant("immersive_hero", "architectural")).toBe(true);
    expect(isValidVariant("immersive_showcase", "depth")).toBe(true);
    expect(isValidVariant("scroll_story", "timeline")).toBe(true);
    expect(() => validateSectionInstance(instance("immersive_hero", "grid", { title: "T" }))).toThrow(/Variante/);
    expect(validateSectionInstance(instance("scroll_story", "focus", { steps: [{ title: "Terrasse" }] })).sectionKey).toBe("scroll_story");
  });
});
