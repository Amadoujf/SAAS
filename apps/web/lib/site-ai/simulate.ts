import type { AiDirection, AiDirectionsOutput, AiEditOperation, AiEditOutput, ArchetypeKey } from "./schemas";
import { ARCHETYPES } from "./archetypes";
import type { SiteState } from "./operations";
import type { SiteAiContext, SiteBrief } from "./types";
import { newestFirst } from "./compile";

/**
 * MODE SIMULÉ (développement uniquement, sans fournisseur IA) : règles locales
 * déterministes qui produisent des données au MÊME format que l'IA, pour tester tout le
 * parcours. Toujours présenté comme une simulation à l'écran (voir provider.ts) — ces
 * réponses ne sont jamais données pour une génération réelle.
 */

function firstSentence(text: string | null, max: number): string {
  const sentence = (text ?? "").split(/(?<=[.!?])\s/)[0] ?? "";
  return sentence.length > max ? `${sentence.slice(0, max - 1)}…` : sentence;
}

const ARCHETYPE_LOOK: Record<ArchetypeKey, { style: AiDirection["style"]; palette: AiDirection["palette"]; selection: string; story: string; order: "newest" | "premium" }> = {
  galerie: { style: "luxury-minimal", palette: { primary: "#1F2A37", accent: "#7A5C32", background: "#F4F2EE" }, selection: "Pièces choisies", story: "En détail", order: "premium" },
  atelier: { style: "teranga-atelier", palette: { primary: "#5B3A29", accent: "#9C4F2E", background: "#FBF5EE" }, selection: "Les créations", story: "Pièce par pièce", order: "newest" },
  maison: { style: "luxury-minimal", palette: { primary: "#151515", accent: "#8E7147", background: "#F6F1EA" }, selection: "La collection", story: "Lookbook", order: "premium" },
  vitrine: { style: "commerce-moderne", palette: { primary: "#14213D", accent: "#B23A1E", background: "#FFFFFF" }, selection: "À découvrir maintenant", story: "Nouveautés", order: "newest" },
  magazine: { style: "atelier-naya", palette: { primary: "#15110D", accent: "#8C6A3D", background: "#F7F2EA" }, selection: "La sélection", story: "En images", order: "newest" },
  marche: { style: "sunu-marche", palette: { primary: "#10224F", accent: "#1D3FB0", background: "#FFFFFF" }, selection: "Sélection du moment", story: "Nos produits", order: "newest" },
};

/** Archétypes les plus adaptés au brief et au catalogue (règles simples, déterministes). */
function rankArchetypes(brief: SiteBrief, context: SiteAiContext): ArchetypeKey[] {
  const score: Record<ArchetypeKey, number> = { galerie: 2, atelier: 1.5, vitrine: 1, maison: 0.5, magazine: 0, marche: 0 };
  const has = (w: string) => brief.styles.includes(w);
  if (has("luxueux")) (score.maison += 4), (score.galerie += 1);
  if (has("épuré")) (score.galerie += 3), (score.maison += 1);
  if (has("artisanal") || has("chaleureux") || has("naturel")) (score.atelier += 3), (score.magazine += 1);
  if (has("coloré") || has("audacieux") || has("moderne")) (score.vitrine += 3), (score.magazine += 1);
  if (context.products.length >= 20 || context.categories.length >= 5) score.marche += 3;
  if (context.libraryImages.some((i) => (i.width ?? 0) >= 1200)) score.magazine += 2;
  return (Object.keys(score) as ArchetypeKey[]).sort((a, b) => score[b] - score[a]);
}

export function simulateDirections(brief: SiteBrief, context: SiteAiContext): AiDirectionsOutput {
  const illustrated = context.products.filter((p) => p.imageUrl);
  const newest = newestFirst(illustrated);
  const premium = [...illustrated].sort((a, b) => Number(b.priceLabel.replace(/\D/g, "")) - Number(a.priceLabel.replace(/\D/g, "")));
  const activity = firstSentence(brief.activity, 180);
  const rest = brief.activity.replace(/\s+/g, " ").trim().slice(firstSentence(brief.activity, 1000).length).trim();
  // Surtitre : l'univers principal du catalogue (donnée réelle), jamais un mot du questionnaire.
  const eyebrow = [...context.categories].sort((a, b) => b.productCount - a.productCount)[0]?.name ?? "Collection";
  const chosen = rankArchetypes(brief, context).slice(0, 3);
  return {
    directions: chosen.map((archetype, index) => {
      const look = ARCHETYPE_LOOK[archetype];
      const meta = ARCHETYPES[archetype];
      const ordered = look.order === "premium" ? premium : newest;
      // Chaque direction met en scène une pièce différente.
      const lead = ordered[index % Math.max(1, ordered.length)] ?? ordered[0];
      return {
        name: meta.label,
        pitch: meta.description.slice(0, 220),
        archetype,
        style: look.style,
        typography: meta.suggested.typography,
        shape: meta.suggested.shape,
        palette: look.palette,
        animation: meta.suggested.animation,
        heroProductId: lead?.id ?? "",
        signatureProductId: premium[0]?.id ?? "",
        featuredProductIds: ordered.slice(0, 8).map((p) => p.id),
        copy: {
          heroEyebrow: eyebrow,
          heroTitle: context.tenantName,
          heroTitleAccent: "",
          heroSubtitle: activity,
          ctaLabel: archetype === "vitrine" ? "Voir les nouveautés" : "Découvrir la collection",
          manifesto: activity,
          manifestoBody: rest.slice(0, 400),
          selectionTitle: look.selection,
          storyTitle: look.story,
          closingTitle: "Toute la collection en ligne",
          closingText: "Parcourez l'ensemble des produits et commandez en quelques instants.",
        },
        storySteps: newest.slice(0, 3).map((p) => ({ productId: p.id, title: p.name.slice(0, 60), body: firstSentence(p.description, 200) })),
      };
    }),
  };
}

