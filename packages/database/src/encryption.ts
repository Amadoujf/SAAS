import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Chiffrement au repos des identifiants de compte marchand (PayDunya/PayTech/WhatsApp)
 * que chaque entreprise peut connecter — voir adjustement #4. Le texte en clair ne
 * transite jamais tel quel en base ni dans les journaux applicatifs.
 */
const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "ENCRYPTION_KEY manquant. Générez une clé avec `openssl rand -hex 32` (ou " +
        "`node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"`) " +
        "et renseignez-la dans .env.",
    );
  }
  // Clé hex de 64 caractères (32 octets) attendue en production ; à défaut, une clé est
  // dérivée d'un secret arbitraire pour rester utilisable en développement rapide.
  if (/^[0-9a-fA-F]{64}$/.test(secret)) {
    return Buffer.from(secret, "hex");
  }
  return scryptSync(secret, "yamacommerce-ai-encryption", 32);
}

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export function encryptSecret(plaintext: string): EncryptedPayload {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export function decryptSecret(payload: EncryptedPayload): string {
  const key = getKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

/**
 * Représentation sûre pour les journaux (jamais la valeur en clair) : n'affiche que les
 * bornes d'une chaîne, pour permettre de la reconnaître visuellement sans la reconstituer.
 */
export function redactForLog(plaintext: string): string {
  if (plaintext.length <= 8) return "****";
  return `${plaintext.slice(0, 4)}****${plaintext.slice(-4)}`;
}
