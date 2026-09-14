/**
 * Détection de type de fichier par SIGNATURE RÉELLE (octets magiques), jamais par
 * extension ni par le `Content-Type` déclaré par le navigateur — voir docs/12 §12.2,
 * « médiathèque R2 » (21 septembre 2026), « Ne fais jamais confiance uniquement à
 * l'extension ou au Content-Type envoyé par le navigateur. ».
 *
 * Module PUR (aucune dépendance de décodage d'image complète — pas de `sharp` ici,
 * volontairement : ce fichier ne fait QUE lire des octets d'en-tête, jamais décoder de
 * pixels) — entièrement testable avec de petits buffers construits à la main.
 */

export type AcceptedMediaType = "jpeg" | "png" | "webp" | "avif" | "pdf" | "mp4";

export interface DetectedSignature {
  type: AcceptedMediaType;
  mimeType: string;
}

const MIME_BY_TYPE: Record<AcceptedMediaType, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  pdf: "application/pdf",
  mp4: "video/mp4",
};

function bytesMatch(buffer: Uint8Array, offset: number, expected: number[]): boolean {
  if (buffer.length < offset + expected.length) return false;
  for (let i = 0; i < expected.length; i++) {
    if (buffer[offset + i] !== expected[i]) return false;
  }
  return true;
}

function asciiAt(buffer: Uint8Array, offset: number, length: number): string {
  if (buffer.length < offset + length) return "";
  let out = "";
  for (let i = 0; i < length; i++) out += String.fromCharCode(buffer[offset + i]!);
  return out;
}

/** Boîtes ISO-BMFF (MP4/AVIF partagent le même conteneur) : lit le "major brand" et
 *  les "compatible brands" de la première boîte `ftyp`. */
function readIsoBmffBrands(buffer: Uint8Array): string[] | null {
  if (buffer.length < 12) return null;
  if (asciiAt(buffer, 4, 4) !== "ftyp") return null;
  const boxSize = new DataView(buffer.buffer, buffer.byteOffset, buffer.length).getUint32(0, false);
  const majorBrand = asciiAt(buffer, 8, 4);
  const brands = [majorBrand];
  // Marques compatibles : 4 octets chacune, à partir de l'offset 16, jusqu'à la fin
  // de la boîte (ou de ce qu'on a lu) — voir ISO/IEC 14496-12.
  const end = Math.min(boxSize || buffer.length, buffer.length);
  for (let offset = 16; offset + 4 <= end; offset += 4) {
    brands.push(asciiAt(buffer, offset, 4));
  }
  return brands;
}

const MP4_BRANDS = new Set([
  "isom",
  "iso2",
  "iso4",
  "iso5",
  "iso6",
  "mp41",
  "mp42",
  "avc1",
  "M4V ",
  "M4A ",
  "dash",
  "3gp5",
  "3g2a",
]);

const AVIF_BRANDS = new Set(["avif", "avis"]);

/**
 * Détecte le type RÉEL d'un fichier à partir de ses premiers octets — retourne `null`
 * si aucune signature connue ne correspond (jamais une devinette optimiste : un fichier
 * non reconnu doit être REFUSÉ par l'appelant, pas accepté "par défaut").
 */
export function detectFileSignature(buffer: Uint8Array): DetectedSignature | null {
  if (bytesMatch(buffer, 0, [0xff, 0xd8, 0xff])) {
    return { type: "jpeg", mimeType: MIME_BY_TYPE.jpeg };
  }

  if (bytesMatch(buffer, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { type: "png", mimeType: MIME_BY_TYPE.png };
  }

  if (asciiAt(buffer, 0, 4) === "RIFF" && asciiAt(buffer, 8, 4) === "WEBP") {
    return { type: "webp", mimeType: MIME_BY_TYPE.webp };
  }

  if (asciiAt(buffer, 0, 5) === "%PDF-") {
    return { type: "pdf", mimeType: MIME_BY_TYPE.pdf };
  }

  const brands = readIsoBmffBrands(buffer);
  if (brands) {
    if (brands.some((brand) => AVIF_BRANDS.has(brand))) {
      return { type: "avif", mimeType: MIME_BY_TYPE.avif };
    }
    if (brands.some((brand) => MP4_BRANDS.has(brand))) {
      return { type: "mp4", mimeType: MIME_BY_TYPE.mp4 };
    }
  }

  return null;
}

/** Types acceptés au lancement — voir la consigne « Désactive SVG au lancement, sauf
 *  si une procédure robuste d'assainissement est mise en place. » : aucun
 *  assainissement SVG n'est implémenté ici, SVG n'apparaît donc jamais dans cette
 *  liste, volontairement — ni comme signature détectée, ni comme type accepté. */
export const ACCEPTED_MEDIA_TYPES: readonly AcceptedMediaType[] = [
  "jpeg",
  "png",
  "webp",
  "avif",
  "pdf",
  "mp4",
];
