import type { SectionInstance, SectionStyleOverride, SectionSpacingOverride, SectionAnimationDetail } from "@yamacommerce/templates";
import type { SiteSettings } from "./site-settings";

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
 * CONTENU (réordonner, masquer, dupliquer, supprimer, ET depuis le 20 septembre 2026
 * les panneaux avancés — contenu/style/espacement/animation/paramètres du site)
 * empilent dans `past` — la simple navigation (changer de page/section sélectionnée,
 * changer d'onglet de panneau) ne pollue jamais l'historique.
 *
 * Les actions `UPDATE_SECTION_*` REMPLACENT l'objet concerné dans son ensemble
 * (params/styleOverride/spacingOverride) plutôt que de fusionner champ par champ : les
 * panneaux (composants React, pas ce module) maintiennent l'objet complet à jour et
 * envoient toujours la version finale — ça garde ce réducteur simple et générique,
 * sans qu'il ait besoin de connaître la forme interne de chaque schéma de section.
 * Passer `undefined` à `styleOverride`/`spacingOverride`/`animationDetail` réinitialise
 * proprement à l'hérité du template (voir "Retour aux valeurs du template").
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
  siteSettings: SiteSettings;
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
  /** Insère une NOUVELLE section (bibliothèque de l'éditeur) après `afterSectionId`, ou
   *  en fin de page ; l'identifiant est fourni par l'appelant (réducteur pur). */
  | { type: "ADD_SECTION"; pageId: string; section: SectionInstance; afterSectionId?: string | null }
  | { type: "DELETE_SECTION"; pageId: string; sectionId: string }
  | { type: "UPDATE_SECTION_PARAMS"; pageId: string; sectionId: string; params: Record<string, unknown> }
  | {
      type: "UPDATE_SECTION_STYLE_OVERRIDE";
      pageId: string;
      sectionId: string;
      styleOverride: SectionStyleOverride | undefined;
    }
  | {
      type: "UPDATE_SECTION_SPACING_OVERRIDE";
      pageId: string;
      sectionId: string;
      spacingOverride: SectionSpacingOverride | undefined;
    }
  | {
      type: "UPDATE_SECTION_ANIMATION";
      pageId: string;
      sectionId: string;
      animationOverride: SectionInstance["animationOverride"];
      animationDetail: SectionAnimationDetail | undefined;
    }
  | { type: "UPDATE_SITE_SETTINGS"; siteSettings: SiteSettings }
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

/** Comme `mapPage`, mais cible UN bloc précis au sein de la page — factorise la garde
 *  "id introuvable = no-op" commune à toutes les actions `UPDATE_SECTION_*`. */
function mapBlock(
  content: EditorContent,
  pageId: string,
  sectionId: string,
  fn: (block: SectionInstance) => SectionInstance,
): EditorContent {
  return mapPage(content, pageId, (page) => {
    const index = page.blocks.findIndex((block) => block.id === sectionId);
    if (index === -1) return page;
    const nextBlock = fn(page.blocks[index]!);
    if (nextBlock === page.blocks[index]) return page;
    const blocks = [...page.blocks];
    blocks[index] = nextBlock;
    return { ...page, blocks };
  });
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

    case "ADD_SECTION": {
      const next = mapPage(content, action.pageId, (page) => {
        if (page.blocks.some((block) => block.id === action.section.id)) return page;
        const at = action.afterSectionId ? page.blocks.findIndex((block) => block.id === action.afterSectionId) : -1;
        const blocks = at === -1 ? [...page.blocks, action.section] : [...page.blocks.slice(0, at + 1), action.section, ...page.blocks.slice(at + 1)];
        return { ...page, blocks: renormalizeOrder(blocks) };
      });
      return next === content ? content : { ...next, selectedSectionId: action.section.id };
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

    case "UPDATE_SECTION_PARAMS": {
      return mapBlock(content, action.pageId, action.sectionId, (block) => ({
        ...block,
        params: action.params,
      }));
    }

    case "UPDATE_SECTION_STYLE_OVERRIDE": {
      return mapBlock(content, action.pageId, action.sectionId, (block) => ({
        ...block,
        styleOverride: action.styleOverride,
      }));
    }

    case "UPDATE_SECTION_SPACING_OVERRIDE": {
      return mapBlock(content, action.pageId, action.sectionId, (block) => ({
        ...block,
        spacingOverride: action.spacingOverride,
      }));
    }

    case "UPDATE_SECTION_ANIMATION": {
      return mapBlock(content, action.pageId, action.sectionId, (block) => ({
        ...block,
        animationOverride: action.animationOverride,
        animationDetail: action.animationDetail,
      }));
    }

    case "UPDATE_SITE_SETTINGS": {
      if (content.siteSettings === action.siteSettings) return content;
      return { ...content, siteSettings: action.siteSettings };
    }

    default:
      return content;
  }
}

const CONTENT_ACTION_TYPES = new Set<EditorAction["type"]>([
  "REORDER_SECTIONS",
  "TOGGLE_SECTION_ENABLED",
  "DUPLICATE_SECTION",
  "ADD_SECTION",
  "DELETE_SECTION",
  "UPDATE_SECTION_PARAMS",
  "UPDATE_SECTION_STYLE_OVERRIDE",
  "UPDATE_SECTION_SPACING_OVERRIDE",
  "UPDATE_SECTION_ANIMATION",
  "UPDATE_SITE_SETTINGS",
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

export function getSelectedSection(content: EditorContent): SectionInstance | undefined {
  const page = getSelectedPage(content);
  return page?.blocks.find((block) => block.id === content.selectedSectionId);
}
