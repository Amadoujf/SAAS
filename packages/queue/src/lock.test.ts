import { describe, expect, it, vi } from "vitest";
import {
  InMemoryDistributedLock,
  LockAcquisitionError,
  RedisDistributedLock,
  withLock,
  type DistributedLock,
} from "./lock";

describe("InMemoryDistributedLock", () => {
  it("acquiert un verrou libre et retourne un jeton", async () => {
    const lock = new InMemoryDistributedLock();
    const token = await lock.acquire("site:tenant-a", 5000);
    expect(token).toEqual(expect.any(String));
  });

  it("refuse une seconde acquisition tant que le verrou est détenu", async () => {
    const lock = new InMemoryDistributedLock();
    await lock.acquire("site:tenant-a", 5000);
    const second = await lock.acquire("site:tenant-a", 5000);
    expect(second).toBeNull();
  });

  it("permet une nouvelle acquisition après relâchement", async () => {
    const lock = new InMemoryDistributedLock();
    const token = await lock.acquire("site:tenant-a", 5000);
    await lock.release("site:tenant-a", token!);
    const second = await lock.acquire("site:tenant-a", 5000);
    expect(second).not.toBeNull();
  });

  it("permet une nouvelle acquisition après expiration du TTL, sans relâchement explicite", async () => {
    vi.useFakeTimers();
    const lock = new InMemoryDistributedLock();
    await lock.acquire("site:tenant-a", 100);
    vi.advanceTimersByTime(150);
    const second = await lock.acquire("site:tenant-a", 100);
    expect(second).not.toBeNull();
    vi.useRealTimers();
  });

  it("refuse de relâcher avec un jeton qui ne correspond pas au détenteur actuel", async () => {
    const lock = new InMemoryDistributedLock();
    await lock.acquire("site:tenant-a", 5000);
    const released = await lock.release("site:tenant-a", "un-faux-jeton");
    expect(released).toBe(false);
  });

  it("des clés différentes (des tenants différents) ne s'influencent jamais l'une l'autre", async () => {
    const lock = new InMemoryDistributedLock();
    await lock.acquire("site:tenant-a", 5000);
    const other = await lock.acquire("site:tenant-b", 5000);
    expect(other).not.toBeNull();
  });

  it("isLocked : reflète l'état sans effet de bord (n'acquiert ni ne relâche rien)", async () => {
    const lock = new InMemoryDistributedLock();
    expect(await lock.isLocked("site:tenant-a")).toBe(false);
    const token = await lock.acquire("site:tenant-a", 5000);
    expect(await lock.isLocked("site:tenant-a")).toBe(true);
    // Appeler isLocked() ne consomme pas le verrou : une acquisition reste refusée.
    expect(await lock.isLocked("site:tenant-a")).toBe(true);
    await lock.release("site:tenant-a", token!);
    expect(await lock.isLocked("site:tenant-a")).toBe(false);
  });

  it("isLocked : redevient faux après expiration du TTL", async () => {
    vi.useFakeTimers();
    const lock = new InMemoryDistributedLock();
    await lock.acquire("site:tenant-a", 100);
    expect(await lock.isLocked("site:tenant-a")).toBe(true);
    vi.advanceTimersByTime(150);
    expect(await lock.isLocked("site:tenant-a")).toBe(false);
    vi.useRealTimers();
  });
});

describe("withLock", () => {
  it("exécute la fonction sous verrou puis relâche automatiquement", async () => {
    const lock = new InMemoryDistributedLock();
    const result = await withLock(lock, "site:tenant-a", 5000, async () => "ok");
    expect(result).toBe("ok");
    // Le verrou doit être libre après coup.
    const token = await lock.acquire("site:tenant-a", 5000);
    expect(token).not.toBeNull();
  });

  it("PUBLICATION DÉJÀ EN COURS : lève LockAcquisitionError si le verrou est déjà détenu", async () => {
    const lock = new InMemoryDistributedLock();
    await lock.acquire("site:tenant-a", 5000);
    await expect(withLock(lock, "site:tenant-a", 5000, async () => "jamais atteint")).rejects.toThrow(
      LockAcquisitionError,
    );
  });

  it("DEUX PUBLICATIONS CONCURRENTES : une seule des deux réussit, l'autre est rejetée immédiatement", async () => {
    const lock = new InMemoryDistributedLock();
    const results = await Promise.allSettled([
      withLock(lock, "site:tenant-a", 5000, async () => "premier"),
      withLock(lock, "site:tenant-a", 5000, async () => "second"),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(LockAcquisitionError);
  });

  it("relâche le verrou même si la fonction protégée lève une exception", async () => {
    const lock = new InMemoryDistributedLock();
    await expect(
      withLock(lock, "site:tenant-a", 5000, async () => {
        throw new Error("échec métier");
      }),
    ).rejects.toThrow("échec métier");

    const token = await lock.acquire("site:tenant-a", 5000);
    expect(token).not.toBeNull();
  });
});

/** Faux client Redis minimal — implémente uniquement `set`/`eval` avec la même
 *  sémantique que `ioredis` pour les usages de `RedisDistributedLock`, sans jamais se
 *  connecter à un vrai serveur (aucun Redis local requis pour ce test). */
function fakeRedis() {
  const store = new Map<string, string>();
  return {
    async set(key: string, value: string, mode: "PX", ttlMs: number, flag: "NX") {
      if (mode !== "PX" || flag !== "NX") throw new Error("mode inattendu");
      if (store.has(key)) return null;
      store.set(key, value);
      return "OK";
    },
    async eval(_script: string, _numKeys: number, key: string, token: string) {
      if (store.get(key) === token) {
        store.delete(key);
        return 1;
      }
      return 0;
    },
    async get(key: string) {
      return store.get(key) ?? null;
    },
  };
}

describe("RedisDistributedLock", () => {
  it("acquiert via SET NX PX et relâche via un script comparant le jeton", async () => {
    const redis = fakeRedis();
    const lock: DistributedLock = new RedisDistributedLock(redis as never);

    const token = await lock.acquire("site:tenant-a", 5000);
    expect(token).toEqual(expect.any(String));

    const second = await lock.acquire("site:tenant-a", 5000);
    expect(second).toBeNull();

    const released = await lock.release("site:tenant-a", token!);
    expect(released).toBe(true);

    const third = await lock.acquire("site:tenant-a", 5000);
    expect(third).not.toBeNull();
  });

  it("ne relâche jamais le verrou d'un AUTRE détenteur (jeton différent)", async () => {
    const redis = fakeRedis();
    const lock: DistributedLock = new RedisDistributedLock(redis as never);
    await lock.acquire("site:tenant-a", 5000);
    const released = await lock.release("site:tenant-a", "jeton-usurpe");
    expect(released).toBe(false);
  });

  it("isLocked : lit l'état via GET, sans jamais acquérir ni relâcher", async () => {
    const redis = fakeRedis();
    const lock: DistributedLock = new RedisDistributedLock(redis as never);
    expect(await lock.isLocked("site:tenant-a")).toBe(false);
    const token = await lock.acquire("site:tenant-a", 5000);
    expect(await lock.isLocked("site:tenant-a")).toBe(true);
    await lock.release("site:tenant-a", token!);
    expect(await lock.isLocked("site:tenant-a")).toBe(false);
  });
});
