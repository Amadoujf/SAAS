import type { AddableSection, AiDirection, AiDirectionsOutput, AiEditOperation, AiEditOutput, ArchetypeKey } from "./schemas";
import { isValidVariant } from "@yamacommerce/templates";
import { SECTOR_STYLE_BY_MODE, TEXT_FIELDS } from "./schemas";
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

const ARCHETYPE_LOOK: Record<ArchetypeKey, { style: AiDirection["style"]; palette: AiDirection["palette"]; selection: string; story: string; order: "newest" | "premium"; title?: string; pitch?: string }> = {
  // Les trois directions de boutique (mode, maison, objets) : ambiances, typographies et
  // compositions nettement différentes. Titres génériques de SIMULATION (signalés).
  editorial: { style: "atelier-naya", palette: { primary: "#1B1712", accent: "#8C6A3D", background: "#F6F1EA" }, selection: "Les pièces remarquables", story: "La maison", order: "newest", title: "L'allure, naturellement.", pitch: "Une approche mode et humaine : la photographie domine, les titres en didone, les pièces en grands portraits." },
  sculptural: { style: "socle", palette: { primary: "#1C2733", accent: "#9A5B34", background: "#F5F6F4" }, selection: "Pièces choisies", story: "Le geste", order: "premium", title: "Des pièces pour aujourd'hui et demain.", pitch: "Une direction sculpturale qui met vos pièces au premier plan : socles de pierre, lumière froide, grands titres." },
  studio: { style: "studio", palette: { primary: "#1F3FD1", accent: "#0B0B0F", background: "#FFFFFF" }, selection: "La sélection", story: "Manifeste", order: "newest", title: "Élégance sans effort.", pitch: "Contemporain et affirmé : votre nom en lettres géantes sur aplat cobalt, bandeau défilant, grille numérotée." },
  galerie: { style: "luxury-minimal", palette: { primary: "#1F2A37", accent: "#7A5C32", background: "#F4F2EE" }, selection: "Pièces choisies", story: "En détail", order: "premium" },
  atelier: { style: "teranga-atelier", palette: { primary: "#5B3A29", accent: "#9C4F2E", background: "#FBF5EE" }, selection: "Les créations", story: "Pièce par pièce", order: "newest" },
  maison: { style: "luxury-minimal", palette: { primary: "#151515", accent: "#8E7147", background: "#F6F1EA" }, selection: "La collection", story: "Lookbook", order: "premium" },
  vitrine: { style: "commerce-moderne", palette: { primary: "#14213D", accent: "#B23A1E", background: "#FFFFFF" }, selection: "À découvrir maintenant", story: "Nouveautés", order: "newest" },
  magazine: { style: "atelier-naya", palette: { primary: "#15110D", accent: "#8C6A3D", background: "#F7F2EA" }, selection: "La sélection", story: "En images", order: "newest" },
  marche: { style: "sunu-marche", palette: { primary: "#10224F", accent: "#1D3FB0", background: "#FFFFFF" }, selection: "Sélection du moment", story: "Nos produits", order: "newest" },
};

