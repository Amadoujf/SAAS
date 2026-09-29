import { STORE_TEMPLATES } from "@/lib/storefront/store-templates";
import { FONT_PAIRS, SHAPES } from "@/lib/storefront/brand-kit";
import { ARCHETYPES } from "./archetypes";
import { SECTION_NAMES } from "@/lib/editor/section-names";
import type { SiteState } from "./operations";
import type { PhotoAudit } from "./photo-audit";
import type { SiteAiContext, SiteBrief } from "./types";

/**
 * Consignes données au modèle. Le texte SYSTÈME est stable (mis en cache chez le
 * fournisseur) ; tout ce qui varie (entreprise, catalogue, demande) est dans le message.
 */

const STYLE_GUIDE = STORE_TEMPLATES.map((t) => `- ${t.slug} : ${t.name} — ${t.tagline} (mise en page ${t.layout === "editorial" ? "éditoriale" : "catalogue"})`).join("\n");

/** Restaurant : ce qui change pour le modèle (dans le message, pas dans le texte système mis en cache). */
const RESTAURANT_NOTE = "Cette entreprise est un RESTAURANT : les « produits » ci-dessous sont les plats de sa carte (catégorie = rubrique de la carte) et les « catégories » ses rubriques. Les boutons mènent à la carte et à la réservation de table. Le style de base est imposé (« braise ») : choisis-en un quelconque, il sera remplacé ; joue sur la structure, la typographie, les formes et la palette. N'annonce ni horaires, ni livraison, ni promotion : ils sont gérés ailleurs. Écris pour donner faim, sans inventer un ingrédient absent des descriptions.";

/** Concession automobile : même principe. */
const AUTO_NOTE = "Cette entreprise est une CONCESSION AUTOMOBILE : les « produits » ci-dessous sont les véhicules publiés de son stock (catégorie = type de carrosserie). Les boutons mènent au stock et aux fiches véhicules (essai sur rendez-vous). Le style de base est imposé (« piste ») : choisis-en un quelconque, il sera remplacé ; joue sur la structure, la typographie, les formes et la palette. N'invente ni caractéristique technique, ni garantie, ni financement, ni promotion : seuls les éléments fournis existent. Écris sobrement, avec précision.";

const QUALITY = `Exigence de qualité Y-COM : des pages sobres et maîtrisées, où chaque bloc a une seule idée ; de grandes images quand elles existent ; une typographie précise ; de l'espace ; des textes courts, concrets et élégants (jamais de superlatifs creux, jamais de points d'exclamation en série) ; des animations fluides au service du produit, jamais gratuites.`;

const HONESTY = `Règles absolues :
- N'utilise QUE les produits, catégories et images fournis, par leur identifiant exact. N'invente ni produit, ni photo, ni prix.
- Ne modifie jamais un prix, un stock ou une caractéristique de produit : tu n'en as pas le droit et aucun outil ne le permet.
- N'invente aucune certification, aucun label, aucun avis ou témoignage client, aucune note, aucune promotion, aucune promesse de livraison, de garantie ou de remboursement. Décris uniquement ce que disent les descriptions fournies.
- Un produit sans photo ne doit jamais être mis en scène (ouverture, vitrine, récit).
- Écris en français, sans lien ni balise.`;

const ARCHETYPE_GUIDE = (Object.entries(ARCHETYPES) as [string, (typeof ARCHETYPES)[keyof typeof ARCHETYPES]][])
  .map(([key, a]) => `- ${key} (${a.label}) : ${a.description} Plan : ${a.outline.join(" → ")}.`)
  .join("\n");
const TYPE_GUIDE = Object.entries(FONT_PAIRS).map(([key, f]) => `- ${key} : ${f.description}`).join("\n");
const SHAPE_GUIDE = Object.entries(SHAPES).map(([key, f]) => `- ${key} : ${f.label}`).join("\n");

