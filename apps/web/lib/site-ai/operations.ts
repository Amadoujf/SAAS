import { isValidVariant, validateSectionInstance, type SectionInstance } from "@yamacommerce/templates";
import { SECTION_NAMES } from "@/lib/editor/section-names";
import { STORE_TEMPLATES } from "@/lib/storefront/store-templates";
import type { AiEditOperation } from "./schemas";
import type { SiteAiContext, SiteIdentity, SiteMotion } from "./types";
import { guardText, newestFirst, safeColor } from "./compile";

/**
 * Applique des opérations d'édition FERMÉES à l'état du site (sections du brouillon +
 * identité + animations) — fonction pure, identique pour l'IA, le mode simulé et les
 * modifications manuelles faites depuis l'aperçu. Garanties :
 * - seule la cible nommée change (les autres sections et réglages restent identiques) ;
 * - toute section modifiée est revalidée par son schéma ; une opération invalide est
 *   écartée (et signalée) sans toucher au reste ;
 * - aucun prix, stock ou fiche produit n'est modifiable : aucune opération n'y accède.
 */

export interface SiteState {
  blocks: SectionInstance[];
  identity: SiteIdentity;
  motion: SiteMotion;
}

export interface OperationsResult {
  state: SiteState;
  /** Modifications effectivement appliquées, en langage clair. */
  changes: string[];
  /** Opérations écartées, avec la raison. */
  rejected: string[];
}

const STYLE_NAMES = Object.fromEntries(STORE_TEMPLATES.map((t) => [t.slug, t.name]));
const LEVEL_NAMES = { discreet: "discrètes", dynamic: "dynamiques", immersive: "immersives" } as const;
const MOBILE_NAMES = { same: "identiques sur téléphone", reduced: "allégées sur téléphone", none: "désactivées sur téléphone" } as const;
const FIELD_NAMES: Record<string, string> = { eyebrow: "surtitre", title: "titre", titleAccent: "suite du titre", subtitle: "sous-titre", intro: "introduction", primaryCtaLabel: "bouton principal", secondaryCtaLabel: "bouton secondaire", ctaLabel: "bouton" };

export function sectionLabel(block: SectionInstance): string {
  const title = (block.params as { title?: unknown }).title;
  const name = SECTION_NAMES[block.sectionKey] ?? block.sectionKey;
  return typeof title === "string" && title ? `${name} « ${title.length > 40 ? `${title.slice(0, 40)}…` : title} »` : name;
}

