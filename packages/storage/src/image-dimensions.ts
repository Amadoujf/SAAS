/**
 * Lecture des dimensions RÉELLES d'une image directement depuis ses en-têtes binaires
 * — voir docs/12 §12.2, « médiathèque R2 » (21 septembre 2026), « Dimensions »,
 * « Images décompressées anormalement grandes ». Module PUR, sans dépendance de
 * décodage complet (pas de `sharp` ici) : c'est ce qui permet de détecter une bombe de
 * décompression AVANT de décoder le moindre pixel — un fichier de quelques kilooctets
 * annonçant des dimensions de plusieurs centaines de millions de pixels est rejeté ICI,
 * jamais après une tentative de décodage coûteuse.
 *
 * Limite assumée (voir le rapport de livraison) : le format WebP n'est reconnu ici que
 * pour le sous-format `VP8X` (conteneur étendu, dimensions explicites) — les
 * dimensions d'un WebP `VP8`/`VP8L` simple ne sont pas extraites (retourne `null`,
 * jamais une valeur devinée). AVIF n'est pas couvert du tout (la boîte `ispe`
 * pertinente est imbriquée dans une structure `meta`/`iprp` bien plus complexe qu'un
 * simple en-tête) : la vérification de bombe de décompression ne s'applique donc pas
 * aux AVIF/WebP non-VP8X, uniquement aux autres contrôles (signature, taille de
 * fichier, MIME). Un futur remplacement par une vraie bibliothèque de décodage
 * (`sharp`) lèverait cette limite sans changer le contrat de cette fonction.
 */

export interface ImageDimensions {
  width: number;
  height: number;
}

function readUint32BE(buffer: Uint8Array, offset: number): number {
  return new DataView(buffer.buffer, buffer.byteOffset, buffer.length).getUint32(offset, false);
}

function readUint16BE(buffer: Uint8Array, offset: number): number {
  return new DataView(buffer.buffer, buffer.byteOffset, buffer.length).getUint16(offset, false);
}

function readPngDimensions(buffer: Uint8Array): ImageDimensions | null {
  // Signature (8) + longueur de chunk (4) + type "IHDR" (4) + largeur (4) + hauteur (4).
  if (buffer.length < 24) return null;
  return { width: readUint32BE(buffer, 16), height: readUint32BE(buffer, 20) };
}

/** Parcourt les segments JPEG (marqueurs `FF xx`) à la recherche d'un SOF
 *  (Start Of Frame) — les seuls segments qui portent les dimensions réelles de
 *  l'image. Les marqueurs SOF valides couvrent JPEG baseline ET progressif. */
function readJpegDimensions(buffer: Uint8Array): ImageDimensions | null {
  const SOF_MARKERS = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ]);
  let offset = 2; // après le marqueur SOI (FF D8)
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1]!;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xd9) break; // EOI
    const segmentLength = readUint16BE(buffer, offset + 2);
    if (SOF_MARKERS.has(marker)) {
      // Structure du segment SOF : longueur(2) précision(1) hauteur(2) largeur(2) ...
      const height = readUint16BE(buffer, offset + 5);
      const width = readUint16BE(buffer, offset + 7);
      return { width, height };
    }
    offset += 2 + segmentLength;
  }
  return null;
}

/** Sous-format `VP8X` uniquement (voir la limite documentée en tête de fichier) :
 *  dimensions stockées en 24 bits (moins 1) à partir de l'octet 24. */
function readWebpDimensions(buffer: Uint8Array): ImageDimensions | null {
  if (buffer.length < 30) return null;
  const chunkType = String.fromCharCode(buffer[12]!, buffer[13]!, buffer[14]!, buffer[15]!);
  if (chunkType !== "VP8X") return null;
  const width = (buffer[24]! | (buffer[25]! << 8) | (buffer[26]! << 16)) + 1;
  const height = (buffer[27]! | (buffer[28]! << 8) | (buffer[29]! << 16)) + 1;
  return { width, height };
}

/** Extrait les dimensions d'une image à partir de son TYPE DÉJÀ DÉTECTÉ (voir
 *  `detectFileSignature`) — ne devine jamais le format à partir de l'extension ou du
 *  MIME déclaré. Retourne `null` si le format ne porte pas de dimensions exploitables
 *  ici (voir la limite assumée) — jamais une valeur inventée. */
export function readImageDimensions(
  buffer: Uint8Array,
  type: "jpeg" | "png" | "webp" | "avif",
): ImageDimensions | null {
  switch (type) {
    case "png":
      return readPngDimensions(buffer);
    case "jpeg":
      return readJpegDimensions(buffer);
    case "webp":
      return readWebpDimensions(buffer);
    case "avif":
      return null;
  }
}

/** Seuil de protection contre une bombe de décompression — voir docs/12 §12.2,
 *  « images décompressées anormalement grandes ». Au-delà de 64 mégapixels décodés
 *  (ex. une image 8192×8192), le risque de consommation mémoire excessive lors d'un
 *  futur traitement (génération de variantes) dépasse le bénéfice d'accepter le
 *  fichier — un visuel de site e-commerce n'a jamais besoin d'une telle résolution. */
export const MAX_DECODED_PIXELS = 64_000_000;

export function isDecompressionBomb(dimensions: ImageDimensions): boolean {
  return dimensions.width * dimensions.height > MAX_DECODED_PIXELS;
}
