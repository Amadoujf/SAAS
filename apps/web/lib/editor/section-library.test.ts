import { describe, expect, it } from "vitest";
import { SECTION_PRESETS, instantiatePreset, presetsForSector } from "./section-library";
import { createInitialHistory, editorHistoryReducer } from "./editor-reducer";
import { createEmptySiteSettings } from "./site-settings";

describe("bibliothèque de sections de l'éditeur", () => {
  it("chaque préréglage produit une section valide, sans prix ni produit imposé", () => {
    for (const preset of SECTION_PRESETS) {
      const instance = instantiatePreset(preset, `s-${preset.id}`);
      expect(instance.sectionKey).toBe(preset.sectionKey);
      expect(JSON.stringify(instance.params)).not.toMatch(/FCFA|\d{3} \d{3}/);
      expect(instance.params).not.toHaveProperty("productIds");
    }
  });
  it("suggestions du secteur en premier", () => {
    expect(presetsForSector("real_estate")[0]!.id).toBe("hero-architecture");
    expect(presetsForSector("ecommerce")[0]!.id).toBe("hero-scene");
    expect(presetsForSector(null)).toHaveLength(SECTION_PRESETS.length);
  });
  it("ADD_SECTION insère après la section choisie, la sélectionne et s'annule", () => {
    const base = { pages: [{ id: "p", slug: "accueil", title: "Accueil", isHome: true, blocks: [instantiatePreset(SECTION_PRESETS[0]!, "a"), instantiatePreset(SECTION_PRESETS[3]!, "b")] }], selectedPageId: "p", selectedSectionId: null, siteSettings: createEmptySiteSettings() };
    let state = createInitialHistory(base);
    state = editorHistoryReducer(state, { type: "ADD_SECTION", pageId: "p", section: instantiatePreset(SECTION_PRESETS[6]!, "c"), afterSectionId: "a" });
    expect(state.present.pages[0]!.blocks.map((b) => b.id)).toEqual(["a", "c", "b"]);
    expect(state.present.pages[0]!.blocks.map((b) => b.order)).toEqual([0, 1, 2]);
    expect(state.present.selectedSectionId).toBe("c");
    state = editorHistoryReducer(state, { type: "UNDO" });
    expect(state.present.pages[0]!.blocks.map((b) => b.id)).toEqual(["a", "b"]);
  });
});
