import { describe, expect, it } from "vitest";
import * as luxuryMinimal from "./luxury-minimal-template";
import * as marketplace from "./marketplace-template";
import * as commerceModerne from "./commerce-moderne-template";
import * as terangaAtelier from "./teranga-atelier-template";
import * as dakarDistributionPro from "./dakar-distribution-pro-template";

/**
 * Garde-fou anti-fuite de contenu entre templates — demandé explicitement le 20
 * septembre 2026, après deux bugs réels trouvés lors de la construction des 3 premiers
 * templates : (1) le pied de page partagé affichait la tagline « Maroquinerie et
 * bijoux... » de Maison Almadies sur Sunu Marché ET Sunu Kicks (texte codé en dur dans
 * `Footer` au lieu d'une prop) ; (2) la section galerie de Sunu Kicks affichait le titre
 * par défaut « L'univers de la maison », pensé pour Sunu Marché. Ce test vérifie
 * MÉCANIQUEMENT qu'aucune donnée d'identité ou de catalogue d'un template
 * n'apparaît dans le contenu sérialisé d'un autre — plutôt que de compter sur une revue
 * visuelle manuelle pour détecter la prochaine fuite de ce genre.
 *
 * Ajouter un nouveau template : lui donner `SHOP_NAME`/`SHOP_TAGLINE` (voir les 3
 * templates existants) puis ajouter une entrée à `TEMPLATES` ci-dessous — rien d'autre à
 * écrire, ce test le couvre automatiquement contre tous les autres.
 */

interface DemoTemplateModule {
  SHOP_NAME: string;
  SHOP_TAGLINE?: { fr: string; en: string };
  WHATSAPP_NUMBER?: string;
  DEMO_MANIFEST: unknown;
  DEMO_RESOLVED_CONTENT: Record<string, unknown>;
  DEMO_NAV_ITEMS?: unknown;
  DEMO_FOOTER_GROUPS?: unknown;
  DEMO_CART_LINES?: unknown;
  getAllProductHandles?: () => string[];
  getProductByHandle?: (handle: string) => { name?: string } | undefined;
}

const TEMPLATES: { name: string; mod: DemoTemplateModule }[] = [
  { name: "luxury-minimal (Maison Almadies)", mod: luxuryMinimal as unknown as DemoTemplateModule },
  { name: "marketplace (Sunu Marché)", mod: marketplace as unknown as DemoTemplateModule },
  { name: "commerce-moderne (Sunu Kicks)", mod: commerceModerne as unknown as DemoTemplateModule },
  {
    name: "teranga-atelier (Teranga Atelier)",
    mod: terangaAtelier as unknown as DemoTemplateModule,
  },
  {
    name: "dakar-distribution-pro (Dakar Distribution Pro)",
    mod: dakarDistributionPro as unknown as DemoTemplateModule,
  },
];

/** Sérialise tout le contenu affichable d'un template en un seul bloc de texte. */
function serializeTemplateContent(mod: DemoTemplateModule): string {
  const handles = mod.getAllProductHandles?.() ?? [];
  return JSON.stringify({
    manifest: mod.DEMO_MANIFEST,
    resolvedContent: mod.DEMO_RESOLVED_CONTENT,
    navItems: mod.DEMO_NAV_ITEMS,
    footerGroups: mod.DEMO_FOOTER_GROUPS,
    cartLines: mod.DEMO_CART_LINES,
    productDetails: handles.map((handle) => mod.getProductByHandle?.(handle)),
  });
}

/**
 * Noms de PRODUITS propres à ce template — volontairement PAS les noms de catégories
 * (« Accessoires », « Nouveautés »... sont des mots génériques qu'il est parfaitement
 * légitime que deux commerces différents réutilisent tous les deux — ce ne serait pas
 * une fuite). Un nom de produit complet (ex. « Sneakers Blanches Édition Rouge »), en
 * revanche, est assez spécifique pour qu'une coïncidence entre deux templates soit en
 * réalité une fiche produit copiée-collée par erreur.
 */
function collectCatalogNames(mod: DemoTemplateModule): string[] {
  const names = new Set<string>();
  for (const content of Object.values(mod.DEMO_RESOLVED_CONTENT ?? {})) {
    if (!content || typeof content !== "object") continue;
    const c = content as { products?: { name?: string }[] };
    for (const product of c.products ?? []) {
      if (product.name) names.add(product.name);
    }
  }
  for (const handle of mod.getAllProductHandles?.() ?? []) {
    const name = mod.getProductByHandle?.(handle)?.name;
    if (name) names.add(name);
  }
  return Array.from(names);
}

/** Chaînes qui identifient CE template — si elles apparaissent dans un autre, c'est une
 *  fuite (comme la tagline de Maison Almadies retrouvée sur les 2 autres templates). */
function collectIdentityStrings(mod: DemoTemplateModule): string[] {
  const strings = [
    mod.SHOP_NAME,
    mod.SHOP_TAGLINE?.fr,
    mod.SHOP_TAGLINE?.en,
    mod.WHATSAPP_NUMBER,
  ].filter((value): value is string => Boolean(value && value.length > 0));
  return [...strings, ...collectCatalogNames(mod)];
}

describe("aucune fuite de contenu entre templates (identité + catalogue)", () => {
  for (const template of TEMPLATES) {
    const identityStrings = collectIdentityStrings(template.mod);

    it(`"${template.name}" a bien un nom et une tagline propres (précondition du test)`, () => {
      expect(template.mod.SHOP_NAME).toBeTruthy();
      expect(template.mod.SHOP_TAGLINE?.fr).toBeTruthy();
    });

    for (const other of TEMPLATES) {
      if (other.name === template.name) continue;

      it(`le contenu de "${other.name}" ne contient aucune donnée d'identité de "${template.name}"`, () => {
        const haystack = serializeTemplateContent(other.mod);
        // On ne vérifie que le nom/la tagline/le numéro WhatsApp ici (pas les noms de
        // catalogue, séparés ci-dessous) pour un message d'échec précis en cas de fuite.
        const ownIdentity = [
          template.mod.SHOP_NAME,
          template.mod.SHOP_TAGLINE?.fr,
          template.mod.SHOP_TAGLINE?.en,
          template.mod.WHATSAPP_NUMBER,
        ].filter((value): value is string => Boolean(value));
        for (const needle of ownIdentity) {
          expect(haystack).not.toContain(needle);
        }
      });

      it(`"${other.name}" n'a aucun produit du même nom EXACT que "${template.name}" (fiche copiée-collée par erreur)`, () => {
        // Comparaison par égalité exacte entre les deux catalogues de noms — pas une
        // recherche de sous-chaîne dans le JSON sérialisé, qui donnerait un faux
        // positif dès qu'un nom de produit est le préfixe d'un autre (ex. « Sac
        // Bandoulière » vs « Sac Bandoulière Structuré », deux produits différents et
        // légitimes de deux commerces différents, pas une fuite).
        const ownNames = new Set(collectCatalogNames(template.mod));
        const otherNames = collectCatalogNames(other.mod);
        const collisions = otherNames.filter((name) => ownNames.has(name));
        expect(collisions).toEqual([]);
      });
    }

    // Garde également contre une régression silencieuse de `collectIdentityStrings`
    // elle-même (liste vide = test qui ne vérifie plus rien).
    it(`"${template.name}" fournit au moins une chaîne d'identité à vérifier`, () => {
      expect(identityStrings.length).toBeGreaterThan(0);
    });
  }
});