/** Archétypes les plus adaptés au brief et au catalogue (règles simples, déterministes). */
function rankArchetypes(brief: SiteBrief, context: SiteAiContext): ArchetypeKey[] {
  // Boutique avec au moins 3 photos : les trois directions éditoriale, sculpturale et
  // studio d'abord (structures, typographies et ambiances les plus contrastées).
  const photos = context.products.filter((p) => p.imageUrl).length;
  const trio = (context.mode ?? "commerce") === "commerce" && photos >= 3 ? 10 : -10;
  const score: Record<ArchetypeKey, number> = { editorial: trio + 0.3, sculptural: trio + 0.2, studio: trio + 0.1, galerie: 2, atelier: 1.5, vitrine: 1, maison: 0.5, magazine: 0, marche: 0 };
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
  // Secteurs au style imposé : trois ambiances nettement différentes et le vocabulaire du métier.
  // Ces textes de simulation sont génériques et signalés comme tels dans le studio.
  const SECTOR_SIM = {
    restaurant: {
      palettes: [
        { primary: "#1C1714", accent: "#C2461F", background: "#FBF6EE" },
        { primary: "#3B2416", accent: "#8A5A12", background: "#F7F0E4" },
        { primary: "#1F3A2E", accent: "#B4552D", background: "#F6F3EA" },
      ],
      cta: "Voir la carte", selection: "À la carte", story: "Nos plats, un à un", closingTitle: "Toute la carte en ligne", closingText: "Commandez à emporter, en livraison, ou réservez votre table.",
    },
    automobile: {
      palettes: [
        { primary: "#0F1215", accent: "#FF5A1F", background: "#EDEFF0" },
        { primary: "#16233A", accent: "#E0A417", background: "#F2F3F5" },
        { primary: "#1B2A24", accent: "#C8102E", background: "#F4F4F1" },
      ],
      cta: "Voir les véhicules", selection: "En stock", story: "Nos véhicules, un à un", closingTitle: "Tout le stock en ligne", closingText: "Filtrez par marque, budget ou carrosserie, puis réservez votre essai.",
    },
    education: {
      palettes: [
        { primary: "#1C2A4A", accent: "#D8A327", background: "#F6F1E6" },
        { primary: "#2F5D50", accent: "#C9433A", background: "#F4F2EC" },
        { primary: "#3A2E5C", accent: "#E08A2E", background: "#F7F5F0" },
      ],
      cta: "Voir les formations", selection: "Nos formations", story: "Nos formations, une à une", closingTitle: "Inscriptions ouvertes", closingText: "Choisissez la formation et la classe, puis envoyez votre demande d'inscription.",
    },
  } as const;
  const sector = context.mode === "restaurant" || context.mode === "automobile" || context.mode === "education" ? SECTOR_SIM[context.mode] : null;
  return {
    directions: chosen.map((archetype, index) => {
      const look = ARCHETYPE_LOOK[archetype];
      const meta = ARCHETYPES[archetype];
      const ordered = look.order === "premium" ? premium : newest;
      // Chaque direction met en scène une pièce différente.
      const lead = ordered[index % Math.max(1, ordered.length)] ?? ordered[0];
      return {
        name: meta.label,
        pitch: (look.pitch ?? meta.description).slice(0, 220),
        archetype,
        // Secteur : la première proposition prend le style métier, les deux autres
        // des styles de la plateforme choisis d'après les goûts (archétypes classés).
        style: sector && index === 0 ? SECTOR_STYLE_BY_MODE[context.mode as keyof typeof SECTOR_STYLE_BY_MODE] : look.style,
        typography: meta.suggested.typography,
        shape: meta.suggested.shape,
        palette: sector && index === 0 ? sector.palettes[0]! : look.palette,
        animation: meta.suggested.animation,
        heroProductId: lead?.id ?? "",
        signatureProductId: premium[0]?.id ?? "",
        featuredProductIds: ordered.slice(0, 8).map((p) => p.id),
        copy: {
          heroEyebrow: eyebrow,
          heroTitle: look.title && !sector ? look.title : context.tenantName,
          heroTitleAccent: "",
          heroSubtitle: firstSentence(brief.activity, 200),
          ctaLabel: sector ? sector.cta : archetype === "vitrine" ? "Voir les nouveautés" : archetype === "studio" ? "Voir la sélection" : "Découvrir la collection",
          manifesto: firstSentence(brief.activity, 160),
          manifestoBody: rest.slice(0, 400),
          selectionTitle: sector ? sector.selection : look.selection,
          storyTitle: sector ? sector.story : look.story,
          closingTitle: sector ? sector.closingTitle : "Toute la collection en ligne",
          closingText: sector ? sector.closingText : "Parcourez l'ensemble des produits et commandez en quelques instants.",
        },
        storySteps: newest.slice(0, 3).map((p) => ({ productId: p.id, title: p.name.slice(0, 60), body: firstSentence(p.description, 200) })),
      };
    }),
  };
}

/** Mots qui désignent un type de section (ajout, suppression, déplacement). */
const KIND_WORDS: [RegExp, AddableSection, string[]][] = [
  [/galerie/, "gallery", ["gallery"]],
  [/récit|recit|histoire|raconte/, "story", ["scroll_story"]],
  [/manifeste/, "manifesto", ["brand_manifesto"]],
  [/savoir-faire|savoir faire|atelier|héritage|heritage/, "heritage", ["heritage"]],
  [/signature|pièce phare|piece phare|produit phare/, "signature", ["signature_product"]],
  [/lookbook/, "lookbook", ["lookbook"]],
  [/carrousel|carousel|vitrine/, "showcase", ["immersive_showcase"]],
  [/nouveaut/, "new_arrivals", ["new_arrivals"]],
  [/univers|catégorie|categorie/, "categories", ["categories"]],
  [/invitation|appel|bandeau final/, "closing", ["cta"]],
  [/sélection|selection|produits/, "featured", ["featured_products"]],
];
const VARIANT_WORDS: [RegExp, string[]][] = [
  [/carrousel|carousel|défil/, ["carousel", "stack", "depth"]],
  [/grille/, ["grid"]],
  [/mosaïque|mosaique/, ["masonry", "mosaic", "editorial"]],
  [/arc/, ["arc"]],
];