export function simulateEdit(message: string, state: SiteState, selectedSectionId: string | null): AiEditOutput {
  const text = message.toLowerCase();
  const ops: AiEditOperation[] = [];
  const replies: string[] = [];
  const showcase = state.blocks.find((b) => b.sectionKey === "immersive_showcase") ?? state.blocks.find((b) => b.sectionKey === "featured_products");
  const hero = state.blocks.find((b) => b.sectionKey === "immersive_hero");

  if (/nouveaut|nouveaux|récent|recent/.test(text) && showcase) {
    ops.push({ op: "feature_products", sectionId: showcase.id, strategy: "newest", productIds: [] });
    if (/premier|d'abord|en tête|en haut/.test(text)) ops.push(hero ? { op: "move_section", sectionId: showcase.id, to: "after", relativeTo: hero.id } : { op: "move_section", sectionId: showcase.id, to: "first", relativeTo: "" });
    replies.push("Vos nouveautés passent en premier dans la vitrine, placée juste après l'ouverture.");
  }
  if (/lux|haut de gamme|élégant|elegant|chic/.test(text)) {
    ops.push({ op: "set_style", style: "luxury-minimal" }, { op: "set_colors", primary: "#1C1C1C", accent: "#8A6A3D", background: "#F7F3EC" }, { op: "set_animation", level: "dynamic", mobile: "unchanged" });
    if (showcase?.sectionKey === "immersive_showcase") ops.push({ op: "set_option", sectionId: showcase.id, option: "backdrop", value: "dark" });
    replies.push("Version plus luxueuse : style « Maison », noir profond et doré discret, fond ivoire, rythme posé.");
  }
  const cream = /crème|creme/.test(text);
  if (cream) {
    const target = selectedSectionId ? state.blocks.find((b) => b.id === selectedSectionId) : null;
    if (target && ["immersive_hero", "scroll_story"].includes(target.sectionKey)) ops.push({ op: "set_section_background", sectionId: target.id, color: "#F4EDE1" });
    else ops.push({ op: "set_colors", primary: "", accent: "", background: "#F4EDE1" });
    replies.push(target ? "Le fond de la section sélectionnée passe en crème." : "Le fond du site passe en crème (sélectionnez une section dans l'aperçu pour ne changer que la sienne).");
  }
  if (/anim/.test(text) && /téléphone|telephone|mobile|portable/.test(text)) {
    const off = /coupe|supprim|désactiv|desactiv|enl[eè]v|aucune/.test(text);
    ops.push({ op: "set_animation", level: "unchanged", mobile: off ? "none" : "reduced" });
    replies.push(off ? "Animations désactivées sur téléphone ; rien ne change sur ordinateur." : "Animations allégées sur téléphone ; rien ne change sur ordinateur.");
  } else if (/moins d'anim|plus calme|sobre/.test(text)) {
    ops.push({ op: "set_animation", level: "discreet", mobile: "unchanged" });
    replies.push("Animations plus discrètes partout.");
  }
  if (!ops.length) {
    return { reply: "Mode simulé : je ne reconnais que quelques demandes types (nouveautés en premier, version plus luxueuse, fond crème, animations sur téléphone). Une vraie IA comprendra toutes les formulations une fois la clé du fournisseur configurée.", operations: [] };
  }
  return { reply: replies.join(" "), operations: ops };
}

export function simulateImprove(state: SiteState, context: SiteAiContext): AiEditOutput {
  const ops: AiEditOperation[] = [];
  const showcase = state.blocks.find((b) => b.sectionKey === "immersive_showcase");
  const hero = state.blocks.find((b) => b.sectionKey === "immersive_hero");
  if (showcase && context.products.filter((p) => p.imageUrl).length >= 3) ops.push({ op: "feature_products", sectionId: showcase.id, strategy: "newest", productIds: [] });
  if (showcase && hero && state.blocks.indexOf(showcase) > 1) ops.push({ op: "move_section", sectionId: showcase.id, to: "after", relativeTo: hero.id });
  if (state.motion.mobile === "same" && state.motion.level === "immersive") ops.push({ op: "set_animation", level: "unchanged", mobile: "reduced" });
  return {
    reply: ops.length
      ? "Mode simulé — suggestions : mettre vos derniers produits en vitrine, rapprocher la vitrine de l'ouverture et alléger les animations sur téléphone."
      : "Mode simulé : aucune amélioration évidente à proposer avec les règles locales.",
    operations: ops,
  };
}
