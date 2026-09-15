import "server-only";
import { restoreVersionIntoDraft, withTenant, writeAuditLog } from "@yamacommerce/database";
import { publishSite, type PublishSiteDeps, type PublishSiteResult } from "./publish-pipeline";

/**
 * Restauration — voir docs/12 §12.3, « VERSIONING » : « Une restauration doit créer
 * une nouvelle version. Elle ne doit jamais modifier l'ancienne. » et « SUPER ADMIN » :
 * « restaurer une version avec justification obligatoire ».
 *
 * Compose délibérément DEUX opérations déjà existantes plutôt que d'écrire une
 * nouvelle fonction de registre dédiée : `restoreVersionIntoDraft` (copie les pages
 * d'une ancienne version DANS le brouillon courant, sans y toucher elle-même) puis
 * `publishSite` (qui fige TOUJOURS une version NOUVELLE — jamais une modification en
 * place). La version archivée source n'est donc jamais écrite par ce chemin.
 */
export interface RestoreVersionForReviewInput {
  tenantId: string;
  tenantSiteId: string;
  sourceVersionId: string;
  actorUserId: string;
}

/** Charge une ancienne version DANS le brouillon courant, pour relecture/édition avant
 *  publication — ne publie rien. Correspond à "restauration" (par opposition à
 *  "nouvelle publication à partir d'une ancienne version", voir
 *  `restoreAndPublishVersion` ci-dessous). */
export async function restoreVersionForReview(input: RestoreVersionForReviewInput) {
  return withTenant(input.tenantId, async (tx) => {
    const draft = await restoreVersionIntoDraft(
      tx,
      input.tenantId,
      input.tenantSiteId,
      input.sourceVersionId,
    );
    await writeAuditLog(tx, {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      actorType: "owner",
      action: "site_version.restored_into_draft",
      entityType: "TenantSiteVersion",
      entityId: input.sourceVersionId,
    });
    return draft;
  });
}

export interface RestoreAndPublishInput {
  tenantId: string;
  tenantSiteId: string;
  sourceVersionId: string;
  actorUserId: string;
  publishMessage?: string;
  /** Vrai lorsque l'appelant est un Super Admin — voir la garde ci-dessous : dans ce
   *  cas UNIQUEMENT, `restoreJustification` devient obligatoire. Une restauration
   *  normale par le tenant lui-même n'exige aucune justification. */
  isSuperAdminAction: boolean;
  restoreJustification?: string;
}

/**
 * "Nouvelle publication à partir d'une ancienne version" — restaure PUIS publie
 * immédiatement dans la MÊME opération logique. Bloque avant tout effet de bord si un
 * Super Admin omet la justification obligatoire (voir docs/12 §12.3, « SUPER ADMIN »).
 */
export async function restoreAndPublishVersion(
  input: RestoreAndPublishInput,
  deps: PublishSiteDeps,
): Promise<PublishSiteResult> {
  if (input.isSuperAdminAction && !input.restoreJustification?.trim()) {
    throw new Error(
      "restoreAndPublishVersion : une restauration effectuée par un Super Admin exige une justification.",
    );
  }

  await withTenant(input.tenantId, (tx) =>
    restoreVersionIntoDraft(tx, input.tenantId, input.tenantSiteId, input.sourceVersionId),
  );

  return publishSite(
    {
      tenantId: input.tenantId,
      tenantSiteId: input.tenantSiteId,
      actorUserId: input.actorUserId,
      publishMessage: input.publishMessage,
      restoredFromVersionId: input.sourceVersionId,
      restoreJustification: input.isSuperAdminAction ? input.restoreJustification : undefined,
    },
    deps,
  );
}
