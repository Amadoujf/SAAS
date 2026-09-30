import { allowedStyles } from "./schemas";
import { isValidVariant, validateSectionInstance, type SectionInstance } from "@yamacommerce/templates";
import { SECTION_NAMES } from "@/lib/editor/section-names";
import { STORE_TEMPLATES } from "@/lib/storefront/store-templates";
import type { AddableSection, AiDirection, AiEditOperation } from "./schemas";
import type { SlotKind } from "./archetypes";
import { FONT_PAIRS, SHAPES } from "@/lib/storefront/brand-kit";
import type { SiteAiContext, SiteIdentity, SiteMotion } from "./types";
import { compileSlots, guardText, newestFirst, safeColor } from "./compile";

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

const STYLE_NAMES: Record<string, string> = { ...Object.fromEntries(STORE_TEMPLATES.map((t) => [t.slug, t.name])), braise: "Braise", piste: "Piste" };
const LEVEL_NAMES = { discreet: "discrètes", dynamic: "dynamiques", immersive: "immersives" } as const;
const MOBILE_NAMES = { same: "identiques sur téléphone", reduced: "allégées sur téléphone", none: "désactivées sur téléphone" } as const;
const FIELD_NAMES: Record<string, string> = { eyebrow: "surtitre", title: "titre", titleAccent: "suite du titre", subtitle: "sous-titre", intro: "introduction", statement: "phrase principale", body: "texte", description: "description", primaryCtaLabel: "bouton principal", secondaryCtaLabel: "bouton secondaire", ctaLabel: "bouton", buttonLabel: "bouton" };

const ADD_NAMES: Record<AddableSection, string> = {
  showcase: "carrousel", story: "récit", manifesto: "manifeste", heritage: "savoir-faire", signature: "pièce signature", lookbook: "lookbook",
  gallery: "galerie", featured: "sélection de produits", new_arrivals: "nouveautés", categories: "univers", closing: "invitation finale",
};
const DEFAULT_VARIANT: Record<AddableSection, string> = {
  showcase: "arc", story: "sequence", manifesto: "image-right", heritage: "image-left", signature: "dark", lookbook: "mosaic",
  gallery: "masonry", featured: "grid", new_arrivals: "carousel", categories: "editorial", closing: "banner",
};

function uniqueSectionId(blocks: SectionInstance[], kind: string): string {
  const ids = new Set(blocks.map((b) => b.id));
  let n = 1;
  while (ids.has(`${kind}-${n}`)) n += 1;
  return `${kind}-${n}`;
}

/** Direction « de travail » pour composer UNE section ajoutée : textes et produits de la
 *  demande, le reste repris du site actuel. */
