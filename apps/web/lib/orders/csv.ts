/** Cellule CSV sûre : échappement des guillemets/séparateurs et neutralisation de
 *  l'injection de formules dans les tableurs (=, +, -, @ en tête). */
export function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
