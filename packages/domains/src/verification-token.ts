import { randomBytes } from "node:crypto";

/**
 * Jeton de vérification de propriété — voir docs/13, « VÉRIFICATION DE PROPRIÉTÉ » :
 * « La propriété ne doit jamais être confirmée uniquement parce que le domaine
 * pointe vers l'application. » « Exiger un jeton TXT unique ». Le jeton lui-même est
 * juste une CHAÎNE ALÉATOIRE : son lien au tenant+domaine, son expiration et son
 * caractère à usage unique sont portés par les colonnes `Domain.verificationToken`/
 * `verificationTokenExpiresAt` (voir @yamacommerce/database) — pas par le jeton lui-même.
 */
export const VERIFICATION_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours.
const TOKEN_PREFIX = "yamacommerce-verify-";

export function generateVerificationToken(): string {
  return `${TOKEN_PREFIX}${randomBytes(20).toString("hex")}`;
}

export function computeVerificationTokenExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + VERIFICATION_TOKEN_TTL_MS);
}

export function isVerificationTokenExpired(expiresAt: Date | null, now: Date = new Date()): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() <= now.getTime();
}
