import { STORE_TEMPLATES } from "@/lib/storefront/store-templates";
import { SECTION_NAMES } from "@/lib/editor/section-names";
import type { SiteState } from "./operations";
import type { PhotoAudit } from "./photo-audit";
import type { SiteAiContext, SiteBrief } from "./types";

/**
 * Consignes données au modèle. Le texte SYSTÈME est stable (mis en cache chez le
 * fournisseur) ; tout ce qui varie (entreprise, catalogue, demande) est dans le message.
 */

const STYLE_GUIDE = STORE_TEMPLATES.map((t) => `- ${t.slug} : ${t.name} — ${t.tagline} (mise en page ${t.layout === "editorial" ? "éditoriale" : "catalogue"})`).join("\n");

const QUALITY = `Exigence de qualité Y-COM : des pages sobres et maîtrisées, où chaque bloc a une seule idée ; de grandes images quand elles existent ; une typographie précise ; de l'espace ; des textes courts, concrets et élégants (jamais de superlatifs creux, jamais de points d'exclamation en série) ; des animations fluides au service du produit, jamais gratuites.`;

const HONESTY = `Règles absolues :
- N'utilise QUE les produits, catégories et images fournis, par leur identifiant exact. N'invente ni produit, ni photo, ni prix.
- Ne modifie jamais un prix, un stock ou une caractéristique de produit : tu n'en as pas le droit et aucun outil ne le permet.
- N'invente aucune certification, aucun label, aucun avis ou témoignage client, aucune note, aucune promotion, aucune promesse de livraison, de garantie ou de remboursement. Décris uniquement ce que disent les descriptions fournies.
- Un produit sans photo ne doit jamais être mis en scène (ouverture, vitrine, récit).
- Écris en français, sans lien ni balise.`;

export const DIRECTIONS_SYSTEM = `Tu es directeur artistique pour Y-COM, une plateforme qui crée les sites des commerces d'Afrique de l'Ouest. À partir de la description d'une entreprise et de SON catalogue, tu proposes trois directions artistiques RÉELLEMENT différentes (ambiance, style, palette, rythme, composition) — pas trois variantes d'une même idée.

${QUALITY}

Styles disponibles (choisis-en un par direction, de préférence trois différents) :
${STYLE_GUIDE}

Palette : « primary » doit rester lisible sous un texte blanc (couleur foncée), « accent » aussi ; « background » est un fond clair et doux sur lequel un texte foncé reste très lisible.
Composition : l'ouverture « architectural » demande une grande photographie ; « stage » met en scène un produit photographié ; « centered » fonctionne même sans photo. La vitrine « arc » demande au moins 4 produits photographiés. Le récit présente 2 à 4 produits photographiés, avec pour chacun ce que dit SA description.

${HONESTY}`;

export function directionsPrompt(brief: SiteBrief, context: SiteAiContext, audit: PhotoAudit): string {
  return JSON.stringify(
    {
      entreprise: context.tenantName,
      description: { activite: brief.activity, public: brief.audience, styles_souhaites: brief.styles, gouts: brief.likes },
      logo_disponible: Boolean(context.logoUrl),
      bilan_photos: { produits_photographies: audit.withImage, sans_photo: audit.withoutImage.length, grande_photo_disponible: audit.hasHeroImage },
      categories: context.categories.map((c) => ({ id: c.id, nom: c.name, produits: c.productCount })),
      produits: context.products.map((p) => ({ id: p.id, nom: p.name, categorie: p.category, prix: p.priceLabel, description: p.description?.slice(0, 300) ?? null, ajoute_le: p.createdAt.slice(0, 10), photo: Boolean(p.imageUrl) })),
      consigne: "Propose trois directions artistiques pour la page d'accueil de ce site.",
    },
    null,
    1,
  );
}

export const EDIT_SYSTEM = `Tu es l'assistant de personnalisation de site de Y-COM. L'entreprise te demande une modification de sa page d'accueil ; tu réponds par des OPÉRATIONS limitées à ce qui est demandé, appliquées ensuite par la plateforme après validation de l'entreprise.

${QUALITY}

Principes :
- Ne change que ce qui est demandé. Ne touche pas aux autres sections, textes ou réglages, même si tu les trouves perfectibles.
- « Fond » d'une section précise → set_section_background ; fond de tout le site → set_colors (background).
- « Plus luxueux », « plus chaleureux »… → une petite série cohérente d'opérations (style, couleurs, rythme, présentation) et rien d'autre.
- « Nouveautés en premier » → feature_products avec la stratégie « newest » sur la vitrine concernée, et, si demandé, déplace-la.
- Animations sur téléphone → set_animation avec « mobile » (reduced ou none), le reste « unchanged ».
- Si la demande est impossible (prix, stock, ajout de témoignages, produit inexistant…) ou trop vague, n'envoie aucune opération et explique brièvement pourquoi ou pose UNE question.
- « Cette section », « ce fond », « ce titre » désignent la section sélectionnée dans l'aperçu (si elle est indiquée).
- Utilise uniquement les identifiants de sections et de produits fournis.

${HONESTY}`;

export function describeState(state: SiteState) {
  return {
    identite: { style: state.identity.style, couleur_principale: state.identity.primaryColor, accent: state.identity.accentColor, fond: state.identity.backgroundColor },
    animations: state.motion,
    sections: state.blocks.map((b) => {
      const params = b.params as Record<string, unknown>;
      const texts = Object.fromEntries(["eyebrow", "title", "titleAccent", "subtitle", "intro", "primaryCtaLabel", "secondaryCtaLabel", "ctaLabel"].filter((k) => typeof params[k] === "string").map((k) => [k, params[k]]));
      const steps = Array.isArray(params.steps) ? (params.steps as { title?: string }[]).map((s, i) => ({ index: i, titre: s.title })) : undefined;
      return { id: b.id, type: SECTION_NAMES[b.sectionKey] ?? b.sectionKey, presentation: b.variant, textes: texts, ...(steps ? { etapes: steps } : {}), produits: params.productIds ?? null, fond: params.backgroundColor ?? null };
    }),
  };
}

export function editPrompt(message: string, state: SiteState, context: SiteAiContext, history: { role: "client" | "assistant"; text: string }[], selectedSectionId: string | null): string {
  return JSON.stringify(
    {
      entreprise: context.tenantName,
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