export function applyOperations(input: SiteState, operations: AiEditOperation[], context: SiteAiContext): OperationsResult {
  let blocks = input.blocks.map((b) => structuredClone(b));
  let identity = { ...input.identity };
  let motion = { ...input.motion };
  const changes: string[] = [];
  const rejected: string[] = [];
  const productIds = new Set(context.products.map((p) => p.id));

  const find = (id: string) => blocks.findIndex((b) => b.id === id);
  /** Remplace une section par sa version modifiée, seulement si elle reste valide. */
  const update = (index: number, patch: (b: SectionInstance) => SectionInstance, describe: string): boolean => {
    try {
      const next = validateSectionInstance(patch(structuredClone(blocks[index]!)));
      blocks = blocks.map((b, i) => (i === index ? next : b));
      changes.push(describe);
      return true;
    } catch {
      rejected.push(`${describe} — valeur refusée par la section.`);
      return false;
    }
  };

  for (const op of operations) {
    const index = "sectionId" in op ? find(op.sectionId) : -1;
    if ("sectionId" in op && index < 0) {
      rejected.push(`Section inconnue (${op.sectionId}) : modification ignorée.`);
      continue;
    }
    const block = index >= 0 ? blocks[index]! : null;
    switch (op.op) {
      case "move_section": {
        const [moved] = blocks.splice(index, 1);
        let target = op.to === "first" ? 0 : op.to === "last" ? blocks.length : find(op.relativeTo);
        if (target < 0) {
          blocks.splice(index, 0, moved!);
          rejected.push(`Déplacement de ${sectionLabel(moved!)} : section de référence inconnue.`);
          break;
        }
        if (op.to === "after") target += 1;
        blocks.splice(target, 0, moved!);
        changes.push(`${sectionLabel(moved!)} : déplacée ${op.to === "first" ? "en tête de page" : op.to === "last" ? "en fin de page" : op.to === "before" ? "avant" : "après"} ${op.to === "before" || op.to === "after" ? sectionLabel(blocks[op.to === "after" ? target - 1 : target + 1]!) : ""}`.trim());
        break;
      }
      case "set_text": {
        const notes: string[] = [];
        const value = guardText(op.value, notes, FIELD_NAMES[op.field] ?? op.field);
        if (op.value.trim() && !value) {
          rejected.push(...notes);
          break;
        }
        if (!(op.field in (block!.params as object)) && !value) break;
        update(index, (b) => ({ ...b, params: { ...(b.params as object), [op.field]: value } }), `${sectionLabel(block!)} : ${FIELD_NAMES[op.field] ?? op.field} → « ${value ?? "(retiré)"} »`);
        break;
      }
      case "set_step_text": {
        const steps = (block!.params as { steps?: { title: string; body?: string }[] }).steps;
        if (!steps || !steps[op.stepIndex]) {
          rejected.push(`${sectionLabel(block!)} : étape ${op.stepIndex + 1} inexistante.`);
          break;
        }
        const notes: string[] = [];
        const title = guardText(op.title, notes, "titre d'étape") ?? steps[op.stepIndex]!.title;
        const body = op.body ? guardText(op.body, notes, "texte d'étape") : steps[op.stepIndex]!.body;
        rejected.push(...notes);
        update(index, (b) => ({ ...b, params: { ...(b.params as object), steps: steps.map((s, i) => (i === op.stepIndex ? { ...s, title, body } : s)) } }), `${sectionLabel(block!)} : étape ${op.stepIndex + 1} réécrite`);
        break;
      }
      case "set_option": {
        const params = block!.params as Record<string, unknown>;
        if (!(op.option in params) && !["backdrop", "imageStyle", "objectStyle", "autoplay", "showPrice"].includes(op.option)) {
          rejected.push(`${sectionLabel(block!)} : réglage « ${op.option} » non disponible pour cette section.`);
          break;
        }
        update(index, (b) => ({ ...b, params: { ...(b.params as object), [op.option]: op.value } }), `${sectionLabel(block!)} : ${op.option} → ${String(op.value)}`);
        break;
      }
      case "set_variant": {
        if (!isValidVariant(block!.sectionKey, op.variant)) {
          rejected.push(`${sectionLabel(block!)} : présentation « ${op.variant} » inconnue.`);
          break;
        }
        update(index, (b) => ({ ...b, variant: op.variant }), `${sectionLabel(block!)} : présentation « ${op.variant} »`);
        break;
      }
      case "feature_products": {
        if (block!.sectionKey !== "immersive_showcase" && block!.sectionKey !== "featured_products") {
          rejected.push(`${sectionLabel(block!)} : cette section ne présente pas de produits.`);
          break;
        }
        const needsPhoto = block!.sectionKey === "immersive_showcase";
        const ids = (op.strategy === "newest" ? newestFirst(context.products).map((p) => p.id) : op.productIds.filter((id) => productIds.has(id)))
          .filter((id) => !needsPhoto || context.products.find((p) => p.id === id)?.imageUrl)
          .slice(0, 12);
        if (ids.length < (needsPhoto ? 3 : 1)) {
          rejected.push(`${sectionLabel(block!)} : pas assez de produits photographiés pour cette sélection.`);
          break;
        }
        update(
          index,
          (b) => ({ ...b, params: { ...(b.params as object), ...(b.sectionKey === "immersive_showcase" ? { source: "products" } : {}), productIds: ids } }),
          `${sectionLabel(block!)} : ${op.strategy === "newest" ? "vos nouveautés en premier" : `${ids.length} produit(s) choisis`}`,
        );
        break;
      }
      case "set_section_background": {
        if (!("backgroundColor" in (block!.params as object)) && !["immersive_hero", "scroll_story"].includes(block!.sectionKey)) {
          rejected.push(`${sectionLabel(block!)} : le fond de cette section suit la couleur du site (demandez « change la couleur de fond du site »).`);
          break;
        }
        const notes: string[] = [];
        const color = safeColor(op.color, "background", identity.style, notes);
        if (!color) {
          rejected.push(...notes);
          break;
        }
        update(index, (b) => ({ ...b, params: { ...(b.params as object), backgroundColor: color } }), `${sectionLabel(block!)} : fond ${color}`);
        break;
      }
      case "set_colors": {
        const notes: string[] = [];
        const next = { ...identity };
        const describe: string[] = [];
        if (op.primary) {
          const c = safeColor(op.primary, "brand", identity.style, notes);
          if (c) (next.primaryColor = c), describe.push(`principale ${c}`);
        }
        if (op.accent) {
          const c = safeColor(op.accent, "brand", identity.style, notes);
          if (c) (next.accentColor = c), describe.push(`accent ${c}`);
        }
        if (op.background) {
          const c = safeColor(op.background, "background", identity.style, notes);
          if (c) (next.backgroundColor = c), describe.push(`fond ${c}`);
        }
        rejected.push(...notes);
        if (describe.length) {
          identity = next;
          changes.push(`Couleurs du site : ${describe.join(", ")}`);
        }
        break;
      }
      case "set_style": {
        if (op.style !== identity.style) {
          identity = { ...identity, style: op.style };
          // Un fond choisi pour l'ancien style n'est gardé que s'il reste lisible.
          if (identity.backgroundColor && !safeColor(identity.backgroundColor, "background", op.style, [])) identity.backgroundColor = null;
          changes.push(`Style du site : ${STYLE_NAMES[op.style] ?? op.style}`);
        }
        break;
      }
      case "set_animation": {
        if (op.level !== "unchanged" && op.level !== motion.level) {
          motion = { ...motion, level: op.level };
          changes.push(`Animations ${LEVEL_NAMES[op.level]}`);
        }
        if (op.mobile !== "unchanged" && op.mobile !== motion.mobile) {
          motion = { ...motion, mobile: op.mobile };
          changes.push(`Animations ${MOBILE_NAMES[op.mobile]}`);
        }
        break;
      }
      case "remove_section": {
        if (blocks.length <= 1) {
          rejected.push("La page doit garder au moins une section.");
          break;
        }
        changes.push(`${sectionLabel(block!)} : retirée de la page`);
        blocks = blocks.filter((_, i) => i !== index);
        break;
      }
    }
  }
  blocks = blocks.map((b, i) => ({ ...b, order: i }));
  return { state: { blocks, identity, motion }, changes, rejected };
}