export const DIRECTIONS_SYSTEM = `Tu es directeur artistique pour Y-COM, une plateforme qui crée les sites des commerces d'Afrique de l'Ouest. À partir de la description d'une entreprise et de SON catalogue, tu proposes trois directions artistiques RÉELLEMENT différentes : trois STRUCTURES de page différentes (archétypes), trois typographies et trois ambiances — pas trois variantes d'une même idée.

${QUALITY}

Archétypes de page (un par direction, trois archétypes différents, choisis pour CETTE entreprise) :
${ARCHETYPE_GUIDE}

Typographies :
${TYPE_GUIDE}

Formes :
${SHAPE_GUIDE}

Styles de base (en-tête, pied de page, détails) :
${STYLE_GUIDE}

Palette : « primary » doit rester lisible sous un texte blanc (couleur foncée), « accent » aussi ; « background » est un fond clair et doux sur lequel un texte foncé reste très lisible. Les trois palettes doivent être nettement différentes.
Photos : l'archétype « magazine » et l'ouverture de « maison » sont à leur meilleur avec une grande photo d'ambiance ; sans elle, la plateforme adapte. Les produits mis en scène (ouverture, pièce signature, sélection, récit) doivent avoir une photo.
Textes : le manifeste et son texte reprennent ce que dit l'entreprise dans sa description, reformulé avec soin ; rien d'autre. Les étapes du récit décrivent chaque produit d'après SA description.

${HONESTY}`;

export function directionsPrompt(brief: SiteBrief, context: SiteAiContext, audit: PhotoAudit): string {
  return JSON.stringify(
    {
      entreprise: context.tenantName,
      description: { activite: brief.activity, public: brief.audience, styles_souhaites: brief.styles, gouts: brief.likes },
      logo_disponible: Boolean(context.logoUrl),
      bilan_photos: { produits_photographies: audit.withImage, sans_photo: audit.withoutImage.length, grande_photo_disponible: audit.hasHeroImage },
      categories: context.categories.map((c) => ({ id: c.id, nom: c.name, produits: c.productCount })),
      images_mediatheque: context.libraryImages.length,
      produits: context.products.map((p) => ({ id: p.id, nom: p.name, categorie: p.category, prix: p.priceLabel, description: p.description?.slice(0, 300) ?? null, ajoute_le: p.createdAt.slice(0, 10), photo: Boolean(p.imageUrl) })),
      ...(context.mode === "restaurant" ? { secteur: RESTAURANT_NOTE } : context.mode === "automobile" ? { secteur: AUTO_NOTE } : {}),
      consigne: "Propose trois directions artistiques pour la page d'accueil de ce site.",
    },
    null,
    1,
  );
}

const ADD_GUIDE = `Sections que tu peux AJOUTER (add_section) — la plateforme les compose avec les produits, photos et catégories de l'entreprise :
- showcase : carrousel immersif de produits photographiés (présentations : arc, depth, stack)
- story : récit au défilement, un produit par étape (sequence, focus, product, timeline)
- manifesto : grande phrase + texte + photo (image-left, image-right) — « title » = la phrase, « text » = le texte
- heritage : savoir-faire, histoire de la maison (image-left, image-right) — « title » + « text »
- signature : une pièce phare, avec son nom et sa description réels (dark, leather) — « productIds » = [la pièce]
- lookbook : 3 à 6 photos de produits (mosaic, fullscreen)
- gallery : galerie de photos de produits (masonry, grid, carousel)
- featured : sélection de produits (grid, carousel, masonry, editorial)
- new_arrivals : nouveautés (grid, carousel)
- categories : univers du catalogue (editorial, grid, carousel)
- closing : invitation finale vers le catalogue (banner, split) — « title » + « text »`;

