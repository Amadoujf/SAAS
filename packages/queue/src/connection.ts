import IORedis from "ioredis";

const globalForRedis = globalThis as unknown as { redisConnection?: IORedis };

/**
 * Connexion Redis partagée pour toutes les files BullMQ. `maxRetriesPerRequest: null`
 * est requis par BullMQ (voir sa documentation) pour laisser les workers gérer eux-mêmes
 * les tentatives de reconnexion sans faire échouer les jobs en cours.
 */
export const redisConnection =
  globalForRedis.redisConnection ??
  new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redisConnection = redisConnection;
}
