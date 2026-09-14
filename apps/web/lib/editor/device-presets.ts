/**
 * Préréglages d'appareils pour l'aperçu iframe — voir docs/12 §12.2, « aperçu iframe
 * responsive » (21 septembre 2026). Module PUR, sector-agnostic : ce ne sont que des
 * dimensions d'écran, pertinentes pour n'importe quel secteur/template.
 *
 * Couvre les 7 largeurs explicitement demandées pour vérification (320, 375, 390,
 * 768, 1024, 1440, 1920) — une largeur par préréglage, pour qu'un test puisse
 * itérer `DEVICE_PRESETS` et vérifier chacune sans dupliquer la liste.
 */

export type DeviceCategory = "mobile" | "tablet" | "desktop";

export interface DevicePreset {
  id: string;
  label: string;
  category: DeviceCategory;
  width: number;
  height: number;
}

export const DEVICE_PRESETS: readonly DevicePreset[] = [
  { id: "mobile-320", label: "Petit mobile", category: "mobile", width: 320, height: 568 },
  { id: "mobile-375", label: "Mobile standard", category: "mobile", width: 375, height: 667 },
  { id: "mobile-390", label: "Grand mobile", category: "mobile", width: 390, height: 844 },
  { id: "tablet-768", label: "Tablette (portrait)", category: "tablet", width: 768, height: 1024 },
  { id: "tablet-1024", label: "Tablette (paysage)", category: "tablet", width: 1024, height: 768 },
  { id: "desktop-1440", label: "Ordinateur portable", category: "desktop", width: 1440, height: 900 },
  { id: "desktop-1920", label: "Ordinateur (large)", category: "desktop", width: 1920, height: 1080 },
];

export const CUSTOM_DEVICE_ID = "custom" as const;

export function findDevicePreset(id: string): DevicePreset | undefined {
  return DEVICE_PRESETS.find((preset) => preset.id === id);
}

export interface Dimensions {
  width: number;
  height: number;
}

export const MIN_DIMENSION_PX = 200;
export const MAX_DIMENSION_PX = 3840;

/** Ramène une dimension personnalisée à une plage raisonnable — évite un iframe de
 *  largeur 0 (division par zéro dans le zoom) ou absurdement grand (fige l'onglet). */
export function clampDimension(value: number): number {
  if (!Number.isFinite(value)) return MIN_DIMENSION_PX;
  return Math.min(MAX_DIMENSION_PX, Math.max(MIN_DIMENSION_PX, Math.round(value)));
}

/** Bascule portrait/paysage — permute largeur et hauteur, quelle que soit leur
 *  origine (préréglage ou dimensions personnalisées). */
export function rotateDimensions({ width, height }: Dimensions): Dimensions {
  return { width: height, height: width };
}

/**
 * Dérive le palier d'espacement (`SectionSpacingOverride`, voir @yamacommerce/templates)
 * à partir d'une largeur RÉELLE — utilise EXACTEMENT les mêmes seuils que les règles
 * `@media` générées par `spacingOverrideToMediaCss` (lib/editor/section-style.ts :
 * 640px, 1024px), pour que l'onglet Espacement affiche toujours le palier qui
 * s'applique VRAIMENT à la largeur actuellement affichée dans l'aperçu — jamais la
 * catégorie cosmétique d'un préréglage (ex. un appareil large de 1024px déclenche déjà
 * la règle "desktop", même s'il est étiqueté "tablette paysage").
 */
export type SpacingBreakpoint = "mobile" | "tablet" | "desktop";

export function spacingBreakpointForWidth(width: number): SpacingBreakpoint {
  if (width >= 1024) return "desktop";
  if (width >= 640) return "tablet";
  return "mobile";
}

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 1.5;

export function clampZoom(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}
