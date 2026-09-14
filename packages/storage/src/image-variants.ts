import sharp from "sharp";

/**
 * Génération des variantes d'image — voir docs/12 §12.2, « médiathèque R2 » (21
 * septembre 2026), section TRAITEMENT DES IMAGES. Seul fichier de ce package qui
 * décode/encode réellement des pixels (voir `sharp`, un binaire précompilé — vérifié
 * disponible dans cet environnement) : tout le reste du package (validation,
 * dimensions, isolation) reste volontairement sans dépendance de décodage lourde.
 *
 * « Créer des formats WebP ou AVIF lorsque cela améliore réellement le poids » :
 * chaque palier essaie le format D'ORIGINE (JPEG/PNG), WebP ET AVIF, et ne CONSERVE
 * que le plus léger des trois — jamais un format "à la mode" imposé si le gain n'est
 * pas réel (voir `smallestEncoding`).
 */

export interface ImageVariantSpec {
  key: "thumbnail" | "small" | "medium" | "large";
  maxWidth: number;
}

/** Ne s'applique qu'aux images RASTER (jpeg/png/webp/avif) — jamais aux vidéos/PDF. */
export const IMAGE_VARIANT_SPECS: readonly ImageVariantSpec[] = [
  { key: "thumbnail", maxWidth: 200 },
  { key: "small", maxWidth: 480 },
  { key: "medium", maxWidth: 960 },
  { key: "large", maxWidth: 1920 },
];

export type EncodedFormat = "jpeg" | "png" | "webp" | "avif";

export interface GeneratedVariant {
  /** Une des clés de `IMAGE_VARIANT_SPECS`, ou "original" pour l'original optimisé
   *  (voir « Conserver l'original privé et servir les variantes publiées par CDN »). */
  key: string;
  format: EncodedFormat;
  width: number;
  height: number;
  bytes: Uint8Array;
  sizeBytes: number;
}

async function encodeAt(
  image: sharp.Sharp,
  format: EncodedFormat,
): Promise<{ bytes: Buffer; width: number; height: number }> {
  const pipeline =
    format === "jpeg"
      ? image.jpeg({ quality: 82, mozjpeg: true })
      : format === "png"
        ? image.png({ compressionLevel: 9 })
        : format === "webp"
          ? image.webp({ quality: 80 })
          : image.avif({ quality: 55 });
  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  return { bytes: data, width: info.width, height: info.height };
}

/** Encode la même image redimensionnée dans les 3 formats candidats et retourne le
 *  PLUS LÉGER — voir la documentation de tête de fichier. `sourceFormat` (jpeg/png)
 *  est toujours candidat ; WebP et AVIF le sont EN PLUS, jamais à la place. */
async function smallestEncoding(
  resized: sharp.Sharp,
  sourceFormat: "jpeg" | "png",
): Promise<{ format: EncodedFormat; bytes: Buffer; width: number; height: number }> {
  const candidates = await Promise.all([
    encodeAt(resized.clone(), sourceFormat),
    encodeAt(resized.clone(), "webp"),
    encodeAt(resized.clone(), "avif"),
  ]);
  const formats: EncodedFormat[] = [sourceFormat, "webp", "avif"];
  let bestIndex = 0;
  for (let i = 1; i < candidates.length; i++) {
    if (candidates[i]!.bytes.length < candidates[bestIndex]!.bytes.length) bestIndex = i;
  }
  return { format: formats[bestIndex]!, ...candidates[bestIndex]! };
}

export interface GenerateImageVariantsInput {
  buffer: Uint8Array;
  /** PNG a un canal alpha significatif (transparence) : le forcer en JPEG perdrait
   *  cette transparence, donc le format "d'origine" candidat reste PNG pour lui —
   *  jamais de conversion PNG -> JPEG imposée ici. AVIF est traité comme une source
   *  de type "photo" (candidat JPEG) : il n'y a pas de réel besoin de le
   *  redécoder→réencoder en AVIF pour comparaison avec lui-même à qualité identique,
   *  mais sharp le supporte nativement en entrée quel que soit le format cible. */
  sourceType: "jpeg" | "png" | "webp" | "avif";
}

function baseFormatFor(sourceType: GenerateImageVariantsInput["sourceType"]): "jpeg" | "png" {
  return sourceType === "png" ? "png" : "jpeg";
}

/**
 * Génère miniature/petite/moyenne/grande + original optimisé — voir « Génère
 * automatiquement ». Ne génère JAMAIS une variante plus grande que l'original (pas
 * d'agrandissement, voir `withoutEnlargement`) ; si l'original est déjà plus petit
 * qu'un palier, ce palier est simplement omis (pas de doublon avec un palier plus
 * grand déjà identique).
 */
export async function generateImageVariants(
  input: GenerateImageVariantsInput,
): Promise<GeneratedVariant[]> {
  const source = sharp(Buffer.from(input.buffer));
  const metadata = await source.metadata();
  const sourceWidth = metadata.width ?? 0;
  const baseFormat = baseFormatFor(input.sourceType);
  const variants: GeneratedVariant[] = [];

  for (const spec of IMAGE_VARIANT_SPECS) {
    if (sourceWidth > 0 && spec.maxWidth >= sourceWidth) continue; // pas d'agrandissement
    const resized = source.clone().resize({ width: spec.maxWidth, withoutEnlargement: true });
    const result = await smallestEncoding(resized, baseFormat);
    variants.push({
      key: spec.key,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      sizeBytes: result.bytes.length,
    });
  }

  // Original optimisé (voir « Conserver l'original privé... ») : même dimensions,
  // ré-encodé pour un poids minimal — jamais redimensionné.
  const optimizedOriginal = await smallestEncoding(source.clone(), baseFormat);
  variants.push({
    key: "original",
    format: optimizedOriginal.format,
    width: optimizedOriginal.width,
    height: optimizedOriginal.height,
    bytes: optimizedOriginal.bytes,
    sizeBytes: optimizedOriginal.bytes.length,
  });

  return variants;
}
