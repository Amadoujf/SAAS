import "server-only";
import type { Prisma } from "@yamacommerce/database";

/**
 * Ce qui est EN LIGNE comme page d'accueil — affiché dans « Mon site » pour qu'il n'y
 * ait qu'un parcours : l'accueil standard (réglé dans « Mon site ») tant que rien n'a
 * été publié depuis l'éditeur, puis la page composée dans l'éditeur.
 */
export type HomeStatus =
  | { mode: "standard"; editorStarted: false }
  | { mode: "standard"; editorStarted: true; draftUpdatedAt: Date | null }
  | { mode: "editor"; versionNumber: number | null; publishedAt: Date | null; pendingChanges: boolean };

export async function getHomeStatus(tx: Prisma.TransactionClient, tenantId: string): Promise<HomeStatus> {
  const site = await tx.tenantSite.findUnique({ where: { tenantId }, select: { id: true, isPublished: true, publishedAt: true } });
  if (!site) return { mode: "standard", editorStarted: false };
  const [published, draft] = await Promise.all([
    tx.tenantSiteVersion.findFirst({ where: { tenantSiteId: site.id, status: "published" }, orderBy: { publishedAt: "desc" }, select: { versionNumber: true, publishedAt: true, pages: { select: { slug: true, blocks: true } } } }),
    tx.tenantSiteVersion.findFirst({ where: { tenantSiteId: site.id, status: "draft" }, orderBy: { createdAt: "desc" }, select: { pages: { select: { slug: true, blocks: true, updatedAt: true } } } }),
  ]);
  const draftUpdatedAt = draft?.pages.reduce<Date | null>((latest, p) => (!latest || p.updatedAt > latest ? p.updatedAt : latest), null) ?? null;
  if (!site.isPublished || !published) return { mode: "standard", editorStarted: true, draftUpdatedAt };
  return {
    mode: "editor",
    versionNumber: published.versionNumber,
    publishedAt: published.publishedAt ?? site.publishedAt,
    // Comparaison du CONTENU (pas des dates) : un brouillon réenregistré à l'identique
    // n'est pas une modification en attente.
    pendingChanges: Boolean(draft) && pagesSignature(draft!.pages) !== pagesSignature(published.pages),
  };
}

function pagesSignature(pages: { slug: string; blocks: unknown }[]): string {
  return JSON.stringify([...pages].sort((a, b) => a.slug.localeCompare(b.slug)).map((p) => [p.slug, p.blocks]));
}
