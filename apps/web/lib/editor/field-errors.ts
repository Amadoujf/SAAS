import { z } from "zod";

/**
 * Traduction des erreurs Zod en messages compréhensibles pour un client non technique
 * (voir docs/12 §12.2, « messages d'erreur compréhensibles »). Traduit sur le CODE
 * d'erreur Zod (`too_small`, `invalid_type`, ...), jamais sur le texte anglais du
 * message — robuste à n'importe quel schéma, y compris ceux d'un futur secteur, sans
 * dictionnaire de champs à maintenir.
 */
function translateIssue(issue: z.ZodIssue): string {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === "undefined" || issue.received === "null") {
        return "Ce champ est requis.";
      }
      return `Valeur invalide (type attendu : ${issue.expected}).`;

    case z.ZodIssueCode.too_small:
      if (issue.type === "string") {
        return issue.minimum === 1
          ? "Ce champ est requis."
          : `Doit contenir au moins ${issue.minimum} caractères.`;
      }
      if (issue.type === "array") {
        return `Sélectionnez au moins ${issue.minimum} élément(s).`;
      }
      if (issue.type === "number") {
        return `Doit être supérieur ou égal à ${issue.minimum}.`;
      }
      return "Valeur trop petite.";

    case z.ZodIssueCode.too_big:
      if (issue.type === "string") {
        return `Doit contenir au plus ${issue.maximum} caractères.`;
      }
      if (issue.type === "array") {
        return `Sélectionnez au plus ${issue.maximum} élément(s).`;
      }
      if (issue.type === "number") {
        return `Doit être inférieur ou égal à ${issue.maximum}.`;
      }
      return "Valeur trop grande.";

    case z.ZodIssueCode.invalid_string:
      if (issue.validation === "url") return "Doit être un lien valide (ex. https://...).";
      if (issue.validation === "email") return "Doit être une adresse courriel valide.";
      return "Format invalide.";

    case z.ZodIssueCode.invalid_enum_value:
      return `Valeur invalide. Choisissez parmi : ${issue.options.join(", ")}.`;

    default:
      return issue.message || "Valeur invalide.";
  }
}

/** Regroupe les messages d'erreur (traduits) par champ de premier niveau — un champ
 *  imbriqué (ex. `media.url`) reste rattaché à son chemin complet, joint par ".". */
export function describeZodError(error: z.ZodError): Record<string, string[]> {
  const byField: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.length > 0 ? issue.path.join(".") : "_root";
    const message = translateIssue(issue);
    (byField[path] ??= []).push(message);
  }
  return byField;
}

export type FieldValidationResult<T> =
  | { success: true; data: T; fieldErrors: Record<string, string[]> }
  | { success: false; fieldErrors: Record<string, string[]> };

/** Valide `value` avec `schema` et retourne toujours des erreurs par champ déjà
 *  traduites — jamais une `ZodError` brute exposée à l'interface. */
export function validateWithMessages<T>(
  schema: z.ZodType<T>,
  value: unknown,
): FieldValidationResult<T> {
  const result = schema.safeParse(value);
  if (result.success) {
    return { success: true, data: result.data, fieldErrors: {} };
  }
  return { success: false, fieldErrors: describeZodError(result.error) };
}
