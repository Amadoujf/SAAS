/**
 * Vérification de contraste WCAG — voir la demande du 20 septembre 2026, « protection
 * contre les couleurs illisibles ». Formule de luminance relative/ratio de contraste
 * standard (WCAG 2.1 §1.4.3) — module pur, aucune dépendance, entièrement testable.
 */

/** Parse une couleur CSS en RGB — accepte `#rgb`, `#rrggbb`, `rgb()`/`rgba()`.
 *  Retourne `null` pour tout ce qu'elle ne sait pas interpréter (ex. `var(--x)`,
 *  un nom de couleur CSS) plutôt que de deviner : mieux vaut ne pas avertir que
 *  d'avertir à tort sur une valeur qu'on n'a pas réellement comprise. */
export function parseColor(input: string): { r: number; g: number; b: number } | null {
  const value = input.trim();

  const hexMatch = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (hexMatch) {
    const hex = hexMatch[1]!;
    if (hex.length === 3) {
      const [r, g, b] = hex.split("").map((c) => parseInt(c + c, 16));
      return { r: r!, g: g!, b: b! };
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return { r, g, b };
  }

  const rgbMatch = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+\s*)?\)$/i.exec(value);
  if (rgbMatch) {
    return { r: Number(rgbMatch[1]), g: Number(rgbMatch[2]), b: Number(rgbMatch[3]) };
  }

  return null;
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const channel = (c: number) => {
    const normalized = c / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Ratio de contraste WCAG entre deux couleurs — de 1 (identiques) à 21 (noir/blanc).
 *  Retourne `null` si l'une des deux couleurs n'a pas pu être interprétée (voir
 *  `parseColor`) — pas de faux avertissement sur une valeur non comprise. */
export function contrastRatio(colorA: string, colorB: string): number | null {
  const a = parseColor(colorA);
  const b = parseColor(colorB);
  if (!a || !b) return null;
  const lumA = relativeLuminance(a);
  const lumB = relativeLuminance(b);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

export type ContrastLevel = "fail" | "warn" | "pass";

/** Seuils WCAG 2.1 AA pour du texte normal (4.5:1) — voir §1.4.3. En dessous de 3:1,
 *  le texte est pratiquement illisible ("fail") ; entre 3:1 et 4.5:1, lisible mais
 *  sous le seuil recommandé ("warn"). */
export function evaluateContrast(foreground: string, background: string): { ratio: number | null; level: ContrastLevel } {
  const ratio = contrastRatio(foreground, background);
  if (ratio === null) return { ratio: null, level: "pass" }; // couleur non interprétable : ne bloque jamais
  if (ratio < 3) return { ratio, level: "fail" };
  if (ratio < 4.5) return { ratio, level: "warn" };
  return { ratio, level: "pass" };
}
