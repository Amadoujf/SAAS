import { describe, expect, it, vi } from "vitest";
import { InMemoryRateLimiter, RedisRateLimiter, type RateLimiter } from "./rate-limit";

describe("InMemoryRateLimiter", () => {
  it("autorise jusqu'à la limite, puis refuse", async () => {
    const limiter = new InMemoryRateLimiter();
    const first = await limiter.consume("verify:domain-1", 2, 60_000);
    const second = await limiter.consume("verify:domain-1", 2, 60_000);
    const third = await limiter.consume("verify:domain-1", 2, 60_000);
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterMs).toBeGreaterThan(0);
  });

  it("des clés différentes ont des fenêtres indépendantes", async () => {
    const limiter = new InMemoryRateLimiter();
    await limiter.consume("verify:domain-1", 1, 60_000);
    const other = await limiter.consume("verify:domain-2", 1, 60_000);
    expect(other.allowed).toBe(true);
  });

  it("réautorise une fois la fenêtre expirée", async () => {
    vi.useFakeTimers();
    const limiter = new InMemoryRateLimiter();
    await limiter.consume("verify:domain-1", 1, 1000);
    const blocked = await limiter.consume("verify:domain-1", 1, 1000);
    expect(blocked.allowed).toBe(false);
    vi.advanceTimersByTime(1100);
    const allowedAgain = await limiter.consume("verify:domain-1", 1, 1000);
    expect(allowedAgain.allowed).toBe(true);
    vi.useRealTimers();
  });
});

/** Faux client Redis — implémente `incr`/`pexpire`/`pttl` avec la même sémantique
 *  que `ioredis`, sans jamais se connecter à un vrai serveur. */
function fakeRedis() {
  const store = new Map<string, { value: number; expiresAt: number | null }>();
  return {
    async incr(key: string) {
      const now = Date.now();
      const existing = store.get(key);
      if (!existing || (existing.expiresAt !== null && existing.expiresAt <= now)) {
        store.set(key, { value: 1, expiresAt: null });
        return 1;
      }
      existing.value += 1;
      return existing.value;
    },
    async pexpire(key: string, ms: number) {
      const entry = store.get(key);
      if (entry) entry.expiresAt = Date.now() + ms;
      return 1;
    },
    async pttl(key: string) {
      const entry = store.get(key);
      if (!entry?.expiresAt) return -1;
      return Math.max(entry.expiresAt - Date.now(), 0);
    },
  };
}

describe("RedisRateLimiter", () => {
  it("autorise jusqu'à la limite, puis refuse avec un retryAfterMs positif", async () => {
    const redis = fakeRedis();
    const limiter: RateLimiter = new RedisRateLimiter(redis as never);

    const first = await limiter.consume("verify:domain-1", 2, 60_000);
    const second = await limiter.consume("verify:domain-1", 2, 60_000);
    const third = await limiter.consume("verify:domain-1", 2, 60_000);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterMs).toBeGreaterThan(0);
  });
});