export const EDIT_SYSTEM = `Tu es l'assistant de personnalisation de site de Y-COM. L'entreprise te demande une modification de sa page d'accueil ; tu réponds par des OPÉRATIONS limitées à ce qui est demandé, appliquées ensuite par la plateforme après validation de l'entreprise.

${QUALITY}

${ADD_GUIDE}

Typographies (set_typography) :
${TYPE_GUIDE}
Formes (set_shape) :
${SHAPE_GUIDE}

Principes :
- Ne change que ce qui est demandé. Ne touche pas aux autres sections, textes ou réglages, même si tu les trouves perfectibles.
- « Fond » d'une section précise → set_section_background ; fond de tout le site → set_colors (background).
- « Plus luxueux », « plus chaleureux »… → une petite série cohérente d'opérations (style, typographie, formes, couleurs, rythme, présentation) et rien d'autre.
- « Nouveautés en premier » → feature_products avec la stratégie « newest » sur la sélection concernée, et, si demandé, déplace-la.
- « Plus d'espace », « plus compact » → set_spacing (sur la section désignée, ou sur toutes si c'est le site entier).
- Textes : set_text sur le champ exact (title, subtitle, statement, body, description, boutons…). Reformule d'après ce que dit l'entreprise ; n'invente rien.
- Animations sur téléphone → set_animation avec « mobile » (reduced ou none), le reste « unchanged ».
- Si la demande est impossible (prix, stock, ajout de témoignages, produit inexistant…) ou trop vague, n'envoie aucune opération et explique brièvement pourquoi ou pose UNE question.
- « Cette section », « ce fond », « ce titre » désignent la section sélectionnée dans l'aperçu (si elle est indiquée).
- Utilise uniquement les identifiants de sections et de produits fournis.

${HONESTY}`;

export function describeState(state: SiteState) {
  return {
    identite: { style: state.identity.style, typographie: state.identity.fontPair ?? "celle du style", formes: state.identity.shape ?? "celles du style", couleur_principale: state.identity.primaryColor, accent: state.identity.accentColor, fond: state.identity.backgroundColor },
    animations: state.motion,
    sections: state.blocks.map((b) => {
      const params = b.params as Record<string, unknown>;
      const texts = Object.fromEntries(["eyebrow", "title", "titleAccent", "subtitle", "intro", "statement", "body", "description", "primaryCtaLabel", "secondaryCtaLabel", "ctaLabel", "buttonLabel"].filter((k) => typeof params[k] === "string").map((k) => [k, params[k]]));
      const steps = Array.isArray(params.steps) ? (params.steps as { title?: string }[]).map((s, i) => ({ index: i, titre: s.title })) : undefined;
      return { id: b.id, type: SECTION_NAMES[b.sectionKey] ?? b.sectionKey, presentation: b.variant, textes: texts, ...(steps ? { etapes: steps } : {}), produits: params.productIds ?? null, fond: params.backgroundColor ?? null };
    }),
  };
}

export function editPrompt(message: string, state: SiteState, context: SiteAiContext, history: { role: "client" | "assistant"; text: string }[], selectedSectionId: string | null): string {
  return JSON.stringify(
    {
      entreprise: context.tenantName,
      ...(context.mode === "restaurant" ? { secteur: RESTAURANT_NOTE } : context.mode === "automobile" ? { secteur: AUTO_NOTE } : {}),
      site_actuel: describeState(state),
      produits: context.products.map((p) => ({ id: p.id, nom: p.name, categorie: p.category, ajoute_le: p.createdAt.slice(0, 10), photo: Boolean(p.imageUrl) })),
      conversation_recente: history.slice(-6),
      section_selectionnee_dans_l_apercu: selectedSectionId,
      demande: message,
    },
    null,
    1,
  );
}

export const IMPROVE_REQUEST = "Propose jusqu'à 6 améliorations concrètes de cette page d'accueil pour qu'elle soit plus professionnelle et plus agréable : ordre des sections, choix des produits mis en avant, textes plus précis (d'après les descriptions uniquement), présentation. Explique chaque choix en une phrase dans ta réponse. Ne change pas le style ni les couleurs si rien ne le justifie.";