export function simulateEdit(message: string, state: SiteState, selectedSectionId: string | null, items: "produits" | "plats" | "véhicules" | "formations" = "produits"): AiEditOutput {
  const text = message.toLowerCase();
  const ops: AiEditOperation[] = [];
  const replies: string[] = [];
  const selected = selectedSectionId ? state.blocks.find((b) => b.id === selectedSectionId) ?? null : null;
  const showcase = state.blocks.find((b) => b.sectionKey === "immersive_showcase") ?? state.blocks.find((b) => b.sectionKey === "featured_products");
  const hero = state.blocks[0];
  const kind = KIND_WORDS.find(([re]) => re.test(text));
  const quoted = /[«"“]\s*([^»"”]{2,160}?)\s*[»"”]/.exec(message)?.[1];

  // Ajouter une section
  if (/ajout|ajoute|crée|cree|créer|insère|insere|rajoute/.test(text) && kind) {
    const [, k] = kind;
    const position = selected ? "after" : /en haut|en tête|au début|en premier/.test(text) ? "after" : "last";
    ops.push({ op: "add_section", kind: k, variant: "", position: position === "after" ? "after" : "last", relativeTo: selected?.id ?? (position === "after" ? hero?.id ?? "" : ""), title: quoted ?? "", text: "", productIds: [] });
    replies.push(`J'ajoute une section « ${kind[0].source.split("|")[0]} » composée avec vos ${items}${selected ? ", juste après la section sélectionnée" : ""}.`);
  }
  // Retirer
  else if (/supprim|retire|enl[eè]ve|enlever/.test(text) && (selected || kind)) {
    const target = selected ?? state.blocks.find((b) => kind![2].includes(b.sectionKey));
    if (target) {
      ops.push({ op: "remove_section", sectionId: target.id });
      replies.push("Je retire cette section de la page.");
    }
  }
  // Réécrire un texte entre guillemets
  else if (quoted && selected) {
    const params = selected.params as Record<string, unknown>;
    const field = /sous-titre|sous titre/.test(text) ? "subtitle" : /bouton/.test(text) ? (["primaryCtaLabel", "buttonLabel", "ctaLabel"].find((f) => f in params) ?? "ctaLabel") : "statement" in params && !/titre/.test(text) ? "statement" : "title";
    ops.push({ op: "set_text", sectionId: selected.id, field: field as (typeof TEXT_FIELDS)[number], value: quoted });
    replies.push("Je remplace ce texte, sans toucher au reste.");
  }

  if (/nouveaut|nouveaux|récent|recent/.test(text) && showcase && !ops.some((o) => o.op === "add_section")) {
    ops.push({ op: "feature_products", sectionId: showcase.id, strategy: "newest", productIds: [] });
    if (/premier|d'abord|en tête|en haut/.test(text)) ops.push(hero && hero.id !== showcase.id ? { op: "move_section", sectionId: showcase.id, to: "after", relativeTo: hero.id } : { op: "move_section", sectionId: showcase.id, to: "first", relativeTo: "" });
    replies.push("Vos nouveautés passent en premier dans la sélection, placée juste après l'ouverture.");
  }
  if (/lux|haut de gamme|élégant|elegant|chic/.test(text) && !/typo|police|écriture/.test(text)) {
    ops.push({ op: "set_style", style: "luxury-minimal" }, { op: "set_colors", primary: "#1C1C1C", accent: "#8A6A3D", background: "#F7F3EC" }, { op: "set_typography", fontPair: "couture" }, { op: "set_shape", shape: "sharp" }, { op: "set_animation", level: "dynamic", mobile: "unchanged" });
    if (showcase?.sectionKey === "immersive_showcase") ops.push({ op: "set_option", sectionId: showcase.id, option: "backdrop", value: "dark" });
    replies.push("Version plus luxueuse : style « Maison », Didone contrastée, angles vifs, noir profond et doré discret sur fond ivoire, rythme posé.");
  }
  if (/typo|police|écriture|ecriture|caractère/.test(text)) {
    const pair = /élég|eleg|lux|chic|couture/.test(text) ? "couture" : /modern|jeune|dynamique/.test(text) ? "moderne" : /sobre|simple|neutre|lisible/.test(text) ? "neutre" : "editorial";
    ops.push({ op: "set_typography", fontPair: pair });
    replies.push(`Typographie « ${pair} » sur tout le site.`);
  }
  if (/arrondi|rond/.test(text)) (ops.push({ op: "set_shape", shape: "round" }), replies.push("Formes plus rondes : boutons et images arrondis."));
  else if (/carré|carre|angle|anguleux|droit/.test(text)) (ops.push({ op: "set_shape", shape: "sharp" }), replies.push("Angles vifs partout."));
  if (/plus d'espace|aér|aer|respir/.test(text)) {
    for (const b of selected ? [selected] : state.blocks) ops.push({ op: "set_spacing", sectionId: b.id, density: "airy" });
    replies.push(selected ? "Plus d'espace autour de cette section." : "Plus d'espace entre toutes les sections.");
  } else if (/compact|resserr|moins d'espace/.test(text)) {
    for (const b of selected ? [selected] : state.blocks) ops.push({ op: "set_spacing", sectionId: b.id, density: "compact" });
    replies.push(selected ? "Section resserrée." : "Page plus compacte.");
  }
  if (selected && /centr/.test(text)) (ops.push({ op: "set_alignment", sectionId: selected.id, align: "center" }), replies.push("Texte centré dans cette section."));
  if (selected && /présent|present|en grille|en carrousel|en mosaïque|en mosaique|en arc/.test(text)) {
    const want = VARIANT_WORDS.find(([re]) => re.test(text))?.[1] ?? [];
    const variant = want.find((v) => isValidVariant(selected.sectionKey, v));
    if (variant) (ops.push({ op: "set_variant", sectionId: selected.id, variant }), replies.push(`Présentation « ${variant} » pour cette section.`));
  }
  if (/en premier|en haut|remonte/.test(text) && kind && !/nouveaut|ajout|ajoute/.test(text)) {
    const target = state.blocks.find((b) => kind[2].includes(b.sectionKey));
    if (target && hero && target.id !== hero.id) (ops.push({ op: "move_section", sectionId: target.id, to: "after", relativeTo: hero.id }), replies.push("Section remontée juste après l'ouverture."));
  }
  if (/minimalis|épur|epur|dépouill|depouill/.test(text) && !ops.some((o) => o.op === "set_spacing")) {
    for (const b of state.blocks) ops.push({ op: "set_spacing", sectionId: b.id, density: "airy" });
    ops.push({ op: "set_animation", level: "discreet", mobile: "unchanged" });
    replies.push("Version plus minimaliste : plus d'espace entre les sections et des animations plus discrètes, la direction reste la même.");
  }
  const cream = /crème|creme/.test(text);
  if (cream) {
    if (selected && ["immersive_hero", "scroll_story"].includes(selected.sectionKey)) ops.push({ op: "set_section_background", sectionId: selected.id, color: "#F4EDE1" });
    else ops.push({ op: "set_colors", primary: "", accent: "", background: "#F4EDE1" });
    replies.push(selected && ["immersive_hero", "scroll_story"].includes(selected.sectionKey) ? "Le fond de la section sélectionnée passe en crème." : "Le fond du site passe en crème.");
  }
  if (/anim/.test(text) && /téléphone|telephone|mobile|portable/.test(text)) {
    const off = /coupe|supprim|désactiv|desactiv|enl[eè]v|aucune/.test(text);
    ops.push({ op: "set_animation", level: "unchanged", mobile: off ? "none" : "reduced" });
    replies.push(off ? "Animations désactivées sur téléphone ; rien ne change sur ordinateur." : "Animations allégées sur téléphone ; rien ne change sur ordinateur.");
  } else if (/moins d'anim|plus calme|sobre/.test(text) && !/typo|police/.test(text)) {
    ops.push({ op: "set_animation", level: "discreet", mobile: "unchanged" });
    replies.push("Animations plus discrètes partout.");
  }
  if (!ops.length) {
    return {
      reply:
        "Mode simulé : je comprends les demandes courantes (ajouter une galerie, un récit, un manifeste ou une pièce signature ; changer la typographie, les formes, l'espacement ; remplacer un texte entre « guillemets » sur la section sélectionnée ; nouveautés en premier ; version plus luxueuse ou plus minimaliste ; fond crème ; animations sur téléphone). Une vraie IA comprendra toutes les formulations une fois la clé du fournisseur configurée.",
      operations: [],
    };
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
