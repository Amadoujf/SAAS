import { randomUUID } from "node:crypto";
import type IORedis from "ioredis";

/**
 * Verrou distribué — voir docs/12 §12.3, « publication définitive » (22 septembre
 * 2026), « SÉCURITÉ ET FIABILITÉ » : « verrou distribué », et la validation « Une
 * opération de publication est déjà en cours ». Empêche deux processus (deux workers,
 * ou un worker et une requête web) de publier LE MÊME site simultanément — un simple
 * verrou en mémoire de processus ne suffirait pas dès qu'il y a plus d'une instance
 * du serveur/worker (voir `apps/worker`, `WORKER_CONCURRENCY`).
 *
 * Interface générique + DEUX implémentations (même principe que `StorageProvider`,
 * voir @yamacommerce/storage) : `RedisDistributedLock` (réelle, `SET NX PX` +
 * relâchement sécurisé par script Lua comparant le jeton avant `DEL`, pour qu'un
 * verrou expiré puis repris par quelqu'un d'autre ne soit jamais relâché par erreur
 * par son ancien détenteur) et `InMemoryDistributedLock` (démonstration/tests, sans
 * Redis — TOUJOURS correcte pour un seul processus, ce qui est la limite assumée
 * documentée dans son propre fichier).
 */
export class LockAcquisitionError extends Error {
  constructor(public readonly key: string) {
    super(`Verrou déjà détenu pour "${key}" — une opération est déjà en cours.`);
    this.name = "LockAcquisitionError";
  }
}

export interface DistributedLock {
  /** Tente d'acquérir le verrou — retourne un jeton opaque si acquis, `null` sinon
   *  (jamais d'attente/retry ici : c'est à l'appelant de décider, voir `withLock`). */
  acquire(key: string, ttlMs: number): Promise<string | null>;
  /** Relâche le verrou UNIQUEMENT si `token` correspond toujours au détenteur actuel
   *  — retourne `false` (jamais une erreur) si le verrou a déjà expiré ou appartient
   *  à quelqu'un d'autre. */
  release(key: string, token: string): Promise<boolean>;
  /** Lecture SEULE, sans effet de bord — pour l'écran de prépublication qui doit
   *  afficher « une publication est déjà en cours » AVANT que l'utilisateur ne
   *  confirme, sans jamais acquérir/retenir le verrou juste pour vérifier son état. */
  isLocked(key: string): Promise<boolean>;
}

/** Exécute `fn` sous verrou — lève `LockAcquisitionError` immédiatement si le verrou
 *  est déjà détenu (jamais d'attente silencieuse : « une opération de publication est
 *  déjà en cours » doit être un rejet clair, pas un blocage invisible). Relâche
 *  TOUJOURS le verrou (succès, échec, ou exception) via `finally`. */
export async function withLock<T>(
  lock: DistributedLock,
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const token = await lock.acquire(key, ttlMs);
  if (!token) {
    throw new LockAcquisitionError(key);
  }
  try {
    return await fn();
  } finally {
    await lock.release(key, token);
  }
}

const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

export class RedisDistributedLock implements DistributedLock {
  constructor(private readonly redis: IORedis) {}

  async acquire(key: string, ttlMs: number): Promise<string | null> {
    const token = randomUUID();
    const result = await this.redis.set(lockKey(key), token, "PX", ttlMs, "NX");
    return result === "OK" ? token : null;
  }

  async release(key: string, token: string): Promise<boolean> {
    const result = await this.redis.eval(RELEASE_SCRIPT, 1, lockKey(key), token);
    return result === 1;
  }

  async isLocked(key: string): Promise<boolean> {
    const value = await this.redis.get(lockKey(key));
    return value !== null;
  }
}

function lockKey(key: string): string {
  return `yamacommerce:lock:${key}`;
}

interface InMemoryLockEntry {
  token: string;
  expiresAt: number;
}

/**
 * Implémentation en mémoire — voir la démonstration `/demo/publication` et les tests
 * unitaires du pipeline de publication, sans Redis. Limite assumée : correcte
 * seulement au sein d'UN SEUL processus Node (exactement comme
 * `InMemoryMediaRepository`, voir lib/media/in-memory-media-repository.ts côté
 * apps/web) — jamais utilisée en production, où `RedisDistributedLock` est
 * obligatoire dès qu'il y a plus d'une instance de serveur/worker.
 */
export class InMemoryDistributedLock implements DistributedLock {
  private readonly locks = new Map<string, InMemoryLockEntry>();

  async acquire(key: string, ttlMs: number): Promise<string | null> {
    const now = Date.now();
    const existing = this.locks.get(key);
    if (existing && existing.expiresAt > now) {
      return null;
    }
    const token = randomUUID();
    this.locks.set(key, { token, expiresAt: now + ttlMs });
    return token;
  }

  async release(key: string, token: string): Promise<boolean> {
    const existing = this.locks.get(key);
    if (!existing || existing.token !== token) return false;
    this.locks.delete(key);
    return true;
  }

  async isLocked(key: string): Promise<boolean> {
    const existing = this.locks.get(key);
    return existing !== undefined && existing.expiresAt > Date.now();
  }
}
