import bcrypt from "bcryptjs";

// bcryptjs est une implémentation pure JS (aucune compilation native requise), ce qui
// garantit une installation fiable sur toutes les plateformes de développement.
// Piste d'évolution (Phase 4 — durcissement sécurité) : migrer vers Argon2id
// (ex. @node-rs/argon2, binaires précompilés) pour un facteur de coût mémoire plus élevé.
const SALT_ROUNDS = 12;

export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export async function verifyPassword(plainPassword: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, hash);
}
