import "server-only";
import type { Prisma } from "@yamacommerce/database";
import type { PublishReadinessInput, DraftPageInput } from "@yamacommerce/publishing";
import { extractMediaUrlsFromPages, type PageForMediaScan } from "@/lib/editor/media-references";
import { extractMediaAssetIdFromUrl } from "./media-url-ref";
import type { MediaRepository } from "@/lib/media/media-repository";

/**
 * Construit l'instantané `PublishReadinessInput` (voir @yamacommerce/publishing
 * `readiness.ts`) à partir de l'état RÉEL d'un tenant — le module pur ne connaît ni
 * Prisma ni la médiathèque, cette fonction fait exactement la jointure inverse : lire
 * l'état, jamais valider (la validation reste `checkPublishReadiness`).
 *
 * `mediaRepository.get()` ouvre sa PROPRE transaction (voir `PrismaMediaRepository`,
 * une `withTenant` par appel) — volontairement PAS dans la même transaction que la
 * lecture tenant/abonnement/domaine ci-dessous. Un léger risque de changement d'état
 * entre cette lecture et la publication elle-même est accepté (comme pour toute
 * validation de préparation) : `publishVersion` reste le dernier verrou dur (pages non
 * vides, sections valides), pas le seul, et ne JAMAIS démarquer un média déjà public
 * (voir "conserver les médias utilisés par une ancienne version") rend une éventuelle
 * incohérence sans conséquence visible pour le visiteur.
 */
export interface ReadinessResolverDeps {
  mediaRepository: MediaRepository;
}

/** Une page du brouillon telle que lue en base (`Page`, voir
 *  @yamacommerce/database) — sur-ensemble de `PageForMediaScan`, qui ne connaît pas
 *  `isHome` (pas nécessaire pour scanner les médias, mais requis par
 *  `checkPublishReadiness` pour la règle "page d'accueil obligatoire"). */
export interface DraftPageForPublish extends PageForMediaScan {
  isHome: boolean;
}

export async function buildPublishReadinessInput(
  tx: Prisma.TransactionClient,
  tenantId: string,
  tenantSiteId: string,
  draftPages: DraftPageForPublish[],
  deps: ReadinessResolverDeps,
): Promise<PublishReadinessInput> {
  const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  const subscription = await tx.subscription.findUnique({ where: { tenantId } });
  const tenantSite = await tx.tenantSite.findUniqueOrThrow({
    where: { id: tenantSiteId },
    include: { template: true },
  });
  const activeVerifiedDomain = await tx.domain.findFirst({
    where: { tenantId, lifecycleStatus: "ACTIVE" },
  });

  const mediaUrlRefs = extractMediaUrlsFromPages(draftPages);
  const mediaReferences: PublishReadinessInput["mediaReferences"] = [];
  for (const ref of mediaUrlRefs) {
    const assetId = extractMediaAssetIdFromUrl(ref.url);
    if (!assetId) continue; // média externe : rien à vérifier de plus (voir readiness.ts).
    const asset = await deps.mediaRepository.get(tenantId, assetId);
    if (!asset) continue; // référence orpheline (média supprimé définitivement) : idem.
    mediaReferences.push({
      url: ref.url,
      pageSlug: ref.pageSlug,
      sectionId: ref.sectionId,
      status: asset.status,
      isSensitiveDocument: asset.type === "DOCUMENT" && !asset.isPublic,
    });
  }

  const draftPageInputs: DraftPageInput[] = draftPages.map((page) => ({
    slug: page.slug,
    title: page.title,
    isHome: page.isHome,
    blocks: page.blocks,
  }));

  return {
    tenantStatus: tenant.status,
    subscriptionStatus: subscription?.status ?? null,
    templateStatus: tenantSite.template.status as "draft" | "published" | "archived",
    hasActiveVerifiedDomain: activeVerifiedDomain !== null,
    requestedDomainOwnerTenantId: null,
    currentTenantId: tenantId,
    isPublicationAlreadyInProgress: false,
    draftPages: draftPageInputs,
    mediaReferences,
  };
}
