import { describe, expect, it } from "vitest";
import { validateTemplateManifest } from "./manifest";

function heroSection(id: string, order: number) {
  return {
    id,
    sectionKey: "hero" as const,
    variant: "split",
    params: { title: "Titre", media: { url: "https://example.com/img.jpg" } },
    order,
  };
}

describe("validateTemplateManifest", () => {
  it("valide un manifeste simple avec une page d'accueil", () => {
    const manifest = validateTemplateManifest({
      pages: [
        { slug: "accueil", title: "Accueil", isHome: true, sections: [heroSection("s1", 0)] },
      ],
    });
    expect(manifest.pages).toHaveLength(1);
  });

  it("rejette plusieurs pages marquées isHome", () => {
    expect(() =>
      validateTemplateManifest({
        pages: [
          { slug: "a", title: "A", isHome: true, sections: [] },
          { slug: "b", title: "B", isHome: true, sections: [] },
        ],
      }),
    ).toThrow(/une seule page/);
  });

  it("rejette des slugs de page dupliqués", () => {
    expect(() =>
      validateTemplateManifest({
        pages: [
          { slug: "a", title: "A", sections: [] },
          { slug: "a", title: "A bis", sections: [] },
        ],
      }),
    ).toThrow(/dupliqué/);
  });

  it("rejette des identifiants de section dupliqués sur une même page", () => {
    expect(() =>
      validateTemplateManifest({
        pages: [
          { slug: "a", title: "A", sections: [heroSection("dup", 0), heroSection("dup", 1)] },
        ],
      }),
    ).toThrow(/dupliqué/);
  });

  it("propage la validation d'une section invalide", () => {
    expect(() =>
      validateTemplateManifest({
        pages: [
          {
            slug: "a",
            title: "A",
            sections: [{ id: "s1", sectionKey: "hero", variant: "split", params: {}, order: 0 }],
          },
        ],
      }),
    ).toThrow();
  });
});
