import { z } from "zod";
import { sectionParamSchemas, type SectionInstance } from "@yamacommerce/templates";
import { describeObjectSchema, type FieldDescriptor } from "./schema-introspect";

/**
 * Détection des sections qui référencent un média — voir docs/12 §12.2, « médiathèque
 * R2 » (21 septembre 2026), « Un média utilisé ne doit pas être supprimé
 * silencieusement. » « Avant suppression : afficher les pages et sections qui
 * l'utilisent. ».
 *
 * RÉUTILISE l'introspection de schéma déjà construite pour les panneaux avancés de
 * personnalisation (voir schema-introspect.ts) : un champ de nature "url" (résolu
 * structurellement depuis le schéma Zod de la section, jamais une liste de noms de
 * champs codée en dur) est un candidat de référence média — ce module fonctionne donc
 * identiquement pour les 23 sections e-commerce déjà livrées ET pour n'importe quelle
 * section d'un futur secteur, sans modification.
 */

function collectMatchingFieldPaths(
  fields: FieldDescriptor[],
  value: unknown,
  targetUrl: string,
  prefix: string,
): string[] {
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const hits: string[] = [];

  for (const field of fields) {
    const raw = record[field.name];
    const path = prefix ? `${prefix}.${field.name}` : field.name;

    if (field.kind === "url") {
      if (typeof raw === "string" && raw === targetUrl) hits.push(path);
    } else if (field.kind === "object") {
      hits.push(...collectMatchingFieldPaths(field.fields ?? [], raw, targetUrl, path));
    } else if (field.kind === "array-object" && Array.isArray(raw)) {
      raw.forEach((item, index) => {
        hits.push(...collectMatchingFieldPaths(field.itemFields ?? [], item, targetUrl, `${path}[${index}]`));
      });
    }
  }

  return hits;
}

/** Chemins de champs (ex. "media.url", "images[2].url") d'UNE section référençant
 *  `targetUrl` — tableau vide si aucune correspondance. Ne lève jamais : une section
 *  dont la clé n'a pas (ou plus) de schéma connu est traitée comme n'ayant aucune
 *  référence, plutôt que de faire planter la vérification de suppression. */
export function findMediaReferencesInSection(section: SectionInstance, targetUrl: string): string[] {
  const schema = sectionParamSchemas[section.sectionKey] as z.ZodObject<z.ZodRawShape> | undefined;
  if (!schema) return [];
  const fields = describeObjectSchema(schema);
  return collectMatchingFieldPaths(fields, section.params, targetUrl, "");
}

export interface MediaUsageLocation {
  pageId: string;
  pageSlug: string;
  pageTitle: string;
  sectionId: string;
  sectionKey: string;
  fieldPaths: string[];
}

export interface PageForMediaScan {
  id: string;
  slug: string;
  title: string;
  blocks: SectionInstance[];
}

/** Scanne un ensemble de pages (typiquement le brouillon courant de l'éditeur, voir
 *  lib/editor/editor-reducer.ts `EditorPage[]`) et retourne chaque section qui
 *  référence `targetUrl`, avec les chemins de champs précis concernés. */
export function findMediaReferencesInPages(
  pages: PageForMediaScan[],
  targetUrl: string,
): MediaUsageLocation[] {
  const results: MediaUsageLocation[] = [];
  for (const page of pages) {
    for (const block of page.blocks) {
      const fieldPaths = findMediaReferencesInSection(block, targetUrl);
      if (fieldPaths.length > 0) {
        results.push({
          pageId: page.id,
          pageSlug: page.slug,
          pageTitle: page.title,
          sectionId: block.id,
          sectionKey: block.sectionKey,
          fieldPaths,
        });
      }
    }
  }
  return results;
}

function collectAllUrls(fields: FieldDescriptor[], value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const urls: string[] = [];

  for (const field of fields) {
    const raw = record[field.name];
    if (field.kind === "url") {
      if (typeof raw === "string" && raw.length > 0) urls.push(raw);
    } else if (field.kind === "object") {
      urls.push(...collectAllUrls(field.fields ?? [], raw));
    } else if (field.kind === "array-object" && Array.isArray(raw)) {
      raw.forEach((item) => urls.push(...collectAllUrls(field.itemFields ?? [], item)));
    }
  }

  return urls;
}

export interface MediaUrlReference {
  url: string;
  pageSlug: string;
  sectionId: string;
}

/**
 * Extrait TOUTES les URLs de médias référencées par un ensemble de pages — voir
 * docs/12 §12.3, « MÉDIAS » : « rendre publics uniquement les médias réellement
 * utilisés par la version publiée ». Contrairement à `findMediaReferencesInPages`
 * (qui cherche UNE url précise, pour la garde de suppression), cette fonction énumère
 * chaque référence trouvée — utilisée par le pipeline de publication pour construire
 * `PublishReadinessInput.mediaReferences` (voir @yamacommerce/publishing) et pour
 * décider quels médias promouvoir publics au moment de publier.
 */
export function extractMediaUrlsFromPages(pages: PageForMediaScan[]): MediaUrlReference[] {
  const results: MediaUrlReference[] = [];
  for (const page of pages) {
    for (const block of page.blocks) {
      const schema = sectionParamSchemas[block.sectionKey] as z.ZodObject<z.ZodRawShape> | undefined;
      if (!schema) continue;
      const fields = describeObjectSchema(schema);
      for (const url of collectAllUrls(fields, block.params)) {
        results.push({ url, pageSlug: page.slug, sectionId: block.id });
      }
    }
  }
  return results;
}
