import { describe, expect, it } from "vitest";
import type { SectionInstance } from "@yamacommerce/templates";
import { findMediaReferencesInPages, findMediaReferencesInSection } from "./media-references";

const TARGET = "https://cdn.example.com/media/photo.jpg";
const OTHER = "https://cdn.example.com/media/other.jpg";

function hero(mediaUrl: string): SectionInstance {
  return {
    id: "hero-1",
    sectionKey: "hero",
    variant: "split",
    order: 0,
    isEnabled: true,
    animationOverride: "inherit",
    params: { title: "Bienvenue", media: { url: mediaUrl, alt: "x" } },
  };
}

function gallery(urls: string[]): SectionInstance {
  return {
    id: "gallery-1",
    sectionKey: "gallery",
    variant: "grid",
    order: 1,
    isEnabled: true,
    animationOverride: "inherit",
    params: { images: urls.map((url) => ({ url, alt: "" })) },
  };
}

describe("findMediaReferencesInSection", () => {
  it("détecte une référence dans un champ média imbriqué (hero.media.url)", () => {
    expect(findMediaReferencesInSection(hero(TARGET), TARGET)).toEqual(["media.url"]);
  });

  it("ne détecte rien quand l'URL ne correspond pas", () => {
    expect(findMediaReferencesInSection(hero(OTHER), TARGET)).toEqual([]);
  });

  it("détecte plusieurs occurrences dans un tableau d'objets (gallery.images[i].url)", () => {
    const section = gallery([OTHER, TARGET, TARGET]);
    expect(findMediaReferencesInSection(section, TARGET)).toEqual(["images[1].url", "images[2].url"]);
  });

  it("ne plante jamais pour une clé de section inconnue (schéma introuvable)", () => {
    const unknown = { ...hero(TARGET), sectionKey: "future_sector_section" as never };
    expect(() => findMediaReferencesInSection(unknown, TARGET)).not.toThrow();
    expect(findMediaReferencesInSection(unknown, TARGET)).toEqual([]);
  });
});

describe("findMediaReferencesInPages", () => {
  it("regroupe les sections concernées à travers plusieurs pages", () => {
    const pages = [
      { id: "home", slug: "accueil", title: "Accueil", blocks: [hero(TARGET), gallery([OTHER])] },
      { id: "about", slug: "a-propos", title: "À propos", blocks: [gallery([TARGET, TARGET])] },
    ];
    const usage = findMediaReferencesInPages(pages, TARGET);
    expect(usage).toHaveLength(2);
    expect(usage[0]).toMatchObject({ pageSlug: "accueil", sectionId: "hero-1", fieldPaths: ["media.url"] });
    expect(usage[1]).toMatchObject({
      pageSlug: "a-propos",
      sectionId: "gallery-1",
      fieldPaths: ["images[0].url", "images[1].url"],
    });
  });

  it("retourne un tableau vide quand aucune page ne référence le média", () => {
    const pages = [{ id: "home", slug: "accueil", title: "Accueil", blocks: [hero(OTHER)] }];
    expect(findMediaReferencesInPages(pages, TARGET)).toEqual([]);
  });
});
