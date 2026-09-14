import { createHash } from "node:crypto";
import {
  ACCEPTED_MEDIA_TYPES,
  detectFileSignature,
  type AcceptedMediaType,
} from "./file-signatures";
import { isDecompressionBomb, readImageDimensions, type ImageDimensions } from "./image-dimensions";

/**
 * Validation d'un fichier importé — voir docs/12 §12.2, « médiathèque R2 » (21
 * septembre 2026), section SÉCURITÉ. Point d'entrée UNIQUE qui combine toutes les
 * vérifications demandées ; ORCHESTRE les modules purs de ce package (signature,
 * dimensions) sans jamais faire confiance à ce que le navigateur a déclaré
 * (`declaredMimeType`, l'extension du nom de fichier).
 *
 * Module PUR : reçoit un buffer déjà en mémoire (voir upload-pipeline.ts pour
 * l'orchestration réelle — téléchargement depuis le stockage, appel de cette
 * fonction, puis décision de conserver ou rejeter). Aucun accès disque/réseau ici,
 * ce qui le rend exhaustivement testable.
 */

export type FileValidationFailureReason =
  | "empty_file"
  | "incomplete_file"
  | "unrecognized_signature"
  | "mime_mismatch"
  | "extension_mismatch"
  | "double_extension"
  | "too_large"
  | "decompression_bomb"
  | "dangerous_content";

export interface FileValidationSuccess {
  success: true;
  type: AcceptedMediaType;
  mimeType: string;
  sizeBytes: number;
  dimensions: ImageDimensions | null;
  checksumSha256: string;
}

export interface FileValidationFailure {
  success: false;
  reason: FileValidationFailureReason;
  message: string;
}

export type FileValidationResult = FileValidationSuccess | FileValidationFailure;

const EXTENSIONS_BY_TYPE: Record<AcceptedMediaType, readonly string[]> = {
  jpeg: ["jpg", "jpeg"],
  png: ["png"],
  webp: ["webp"],
  avif: ["avif"],
  pdf: ["pdf"],
  mp4: ["mp4"],
};

/** Extensions associées à des formats exécutables/interprétés — jamais acceptables
 *  QUELLE QUE SOIT la signature réelle détectée (voir « double extension », un nom
 *  comme "facture.pdf.exe" doit être rejeté même si le contenu réel était un PDF
 *  inoffensif : le nom lui-même est trompeur pour tout système qui n'affiche que la
 *  dernière portion, ou pour un utilisateur qui télécharge le fichier ensuite). */
const DANGEROUS_EXTENSIONS = new Set([
  "exe", "bat", "cmd", "com", "scr", "msi", "dll", "js", "jse", "vbs", "vbe",
  "ps1", "psm1", "sh", "bash", "php", "php3", "php4", "php5", "phtml", "jsp",
  "jspx", "asp", "aspx", "cgi", "pl", "py", "jar", "app", "apk", "html", "htm",
]);

/** Motifs de contenu dangereux recherchés N'IMPORTE OÙ dans le fichier — une
 *  heuristique de bon sens (polyglotte fichier-image + code exécutable), PAS une
 *  substitution à un vrai moteur antivirus/CDR (voir le rapport de livraison pour
 *  cette limite assumée). */
const DANGEROUS_BYTE_PATTERNS: { label: string; bytes: number[] }[] = [
  { label: "PHP", bytes: [0x3c, 0x3f, 0x70, 0x68, 0x70] }, // "<?php"
  { label: "ASP/JSP", bytes: [0x3c, 0x25] }, // "<%"
  { label: "script HTML", bytes: [0x3c, 0x73, 0x63, 0x72, 0x69, 0x70, 0x74] }, // "<script"
  { label: "shebang", bytes: [0x23, 0x21, 0x2f] }, // "#!/"
  { label: "exécutable Windows (PE)", bytes: [0x4d, 0x5a, 0x90, 0x00] }, // "MZ\x90\x00"
  { label: "exécutable Linux (ELF)", bytes: [0x7f, 0x45, 0x4c, 0x46] }, // "\x7fELF"
];

/** Recherche naïve mais suffisante pour ces motifs COURTS (5-8 octets) sur des
 *  fichiers de quelques mégaoctets — une vraie recherche Boyer-Moore serait
 *  prématurée ici. */
