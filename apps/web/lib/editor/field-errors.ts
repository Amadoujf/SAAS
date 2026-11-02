import { z } from "zod";

/**
 * Traduction des erreurs Zod en messages compréhensibles pour un client non technique
 * (voir docs/12 §12.2, « messages d'erreur compréhensibles »). Traduit sur le CODE
 * d'erreur Zod (`too_small`, `invalid_type`, ...), jamais sur le texte anglais du
 * message — robuste à n'importe quel schéma, y compris ceux d'un futur secteur, sans
 * dictionnaire de champs à maintenir.
 */
function translateIssue(issue: z.core.$ZodIssue): string {
  switch (issue.code) {
    case "invalid_type": {
      // Valeur absente : Zod 4 ne garde la valeur reçue que sur demande (`reportInput`,
      // voir `validateWithMessages`), sinon seul son message la mentionne.
      const input = (issue as { input?: unknown }).input;
      if (("input" in issue && (input === undefined || input === null)) || /received (undefined|null)\b/.test(issue.message)) {
        return "Ce champ est requis.";
      }
      return `Valeur invalide (type attendu : ${issue.expected}).`;
    }

    case "too_small": {
      const minimum = Number(issue.minimum);
      if (issue.origin === "string") {
        return minimum === 1 ? "Ce champ est requis." : `Doit contenir au moins ${minimum} caractères.`;
      }
      if (issue.origin === "array" || issue.origin === "set") {
        return `Sélectionnez au moins ${minimum} élément(s).`;
      }
      if (issue.origin === "number" || issue.origin === "int" || issue.origin === "bigint") {
        return `Doit être supérieur ou égal à ${minimum}.`;
      }
      return "Valeur trop petite.";
    }

    case "too_big": {
      const maximum = Number(issue.maximum);
      if (issue.origin === "string") return `Doit contenir au plus ${maximum} caractères.`;
      if (issue.origin === "array" || issue.origin === "set") return `Sélectionnez au plus ${maximum} élément(s).`;
      if (issue.origin === "number" || issue.origin === "int" || issue.origin === "bigint") {
        return `Doit être inférieur ou égal à ${maximum}.`;
      }
      return "Valeur trop grande.";
    }

    case "invalid_format":
      if (issue.format === "url") return "Doit être un lien valide (ex. https://...).";
      if (issue.format === "email") return "Doit être une adresse courriel valide.";
      return "Format invalide.";

    case "invalid_value":
      return `Valeur invalide. Choisissez parmi : ${issue.values.map(String).join(", ")}.`;

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
  const result = schema.safeParse(value, { reportInput: true });
  if (result.success) {
    return { success: true, data: result.data, fieldErrors: {} };
  }
  return { success: false, fieldErrors: describeZodError(result.error) };
}
