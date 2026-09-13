import { describe, expect, it } from "vitest";
import type { SectionInstance } from "@yamacommerce/templates";
import {
  canRedo,
  canUndo,
  createInitialHistory,
  editorHistoryReducer,
  getSelectedPage,
  type EditorContent,
} from "./editor-reducer";

/**
 * Vérifie le cœur logique de l'éditeur visuel (voir docs/12 §12.2) — module pur, donc
 * entièrement testable sans base de données ni navigateur, contrairement à la fondation
 * de persistance (voir packages/database/tests/site-versions-registry.test.ts,
 * obligatoire en CI faute de PostgreSQL local).
 */

function section(
  overrides: Partial<SectionInstance> & { id: string; order: number },
): SectionInstance {
  return {
    sectionKey: "cta",
    variant: "banner",
    params: {},
    isEnabled: true,
    animationOverride: "inherit",
    ...overrides,
  };
}

function makeContent(): EditorContent {
  return {
    selectedPageId: "page-1",
    selectedSectionId: null,
    pages: [
      {
        id: "page-1",
        slug: "accueil",
        title: "Accueil",
        isHome: true,
        blocks: [
          section({ id: "hero-1", order: 0, sectionKey: "hero", variant: "split" }),
          section({ id: "benefits-1", order: 1, sectionKey: "benefits", variant: "cards" }),
          section({ id: "cta-1", order: 2 }),
        ],
      },
      {
        id: "page-2",
        slug: "contact",
        title: "Contact",
        isHome: false,
        blocks: [
          section({ id: "contact-1", order: 0, sectionKey: "contact", variant: "centered" }),
        ],
      },
    ],
  };
}

describe("editorHistoryReducer — sélection (jamais dans l'historique)", () => {
  it("change la page sélectionnée et réinitialise la section sélectionnée", () => {
    const state = createInitialHistory({ ...makeContent(), selectedSectionId: "hero-1" });
    const next = editorHistoryReducer(state, { type: "SELECT_PAGE", pageId: "page-2" });
    expect(next.present.selectedPageId).toBe("page-2");
    expect(next.present.selectedSectionId).toBeNull();
    expect(canUndo(next)).toBe(false);
  });

  it("sélectionne une section sans empiler dans l'historique", () => {
    const state = createInitialHistory(makeContent());
    const next = editorHistoryReducer(state, { type: "SELECT_SECTION", sectionId: "benefits-1" });
    expect(next.present.selectedSectionId).toBe("benefits-1");
    expect(canUndo(next)).toBe(false);
  });
});

describe("editorHistoryReducer — réordonnancement (glisser-déposer)", () => {
  it("réordonne les sections d'une page et renumérote `order`", () => {
    const state = createInitialHistory(makeContent());
    const next = editorHistoryReducer(state, {
      type: "REORDER_SECTIONS",
      pageId: "page-1",
      orderedIds: ["cta-1", "hero-1", "benefits-1"],
    });
    const page = getSelectedPage(next.present)!;
    expect(page.blocks.map((b) => b.id)).toEqual(["cta-1", "hero-1", "benefits-1"]);
    expect(page.blocks.map((b) => b.order)).toEqual([0, 1, 2]);
    expect(canUndo(next)).toBe(true);
  });

  it("ignore un réordonnancement incohérent (id manquant) plutôt que de perdre une section", () => {
    const state = createInitialHistory(makeContent());
    const next = editorHistoryReducer(state, {
      type: "REORDER_SECTIONS",
      pageId: "page-1",
      orderedIds: ["cta-1", "hero-1"], // "benefits-1" manquant
    });
    expect(next).toBe(state); // aucune mutation, aucun empilement d'historique
  });

  it("ne touche pas aux sections d'une autre page", () => {
    const state = createInitialHistory(makeContent());
    const next = editorHistoryReducer(state, {
      type: "REORDER_SECTIONS",
      pageId: "page-1",
      orderedIds: ["cta-1", "hero-1", "benefits-1"],
    });
    const otherPage = next.present.pages.find((p) => p.id === "page-2")!;
    expect(otherPage.blocks.map((b) => b.id)).toEqual(["contact-1"]);
  });
});

