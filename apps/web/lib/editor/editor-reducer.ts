import type { SectionInstance } from "@yamacommerce/templates";

/**
 * Cœur logique de l'éditeur visuel — voir docs/12 §12.2. Module VOLONTAIREMENT pur
 * (aucun accès réseau/DB, aucun `Date.now()`/`Math.random()` interne — les identifiants
 * de duplication sont fournis par l'appelant) : c'est ce qui le rend sector-agnostic
 * (il ne connaît que `SectionInstance`, le même type utilisé par les 5 templates
 * e-commerce ET par n'importe quel futur secteur — voir @yamacommerce/templates) et
 * entièrement testable sans base de données ni navigateur.
 *
 * L'undo/rétablir (docs/12 §12.2, « Historique / Annuler-rétablir ») utilise le
 * classique triptyque past/present/future : seules les actions qui modifient le
 * CONTENU (réordonner, masquer, dupliquer, supprimer) empilent dans `past` — la simple
 * navigation (changer de page/section sélectionnée) ne pollue jamais l'historique.
 */

export interface EditorPage {
  id: string;
  slug: string;
  title: string;
  isHome: boolean;
  blocks: SectionInstance[];
}

export interface EditorContent {
  pages: EditorPage[];
  selectedPageId: string;
  selectedSectionId: string | null;
}

export interface EditorHistoryState {
  past: EditorContent[];
  present: EditorContent;
  future: EditorContent[];
}

export type EditorAction =
  | { type: "SELECT_PAGE"; pageId: string }
  | { type: "SELECT_SECTION"; sectionId: string | null }
  | { type: "REORDER_SECTIONS"; pageId: string; orderedIds: string[] }
  | { type: "TOGGLE_SECTION_ENABLED"; pageId: string; sectionId: string }
  | { type: "DUPLICATE_SECTION"; pageId: string; sectionId: string; newId: string }
  | { type: "DELETE_SECTION"; pageId: string; sectionId: string }
  | { type: "UNDO" }
  | { type: "REDO" };

const MAX_HISTORY = 50;

export function createInitialHistory(content: EditorContent): EditorHistoryState {
  return { past: [], present: content, future: [] };
}

/** Renumérote `order` de façon contiguë selon la position réelle dans le tableau —
 *  évite toute dérive de valeurs après plusieurs réordonnancements/suppressions. */
function renormalizeOrder(blocks: SectionInstance[]): SectionInstance[] {
  return blocks.map((block, index) => ({ ...block, order: index }));
}

/** Retourne `content` INCHANGÉ (même référence) si `fn` n'a produit aucune
 *  modification réelle de la page ciblée — c'est ce qui permet à
 *  `editorHistoryReducer` de détecter un no-op (ex. id introuvable) via une simple
 *  égalité de référence et de ne rien empiler dans l'historique. */
function mapPage(
  content: EditorContent,
  pageId: string,
  fn: (page: EditorPage) => EditorPage,
): EditorContent {
  let changed = false;
  const pages = content.pages.map((page) => {
    if (page.id !== pageId) return page;
    const next = fn(page);
    if (next !== page) changed = true;
    return next;
  });
  return changed ? { ...content, pages } : content;
}

/** Applique une action de CONTENU (pas une simple sélection) sur l'état courant. */
function applyContentAction(content: EditorContent, action: EditorAction): EditorContent {
  switch (action.type) {
    case "REORDER_SECTIONS": {
      return mapPage(content, action.pageId, (page) => {
        const byId = new Map(page.blocks.map((block) => [block.id, block]));
        const reordered = action.orderedIds
          .map((id) => byId.get(id))
          .filter((block): block is SectionInstance => Boolean(block));
        // Sécurité : si un id envoyé ne correspond à aucun bloc connu (état
        // incohérent côté appelant), on ignore silencieusement le réordonnancement
        // plutôt que de perdre des sections — jamais de suppression implicite.
        if (reordered.length !== page.blocks.length) return page;
        return { ...page, blocks: renormalizeOrder(reordered) };
      });
    }

    case "TOGGLE_SECTION_ENABLED": {
      return mapPage(content, action.pageId, (page) => {
        if (!page.blocks.some((block) => block.id === action.sectionId)) return page;
        return {
          ...page,
          blocks: page.blocks.map((block) =>
            block.id === action.sectionId ? { ...block, isEnabled: !block.isEnabled } : block,
          ),
        };
      });
    }

    case "DUPLICATE_SECTION": {
      return mapPage(content, action.pageId, (page) => {
        const sourceIndex = page.blocks.findIndex((block) => block.id === action.sectionId);
        if (sourceIndex === -1) return page;
        const source = page.blocks[sourceIndex]!;
        const copy: SectionInstance = { ...source, id: action.newId, isEnabled: true };
        const blocks = [
          ...page.blocks.slice(0, sourceIndex + 1),
          copy,
          ...page.blocks.slice(sourceIndex + 1),
        ];
        return { ...page, blocks: renormalizeOrder(blocks) };
      });
    }

    case "DELETE_SECTION": {
      return mapPage(content, action.pageId, (page) => {
        if (!page.blocks.some((block) => block.id === action.sectionId)) return page;
        return {
          ...page,
          blocks: renormalizeOrder(page.blocks.filter((block) => block.id !== action.sectionId)),
        };
      });
    }

    default:
      return content;
  }
}

const CONTENT_ACTION_TYPES = new Set<EditorAction["type"]>([
  "REORDER_SECTIONS",
  "TOGGLE_SECTION_ENABLED",
  "DUPLICATE_SECTION",
  "DELETE_SECTION",
]);

export function editorHistoryReducer(
  state: EditorHistoryState,
  action: EditorAction,
): EditorHistoryState {
  if (action.type === "UNDO") {
    const previous = state.past[state.past.length - 1];
    if (!previous) return state;
    return {
      past: state.past.slice(0, -1),
      present: previous,
      future: [state.present, ...state.future],
    };
  }

  if (action.type === "REDO") {
    const next = state.future[0];
    if (!next) return state;
    return {
      past: [...state.past, state.present],
      present: next,
      future: state.future.slice(1),
    };
  }

  if (action.type === "SELECT_PAGE") {
    // Changer de page désélectionne la section courante — elle appartient à l'autre
    // page. Navigation pure : n'empile jamais dans l'historique.
    return {
      ...state,
      present: { ...state.present, selectedPageId: action.pageId, selectedSectionId: null },
    };
  }

  if (action.type === "SELECT_SECTION") {
    return { ...state, present: { ...state.present, selectedSectionId: action.sectionId } };
  }

  if (CONTENT_ACTION_TYPES.has(action.type)) {
    const nextPresent = applyContentAction(state.present, action);
    if (nextPresent === state.present) return state; // action ignorée (id introuvable), rien à empiler
    const past = [...state.past, state.present].slice(-MAX_HISTORY);
    return { past, present: nextPresent, future: [] };
  }

  return state;
}

export function canUndo(state: EditorHistoryState): boolean {
  return state.past.length > 0;
}

export function canRedo(state: EditorHistoryState): boolean {
  return state.future.length > 0;
}

export function getSelectedPage(content: EditorContent): EditorPage | undefined {
  return content.pages.find((page) => page.id === content.selectedPageId);
}