function syntheticDirection(identity: SiteIdentity, motion: SiteMotion, context: SiteAiContext, op: { title: string; text: string; productIds: string[] }): AiDirection {
  const title = op.title.trim();
  const text = op.text.trim();
  return {
    name: "",
    pitch: "",
    archetype: "galerie",
    style: (identity.style as AiDirection["style"]) ?? "luxury-minimal",
    typography: "editorial",
    shape: "soft",
    palette: { primary: "", accent: "", background: "" },
    animation: motion.level,
    heroProductId: "",
    signatureProductId: op.productIds[0] ?? "",
    featuredProductIds: op.productIds,
    copy: {
      heroEyebrow: "",
      heroTitle: context.tenantName,
      heroTitleAccent: "",
      heroSubtitle: "",
      ctaLabel: "Découvrir la collection",
      manifesto: title,
      manifestoBody: text,
      selectionTitle: title,
      storyTitle: title,
      closingTitle: title || "Toute la collection en ligne",
      closingText: text,
    },
    storySteps: [],
  };
}

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
        if (context.mode === "restaurant" || context.mode === "automobile") {
          // Restaurant / concession : carrousel saisi (nom, prix réel, lien vers la carte ou la fiche).
          if (block!.sectionKey !== "immersive_showcase") {
            rejected.push(`${sectionLabel(block!)} : présentez vos ${context.mode === "automobile" ? "véhicules" : "plats"} dans un carrousel.`);
            break;
          }
          const dishes = ids.map((id) => context.products.find((p) => p.id === id)!).filter((p) => p.imageUrl);
          update(
            index,
            (b) => ({ ...b, params: { ...(b.params as object), source: "manual", showPrice: false, items: dishes.map((p) => ({ title: p.name.slice(0, 90), subtitle: [p.priceLabel, p.category].filter(Boolean).join(" · ").slice(0, 160), imageUrl: p.imageUrl!, imageAlt: p.imageAlt ?? p.name, href: context.mode === "automobile" ? `/vehicules/${p.slug}` : "/carte" })) } }),
            `${sectionLabel(block!)} : ${op.strategy === "newest" ? `les derniers ${context.mode === "automobile" ? "véhicules" : "plats"} ajoutés en premier` : `${dishes.length} ${context.mode === "automobile" ? "véhicule(s)" : "plat(s)"} choisis`}`,
          );
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
        if (!allowedStyles(context.mode).includes(op.style)) {
          rejected.push(`Le style « ${STYLE_NAMES[op.style] ?? op.style} » est réservé à un autre métier : choisissez l'un des styles proposés pour votre activité.`);
          break;
        }
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
      case "add_section": {
        const slot = { id: uniqueSectionId(blocks, op.kind), kind: op.kind as SlotKind, variant: DEFAULT_VARIANT[op.kind] };
        const synthetic = syntheticDirection(identity, motion, context, op);
        const composed = compileSlots(synthetic, context, [slot]);
        let added = composed.blocks[0];
        if (!added) {
          rejected.push(`Section « ${ADD_NAMES[op.kind]} » non ajoutée : ${composed.notes[0] ?? "il manque de quoi la remplir honnêtement (photos, texte)."}`);
          break;
        }
        if (op.variant && op.variant !== added.variant) {
          if (isValidVariant(added.sectionKey, op.variant)) added = { ...added, variant: op.variant };
          else rejected.push(`Présentation « ${op.variant} » inconnue pour cette section : présentation par défaut.`);
        }
        const ref = op.position === "before" || op.position === "after" ? find(op.relativeTo) : -1;
        if ((op.position === "before" || op.position === "after") && ref < 0) {
          rejected.push(`Section de référence inconnue : « ${ADD_NAMES[op.kind]} » ajoutée en fin de page.`);
        }
        const at = op.position === "first" ? 0 : ref < 0 ? blocks.length : op.position === "after" ? ref + 1 : ref;
        blocks.splice(at, 0, added);
        changes.push(`${sectionLabel(added)} : ajoutée${at === 0 ? " en tête de page" : at >= blocks.length - 1 ? " en fin de page" : ` après ${sectionLabel(blocks[at - 1]!)}`}`);
        break;
      }
      case "set_typography": {
        if (identity.fontPair !== op.fontPair) {
          identity = { ...identity, fontPair: op.fontPair };
          changes.push(`Typographie : ${FONT_PAIRS[op.fontPair].label}`);
        }
        break;
      }
      case "set_shape": {
        if (identity.shape !== op.shape) {
          identity = { ...identity, shape: op.shape };
          changes.push(`Formes : ${SHAPES[op.shape].label.toLowerCase()}`);
        }
        break;
      }
      case "set_spacing": {
        const padding = { compact: { desktop: "48px", mobile: "32px" }, normal: null, airy: { desktop: "160px", mobile: "96px" } }[op.density];
        update(
          index,
          (b) => {
            const { spacingOverride: _old, ...rest } = b;
            return padding ? { ...rest, spacingOverride: { desktop: { paddingY: padding.desktop }, mobile: { paddingY: padding.mobile } } } : rest;
          },
          `${sectionLabel(block!)} : espacement ${op.density === "compact" ? "resserré" : op.density === "airy" ? "plus aéré" : "par défaut"}`,
        );
        break;
      }
      case "set_alignment": {
        update(index, (b) => ({ ...b, styleOverride: { ...(b.styleOverride ?? {}), textAlign: op.align } }), `${sectionLabel(block!)} : texte ${op.align === "center" ? "centré" : "aligné à gauche"}`);
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
