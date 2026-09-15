import "server-only";
import { RedisDistributedLock, redisConnection } from "@yamacommerce/queue";
import { PrismaMediaRepository } from "@/lib/media/prisma-media-repository";
import { invalidateSiteCache } from "./cache";
import type { PublishSiteDeps } from "./publish-pipeline";

/**
 * Dépendances RÉELLES du pipeline de publication (PostgreSQL + Redis + cache Next.js)
 * — voir « conserve exactement la même interface pour PostgreSQL, BullMQ et R2 » :
 * seul ce fichier change entre la démonstration (voir demo-publishing-context.ts,
 * `InMemoryDistributedLock` + `InMemoryMediaRepository`) et la production, jamais
 * `publish-pipeline.ts`/`schedule-pipeline.ts`/`restore-pipeline.ts` eux-mêmes.
 */
let cached: PublishSiteDeps | null = null;

export function realPublishSiteDeps(): PublishSiteDeps {
  if (!cached) {
    cached = {
      lock: new RedisDistributedLock(redisConnection),
      mediaRepository: new PrismaMediaRepository(),
      invalidateCache: invalidateSiteCache,
    };
  }
  return cached;
}