function containsBytes(buffer: Uint8Array, needle: number[]): boolean {
  outer: for (let i = 0; i <= buffer.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (buffer[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

function fileExtension(fileName: string): string | null {
  const match = /\.([a-zA-Z0-9]+)$/.exec(fileName);
  return match ? match[1]!.toLowerCase() : null;
}

/** Toutes les portions séparées par un point, hors le nom "racine" (voir « double
 *  extension ») — ex. "facture.pdf.exe" -> ["pdf", "exe"]. */
function allExtensionSegments(fileName: string): string[] {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.slice(1).map((part) => part.toLowerCase()) : [];
}

export interface FileValidationInput {
  buffer: Uint8Array;
  declaredMimeType: string;
  originalFileName: string;
  /** Limite de taille APPLICABLE à ce fichier (déjà résolue par l'appelant selon la
   *  formule et le type — voir quota.ts) — cette fonction ne connaît aucune règle de
   *  formule elle-même, volontairement (sector/plan-agnostic). */
  maxSizeBytes: number;
}

/**
 * Valide un fichier de bout en bout. Retourne toujours un résultat structuré, ne lève
 * JAMAIS — un appelant (route d'import) doit pouvoir journaliser proprement un rejet
 * sans `try/catch` générique masquant la vraie cause.
 */
export function validateUploadedFile(input: FileValidationInput): FileValidationResult {
  const { buffer, declaredMimeType, originalFileName, maxSizeBytes } = input;

  if (buffer.length === 0) {
    return { success: false, reason: "empty_file", message: "Le fichier est vide." };
  }

  if (buffer.length > maxSizeBytes) {
    return {
      success: false,
      reason: "too_large",
      message: `Le fichier dépasse la taille maximale autorisée (${maxSizeBytes} octets).`,
    };
  }

  // Double extension : un nom trompeur est refusé indépendamment du contenu réel
  // (voir la documentation de DANGEROUS_EXTENSIONS ci-dessus).
  const extensionSegments = allExtensionSegments(originalFileName);
  if (extensionSegments.some((segment) => DANGEROUS_EXTENSIONS.has(segment))) {
    return {
      success: false,
      reason: "double_extension",
      message: `Nom de fichier suspect : extension dangereuse détectée dans "${originalFileName}".`,
    };
  }

  const signature = detectFileSignature(buffer);
  if (!signature) {
    return {
      success: false,
      reason: "unrecognized_signature",
      message:
        "Le contenu réel du fichier ne correspond à aucun type accepté " +
        `(${ACCEPTED_MEDIA_TYPES.join(", ")}).`,
    };
  }

  if (signature.mimeType !== declaredMimeType) {
    return {
      success: false,
      reason: "mime_mismatch",
      message: `Type MIME déclaré ("${declaredMimeType}") différent du contenu réel ("${signature.mimeType}").`,
    };
  }

  const declaredExtension = fileExtension(originalFileName);
  const expectedExtensions = EXTENSIONS_BY_TYPE[signature.type];
  if (!declaredExtension || !expectedExtensions.includes(declaredExtension)) {
    return {
      success: false,
      reason: "extension_mismatch",
      message: `L'extension du fichier ne correspond pas à son contenu réel (${signature.type}).`,
    };
  }

  for (const pattern of DANGEROUS_BYTE_PATTERNS) {
    if (containsBytes(buffer, pattern.bytes)) {
      return {
        success: false,
        reason: "dangerous_content",
        message: `Contenu potentiellement dangereux détecté (${pattern.label}).`,
      };
    }
  }

  if (signature.type === "pdf" && containsPdfActiveContent(buffer)) {
    return {
      success: false,
      reason: "dangerous_content",
      message: "Le PDF contient du JavaScript ou une action automatique intégrée.",
    };
  }

  let dimensions: ImageDimensions | null = null;
  if (signature.type === "jpeg" || signature.type === "png" || signature.type === "webp" || signature.type === "avif") {
    dimensions = readImageDimensions(buffer, signature.type);
    if (dimensions && isDecompressionBomb(dimensions)) {
      return {
        success: false,
        reason: "decompression_bomb",
        message: `Dimensions anormalement grandes une fois décompressées (${dimensions.width}×${dimensions.height}).`,
      };
    }
  }

  return {
    success: true,
    type: signature.type,
    mimeType: signature.mimeType,
    sizeBytes: buffer.length,
    dimensions,
    checksumSha256: createHash("sha256").update(buffer).digest("hex"),
  };
}

/** PDF spécifiquement : recherche des jetons `/JavaScript`, `/JS` ou `/OpenAction`
 *  (déclencheurs classiques de PDF malveillants) — une heuristique de plus, pas une
 *  analyse complète de l'arbre d'objets PDF. */
function containsPdfActiveContent(buffer: Uint8Array): boolean {
  const text = Buffer.from(buffer).toString("latin1");
  return /\/(JavaScript|JS|OpenAction|AA)\b/.test(text);
}
