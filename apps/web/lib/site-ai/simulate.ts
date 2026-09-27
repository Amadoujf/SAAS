import type { AiDirection, AiDirectionsOutput, AiEditOperation, AiEditOutput } from "./schemas";
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

export function simulateDirections(brief: SiteBrief, context: SiteAiContext): AiDirectionsOutput {
  const illustrated = context.products.filter((p) => p.imageUrl);
  const newest = newestFirst(illustrated);
  const ids = newest.map((p) => p.id);
  const lead = newest[0];
  const steps = newest.slice(0, 3).map((p) => ({ productId: p.id, title: p.name.slice(0, 60), body: firstSentence(p.description, 200) }));
  const activity = firstSentence(brief.activity, 180);
  const base = (over: Partial<AiDirection>): AiDirection => ({
    name: "",
    pitch: "",
    style: "luxury-minimal",
    palette: { primary: "#1F2A37", accent: "#8A6A3D", background: "#FAF8F4" },
    animation: "dynamic",
    hero: { layout: lead ? "stage" : "centered", eyebrow: brief.styles[0] ? brief.styles[0].charAt(0).toUpperCase() + brief.styles[0].slice(1) : "", title: context.tenantName, titleAccent: "", subtitle: activity, ctaLabel: "Découvrir la boutique", subjectProductId: lead?.id ?? "" },
    showcase: { layout: "depth", eyebrow: "Sélection", title: "Les pièces du moment", productIds: ids.slice(0, 8) },
    story: { enabled: steps.length >= 2, layout: "sequence", eyebrow: "Dans le détail", title: "Ce qui les distingue", steps },
    showCategories: true,
    showProductGrid: true,
    order: ["hero", "showcase", "story", "categories", "grid"],
    ...over,
  });
  return {
    directions: [
      base({ name: "Épure", pitch: "Beaucoup d'espace, une palette neutre et vos produits en vedette : une boutique calme et haut de gamme.", style: "luxury-minimal", showcase: { layout: illustrated.length >= 4 ? "arc" : "depth", eyebrow: "La collection", title: "Choisissez la vôtre", productIds: ids.slice(0, 8) } }),
      base({
        name: "Atelier chaleureux",
        pitch: "Des tons de terre, une mise en page éditoriale et un récit qui raconte chaque produit : proche et artisanal.",
        style: "teranga-atelier",
        palette: { primary: "#5B3A29", accent: "#9C4F2E", background: "#FBF5EE" },
        animation: "discreet",
        hero: { layout: "centered", eyebrow: "Fait avec soin", title: context.tenantName, titleAccent: "", subtitle: activity, ctaLabel: "Voir les produits", subjectProductId: lead?.id ?? "" },
        story: { enabled: steps.length >= 2, layout: "product", eyebrow: "Nos produits", title: "Pièce par pièce", steps },
        order: ["hero", "story", "showcase", "categories", "grid"],
      }),
      base({
        name: "Vitrine vive",
        pitch: "Couleurs franches, rythme soutenu et nouveautés en avant : une boutique énergique qui donne envie de parcourir.",
        style: "commerce-moderne",
        palette: { primary: "#14213D", accent: "#B23A1E", background: "#FFFFFF" },
        animation: "immersive",
        showcase: { layout: "stack", eyebrow: "Nouveautés", title: "À découvrir maintenant", productIds: ids.slice(0, 8) },
        story: { enabled: false, layout: "timeline", eyebrow: "", title: "", steps: [] },
        order: ["hero", "showcase", "grid", "categories"],
      }),
    ],
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
