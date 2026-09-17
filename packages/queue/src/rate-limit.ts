import type IORedis from "ioredis";

/**
 * Limitation de fréquence (rate limiting) — voir docs/13, « SÉCURITÉ » et « Prévoir
 * un bouton "Vérifier maintenant" limité en fréquence ». Même principe que
 * `DistributedLock` (voir lock.ts) : une interface + une implémentation RÉELLE
 * (Redis, fenêtre fixe via `INCR`+`EXPIRE`, correcte à travers plusieurs instances
 * serveur) + une implémentation EN MÉMOIRE (démonstration/tests).
 */
export interface RateLimitResult {
  allowed: boolean;
  /** Millisecondes avant la prochaine tentative autorisée — 0 si `allowed`. */
  retryAfterMs: number;
}

export interface RateLimiter {
  /** Fenêtre fixe : au plus `limit` appels autorisés par `key` toutes les
   *  `windowMs` millisecondes. */
  consume(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
}

export class RedisRateLimiter implements RateLimiter {
  constructor(private readonly redis: IORedis) {}

  async consume(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const redisKey = `yamacommerce:ratelimit:${key}`;
    const count = await this.redis.incr(redisKey);
    if (count === 1) {
      await this.redis.pexpire(redisKey, windowMs);
    }
    if (count <= limit) {
      return { allowed: true, retryAfterMs: 0 };
    }
    const ttl = await this.redis.pttl(redisKey);
    return { allowed: false, retryAfterMs: Math.max(ttl, 0) };
  }
}

interface InMemoryWindow {
  count: number;
  resetAt: number;
}

/** Voir la limite assumée de `InMemoryDistributedLock` (lock.ts) : correcte
 *  seulement au sein d'UN SEUL processus Node — jamais utilisée en production. */
export class InMemoryRateLimiter implements RateLimiter {
  private readonly windows = new Map<string, InMemoryWindow>();

  async consume(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    const existing = this.windows.get(key);
    if (!existing || existing.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, retryAfterMs: 0 };
    }
    existing.count += 1;
    if (existing.count <= limit) {
      return { allowed: true, retryAfterMs: 0 };
    }
    return { allowed: false, retryAfterMs: existing.resetAt - now };
  }
}
