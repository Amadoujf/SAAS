import { z } from "zod";
import { sectionInstanceSchema, validateSectionInstance } from "./sections";

/**
 * Une page fournie par un template — voir docs/12 §12.6 (pages incluses par template).
 * Les sections y sont des instances concrètes (voir sections.ts), pas juste des clés :
 * c'est ce qui rend un template « réellement différent » d'un autre (même les sections
 * partagées entre deux templates du même secteur peuvent avoir des variantes,
 * paramètres et ordres complètement différents).
 */
export const pageDefinitionSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  isHome: z.boolean().default(false),
  sections: z.array(sectionInstanceSchema),
});

export type PageDefinition = z.infer<typeof pageDefinitionSchema>;

export const templateManifestSchema = z.object({
  pages: z.array(pageDefinitionSchema).min(1),
});

export type TemplateManifest = z.infer<typeof templateManifestSchema>;

/**
 * Valide un manifeste de template de bout en bout : structure générale, une page
 * d'accueil au plus, chaque section valide individuellement (clé/variante/paramètres),
 * et aucun doublon d'identifiant de section au sein d'une même page.
 */
export function validateTemplateManifest(raw: unknown): TemplateManifest {
  const manifest = templateManifestSchema.parse(raw);

  const homePages = manifest.pages.filter((page) => page.isHome);
  if (homePages.length > 1) {
    throw new Error("Un template ne peut avoir qu'une seule page marquée isHome=true.");
  }

  const slugs = new Set<string>();
  for (const page of manifest.pages) {
    if (slugs.has(page.slug)) {
      throw new Error(`Slug de page dupliqué dans le manifeste : "${page.slug}".`);
    }
    slugs.add(page.slug);

    const sectionIds = new Set<string>();
    for (const section of page.sections) {
      validateSectionInstance(section);
      if (sectionIds.has(section.id)) {
        throw new Error(
          `Identifiant de section dupliqué sur la page "${page.slug}" : "${section.id}".`,
        );
      }
      sectionIds.add(section.id);
    }
  }

  return manifest;
}
