"use client";

import { SECTION_NAMES } from "@/lib/editor/section-names";
import { useMemo } from "react";
import { z } from "zod";
import { sectionParamSchemas, type SectionInstance } from "@yamacommerce/templates";
import { describeObjectSchema } from "@/lib/editor/schema-introspect";
import { validateWithMessages } from "@/lib/editor/field-errors";
import { isFieldHidden, isItemFieldHidden } from "@/lib/editor/field-visibility";
import { SchemaForm } from "./schema-form";

/**
 * Onglet "Contenu" — voir docs/12 §12.2. Formulaire ENTIÈREMENT généré à partir de
 * `sectionParamSchemas[section.sectionKey]` (voir @yamacommerce/templates) : ce fichier
 * ne connaît le nom d'AUCUN champ (titre, bouton, produit...) — il fonctionne
 * identiquement pour les 23 sections e-commerce déjà livrées et pour n'importe quelle
 * section d'un futur secteur, du moment qu'elle expose un schéma Zod dans le registre.
 */
export function ContentPanel({
  section,
  originalSection,
  onChange,
  mediaApiBase,
}: {
  section: SectionInstance;
  originalSection: SectionInstance | undefined;
  onChange: (params: Record<string, unknown>) => void;
  mediaApiBase?: string;
}) {
  // `sectionParamSchemas[section.sectionKey]` indexe par une union de clés : TypeScript
  // ne peut pas savoir statiquement laquelle des 23 formes précises en résulte (elle
  // est déjà revalidée à l'exécution par `validateSectionInstance` en amont, voir
  // section-renderer.tsx) — un seul cast documenté ici, jamais un `any` implicite.
  const schema = sectionParamSchemas[section.sectionKey] as z.ZodObject<z.ZodRawShape>;
  const fields = useMemo(() => describeObjectSchema(schema), [schema]);
  const validation = useMemo(() => validateWithMessages(schema, section.params), [schema, section.params]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12px] text-gray-500">
        Contenu de la section <span className="font-medium text-gray-700">{SECTION_NAMES[section.sectionKey] ?? section.sectionKey}</span>.
      </p>
      <SchemaForm
        fields={fields}
        value={section.params}
        onChange={onChange}
        originalValue={originalSection?.params}
        errors={validation.success ? undefined : validation.fieldErrors}
        idPrefix={`content-${section.id}`}
        mediaApiBase={mediaApiBase}
        isHidden={(name) => isFieldHidden(section.sectionKey, section.variant, name, section.params)}
        isItemHidden={(list, name) => isItemFieldHidden(section.sectionKey, section.variant, list, name)}
      />
    </div>
  );
}
