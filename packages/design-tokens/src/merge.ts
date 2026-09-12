import { designTokensSchema, type DesignTokens, type DesignTokensOverrides } from "./schema";

/**
 * Fusionne les tokens par défaut d'un template avec la surcharge d'une entreprise —
 * sans jamais muter ni l'un ni l'autre (exigence de la validation du 13 septembre 2026 :
 * « les personnalisations d'un client doivent surcharger les valeurs du template sans
 * modifier le template original »).
 *
 * Fusion à deux niveaux (groupe, ex. `colors`, puis clé, ex. `primary`) — suffisant car
 * `DesignTokens` n'a pas de niveaux plus profonds. Le résultat est revalidé pour
 * garantir qu'une surcharge partielle malformée ne produise jamais un thème invalide :
 * en cas d'échec de validation, la fusion est rejetée (throw) plutôt que d'être
 * silencieusement ignorée ou de laisser passer une valeur incohérente au rendu.
 */
export function mergeDesignTokens(
  base: DesignTokens,
  overrides: DesignTokensOverrides | null | undefined,
): DesignTokens {
  if (!overrides || Object.keys(overrides).length === 0) {
    return structuredClone(base);
  }

  const merged: Record<string, unknown> = structuredClone(base);

  for (const [groupKey, groupOverride] of Object.entries(overrides)) {
    if (groupOverride == null) continue;
    const currentGroup = merged[groupKey];
    merged[groupKey] =
      typeof currentGroup === "object" && currentGroup !== null && typeof groupOverride === "object"
        ? { ...(currentGroup as object), ...(groupOverride as object) }
        : groupOverride;
  }

  return designTokensSchema.parse(merged);
}