describe("editorHistoryReducer — masquage/duplication/suppression", () => {
  it("bascule isEnabled sans affecter les autres sections", () => {
    const state = createInitialHistory(makeContent());
    const next = editorHistoryReducer(state, {
      type: "TOGGLE_SECTION_ENABLED",
      pageId: "page-1",
      sectionId: "benefits-1",
    });
    const page = getSelectedPage(next.present)!;
    expect(page.blocks.find((b) => b.id === "benefits-1")?.isEnabled).toBe(false);
    expect(page.blocks.find((b) => b.id === "hero-1")?.isEnabled).toBe(true);
  });

  it("dupliquer insère une copie juste après l'original, toujours activée", () => {
    const state = createInitialHistory(makeContent());
    // Le "masquage" ne doit pas se propager à une duplication ultérieure du même id —
    // on part d'un état frais pour ce test.
    const next = editorHistoryReducer(state, {
      type: "DUPLICATE_SECTION",
      pageId: "page-1",
      sectionId: "hero-1",
      newId: "hero-1-copy",
    });
    const page = getSelectedPage(next.present)!;
    expect(page.blocks.map((b) => b.id)).toEqual(["hero-1", "hero-1-copy", "benefits-1", "cta-1"]);
    expect(page.blocks.map((b) => b.order)).toEqual([0, 1, 2, 3]);
    const copy = page.blocks.find((b) => b.id === "hero-1-copy")!;
    expect(copy.sectionKey).toBe("hero");
    expect(copy.variant).toBe("split");
    expect(copy.isEnabled).toBe(true);
  });

  it("dupliquer une section masquée produit une copie visible (jamais masquée par héritage)", () => {
    const state = createInitialHistory(makeContent());
    const hidden = editorHistoryReducer(state, {
      type: "TOGGLE_SECTION_ENABLED",
      pageId: "page-1",
      sectionId: "hero-1",
    });
    const duplicated = editorHistoryReducer(hidden, {
      type: "DUPLICATE_SECTION",
      pageId: "page-1",
      sectionId: "hero-1",
      newId: "hero-1-copy",
    });
    const page = getSelectedPage(duplicated.present)!;
    expect(page.blocks.find((b) => b.id === "hero-1")?.isEnabled).toBe(false);
    expect(page.blocks.find((b) => b.id === "hero-1-copy")?.isEnabled).toBe(true);
  });

  it("supprimer retire la section et renumérote les suivantes", () => {
    const state = createInitialHistory(makeContent());
    const next = editorHistoryReducer(state, {
      type: "DELETE_SECTION",
      pageId: "page-1",
      sectionId: "benefits-1",
    });
    const page = getSelectedPage(next.present)!;
    expect(page.blocks.map((b) => b.id)).toEqual(["hero-1", "cta-1"]);
    expect(page.blocks.map((b) => b.order)).toEqual([0, 1]);
  });

  it("supprimer un id inexistant est un no-op qui n'empile pas l'historique", () => {
    const state = createInitialHistory(makeContent());
    const next = editorHistoryReducer(state, {
      type: "DELETE_SECTION",
      pageId: "page-1",
      sectionId: "n-existe-pas",
    });
    expect(next).toBe(state);
  });
});

describe("editorHistoryReducer — annuler / rétablir", () => {
  it("annule la dernière action de contenu et restaure l'état précédent exact", () => {
    const state = createInitialHistory(makeContent());
    const afterDelete = editorHistoryReducer(state, {
      type: "DELETE_SECTION",
      pageId: "page-1",
      sectionId: "benefits-1",
    });
    const undone = editorHistoryReducer(afterDelete, { type: "UNDO" });
    expect(undone.present).toEqual(state.present);
    expect(canUndo(undone)).toBe(false);
    expect(canRedo(undone)).toBe(true);
  });

  it("rétablit ce qui vient d'être annulé", () => {
    const state = createInitialHistory(makeContent());
    const afterDelete = editorHistoryReducer(state, {
      type: "DELETE_SECTION",
      pageId: "page-1",
      sectionId: "benefits-1",
    });
    const undone = editorHistoryReducer(afterDelete, { type: "UNDO" });
    const redone = editorHistoryReducer(undone, { type: "REDO" });
    expect(redone.present).toEqual(afterDelete.present);
    expect(canRedo(redone)).toBe(false);
  });

  it("une nouvelle action de contenu après un annuler efface le futur (pas de rétablir incohérent)", () => {
    const state = createInitialHistory(makeContent());
    const afterDelete = editorHistoryReducer(state, {
      type: "DELETE_SECTION",
      pageId: "page-1",
      sectionId: "benefits-1",
    });
    const undone = editorHistoryReducer(afterDelete, { type: "UNDO" });
    const afterToggle = editorHistoryReducer(undone, {
      type: "TOGGLE_SECTION_ENABLED",
      pageId: "page-1",
      sectionId: "hero-1",
    });
    expect(canRedo(afterToggle)).toBe(false);
  });

  it("annuler/rétablir sur une pile vide ne change rien", () => {
    const state = createInitialHistory(makeContent());
    expect(editorHistoryReducer(state, { type: "UNDO" })).toBe(state);
    expect(editorHistoryReducer(state, { type: "REDO" })).toBe(state);
  });

  it("changer de sélection n'est jamais annulé par UNDO (seul le contenu l'est)", () => {
    const state = createInitialHistory(makeContent());
    const afterDelete = editorHistoryReducer(state, {
      type: "DELETE_SECTION",
      pageId: "page-1",
      sectionId: "benefits-1",
    });
    const afterSelect = editorHistoryReducer(afterDelete, {
      type: "SELECT_SECTION",
      sectionId: "hero-1",
    });
    const undone = editorHistoryReducer(afterSelect, { type: "UNDO" });
    // L'annulation porte sur la dernière action de CONTENU (la suppression), la
    // sélection n'ayant jamais été empilée — benefits-1 doit donc réapparaître.
    const page = getSelectedPage(undone.present)!;
    expect(page.blocks.map((b) => b.id)).toContain("benefits-1");
  });
});
