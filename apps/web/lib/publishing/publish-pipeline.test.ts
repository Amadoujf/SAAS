import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  prisma,
  withSuperAdminAccess,
  withTenant,
  upsertTemplate,
  assignTemplateToTenant,
  publishTemplate,
  getOrCreateDraftVersion,
  updatePageBlocks,
  listVersionHistory,
} from "@yamacommerce/database";
import { DEFAULT_DESIGN_TOKENS } from "@yamacommerce/design-tokens";
import { InMemoryDistributedLock } from "@yamacommerce/queue";
import { resolveScheduledPublishUtc } from "@yamacommerce/publishing";
import { resolveTenantSiteForRendering } from "@/lib/rendering/resolve-tenant-site";
import { InMemoryMediaRepository } from "@/lib/media/in-memory-media-repository";
import { publishSite, type PublishSiteDeps } from "./publish-pipeline";
import { scheduleSitePublish, promoteScheduledPublish } from "./schedule-pipeline";
import { restoreAndPublishVersion } from "./restore-pipeline";

/**
 * CORRECTION DE STABILISATION (22 septembre 2026) — trouvé en exécutant réellement
 * cette suite pour la première fois : une date absolue codée en dur ("2026-09-22...")
 * finit TOUJOURS par se retrouver dans le passé une fois que l'horloge réelle la
 * dépasse (`scheduleVersionPublish` refuse alors toute date passée), rendant le test
 * inévitablement fragile avec le temps. `Africa/Dakar` est UTC+0 toute l'année (jamais
 * d'heure d'été) : les chiffres de l'heure UTC SONT les chiffres de l'heure locale de
 * Dakar, d'où ce calcul direct sans bibliothèque de fuseaux.
 */
function localDakarDateTimeInFuture(hoursFromNow: number): string {
  return new Date(Date.now() + hoursFromNow * 3_600_000).toISOString().slice(0, 16);
}

/**
 * Vérifie le pipeline de publication de bout en bout — voir docs/12 §12.3,
 * « TESTS OBLIGATOIRES ». Utilise `InMemoryDistributedLock` et `InMemoryMediaRepository`
 * (jamais Redis/R2 réels — voir la même politique que les tests de la médiathèque) MAIS
 * un vrai PostgreSQL pour tenant/site/version (aucune alternative en mémoire pour la RLS,
 * voir tenant-context.ts) : ignorée en local sans PostgreSQL, obligatoire en CI.
 */
let databaseAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch (error) {
  if (process.env.REQUIRE_DB_TESTS === "true") {
    throw new Error(
      "REQUIRE_DB_TESTS=true mais PostgreSQL est injoignable : la suite du pipeline de " +
        `publication DOIT s'exécuter en CI. Cause : ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  databaseAvailable = false;
  // eslint-disable-next-line no-console
  console.warn("[publish-pipeline.test] Base de données injoignable — suite ignorée (skip).");
}

const validManifest = {
  pages: [
    {
      slug: "accueil",
      title: "Accueil",
      isHome: true,
      sections: [
        {
          id: "cta-1",
          sectionKey: "cta" as const,
          variant: "banner",
          order: 0,
          isEnabled: true,
          animationOverride: "inherit" as const,
          params: { title: "Titre", buttonLabel: "Go", buttonHref: "/x" },
        },
      ],
    },
  ],
};

describe.skipIf(!databaseAvailable)("Pipeline de publication", () => {
  const suffix = Date.now();
  const sectorKey = `test-sector-publish-${suffix}`;
  let tenantId: string;
  let ownerUserId: string;
  let roleId: string;
  let templateId: string;
  let tenantSiteId: string;
  let planId: string;

  function deps(): PublishSiteDeps {
    return {
      lock: new InMemoryDistributedLock(),
      mediaRepository: new InMemoryMediaRepository(),
      invalidateCache: () => {}, // revalidateTag exige un contexte de requête Next.js réel.
    };
  }

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.sector.create({
        data: { key: sectorKey, name: "Secteur de test", defaultModuleKeys: [], isSystem: false },
      });
      const tenant = await tx.tenant.create({
        data: {
          slug: `test-publish-${suffix}`,
          name: "Tenant Publication",
          businessType: "ECOMMERCE",
          sectorKey,
          status: "ACTIVE",
        },
      });
      tenantId = tenant.id;

      const plan = await tx.subscriptionPlan.create({
        data: {
          name: `Plan test publication ${suffix}`,
          priceMonthly: 10_000,
          priceYearly: 100_000,
          maxProducts: 100,
          maxEmployees: 5,
          maxShops: 1,
          storageMB: 1024,
          maxAIGenerationsPerMonth: 10,
          maxAIImagesAnalyzedPerMonth: 10,
          maxAIProductsImportedPerMonth: 10,
        },
      });
      planId = plan.id;
      await tx.tenantSubscription.create({
        data: {
          tenantId,
          planId,
          status: "ACTIVE",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600_000),
        },
      });
      await tx.domain.create({
        data: {
          tenantId,
          domain: `boutique-${suffix}.yamacommerce.test`,
          type: "subdomain",
          isPrimary: true,
          lifecycleStatus: "ACTIVE",
        },
      });

      const role = await tx.role.create({
        data: { tenantId, name: "Propriétaire test", isSystem: false, permissions: ["site.publish", "site.schedule"] },
      });
      roleId = role.id;
      const owner = await tx.user.create({
        data: { email: `owner-${suffix}@test.local`, passwordHash: "x", fullName: "Owner Test" },
      });
      ownerUserId = owner.id;
      await tx.tenantUser.create({
        data: { tenantId, userId: ownerUserId, roleId, status: "ACTIVE" },
      });

      const template = await upsertTemplate(tx, {
        key: `test-publish-template-${suffix}`,
        name: "Template de test",
        sectorKey,
        artDirectionKey: "test",
        pageManifest: validManifest,
        defaultDesignTokens: DEFAULT_DESIGN_TOKENS,
      });
      templateId = template.id;
      await publishTemplate(tx, templateId);

      const site = await assignTemplateToTenant(tx, tenantId, templateId);
      tenantSiteId = site.id;
    });
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_super_admin', 'true', true)`;
      await tx.auditLog.deleteMany({ where: { tenantId } });
      await tx.tenantUser.deleteMany({ where: { tenantId } });
      await tx.role.deleteMany({ where: { id: roleId } });
      await tx.user.deleteMany({ where: { id: ownerUserId } });
      await tx.page.deleteMany({ where: { tenantId } });
      await tx.tenantSiteVersion.deleteMany({ where: { tenantId } });
      await tx.tenantSite.deleteMany({ where: { tenantId } });
      await tx.domain.deleteMany({ where: { tenantId } });
      await tx.tenantSubscription.deleteMany({ where: { tenantId } });
      // `publishVersion` incrémente un `Counter` — sans ceci, la contrainte de clé
      // étrangère bloque la suppression du tenant (trouvé en exécutant cette suite
      // pour de vrai contre PostgreSQL, revue du 18 septembre 2026).
      await tx.counter.deleteMany({ where: { tenantId } });
      await tx.tenant.deleteMany({ where: { id: tenantId } });
      await tx.subscriptionPlan.deleteMany({ where: { id: planId } });
      await tx.siteTemplate.deleteMany({ where: { id: templateId } });
      await tx.sector.deleteMany({ where: { key: sectorKey } });
    });
  });

  it("PUBLICATION RÉUSSIE : publie, numérote la version, promeut le rapport de préparation, et le site public le sert", async () => {
    const result = await publishSite(
      { tenantId, tenantSiteId, actorUserId: ownerUserId, publishMessage: "Première mise en ligne" },
      deps(),
    );
    expect(result.outcome).toBe("published");
    if (result.outcome !== "published") throw new Error("unreachable");
    expect(result.versionNumber).toBe(1);

    const live = await resolveTenantSiteForRendering(tenantId, "live");
    expect(live).not.toBeNull();

    const auditEntries = await withSuperAdminAccess((tx) =>
      tx.auditLog.findMany({ where: { tenantId, action: "site.published" } }),
    );
    expect(auditEntries.length).toBeGreaterThan(0);
  });

  it("SITE PUBLIC NE SERT JAMAIS UN BROUILLON : une modification du brouillon n'apparaît pas tant qu'elle n'est pas publiée", async () => {
    const draft = await withTenant(tenantId, (tx) => getOrCreateDraftVersion(tx, tenantId, tenantSiteId));
    await withTenant(tenantId, (tx) =>
      updatePageBlocks(tx, draft.pages[0]!.id, [
        {
          id: "cta-1",
          sectionKey: "cta",
          variant: "banner",
          order: 0,
          isEnabled: true,
          animationOverride: "inherit",
          params: { title: "PAS ENCORE PUBLIÉ", buttonLabel: "Go", buttonHref: "/x" },
        },
      ]),
    );

    const live = await resolveTenantSiteForRendering(tenantId, "live");
    const liveTitle = (live!.manifest.pages[0]!.sections[0]!.params as { title: string }).title;
    expect(liveTitle).not.toBe("PAS ENCORE PUBLIÉ");
  });

  it("VALIDATION REFUSÉE : bloque une section invalide sans rien publier", async () => {
    const draft = await withTenant(tenantId, (tx) => getOrCreateDraftVersion(tx, tenantId, tenantSiteId));
    await withTenant(tenantId, (tx) =>
      tx.page.update({ where: { id: draft.pages[0]!.id }, data: { blocks: [] } }),
    );
    // Une page sans section n'est pas invalide en soi, mais retirer isHome partout l'est :
    await withTenant(tenantId, (tx) => tx.page.update({ where: { id: draft.pages[0]!.id }, data: { isHome: false } }));

    const result = await publishSite({ tenantId, tenantSiteId, actorUserId: ownerUserId }, deps());
    expect(result.outcome).toBe("blocked");
    if (result.outcome !== "blocked") throw new Error("unreachable");
    expect(result.report.issues.map((i) => i.code)).toContain("missing_home_page");

    // Remet une page d'accueil pour ne pas bloquer les tests suivants.
    await withTenant(tenantId, (tx) =>
      tx.page.update({
        where: { id: draft.pages[0]!.id },
        data: {
          isHome: true,
          blocks: [
            {
              id: "cta-1",
              sectionKey: "cta",
              variant: "banner",
              order: 0,
              isEnabled: true,
              animationOverride: "inherit",
              params: { title: "Titre", buttonLabel: "Go", buttonHref: "/x" },
            },
          ],
        },
      }),
    );
  });

  it("DOUBLE CLIC / DEUX PUBLICATIONS CONCURRENTES : une seule réussit, l'autre voit 'already_in_progress'", async () => {
    const sharedDeps = deps(); // même verrou pour les deux appels concurrents.
    const [first, second] = await Promise.all([
      publishSite({ tenantId, tenantSiteId, actorUserId: ownerUserId }, sharedDeps),
      publishSite({ tenantId, tenantSiteId, actorUserId: ownerUserId }, sharedDeps),
    ]);
    const outcomes = [first.outcome, second.outcome].sort();
    expect(outcomes).toEqual(["already_in_progress", "published"]);
  });

  it("TENANT SUSPENDU : bloque la publication", async () => {
    await withSuperAdminAccess((tx) => tx.tenant.update({ where: { id: tenantId }, data: { status: "SUSPENDED" } }));
    const result = await publishSite({ tenantId, tenantSiteId, actorUserId: ownerUserId }, deps());
    expect(result.outcome).toBe("blocked");
    if (result.outcome !== "blocked") throw new Error("unreachable");
    expect(result.report.issues.map((i) => i.code)).toContain("tenant_suspended");
    await withSuperAdminAccess((tx) => tx.tenant.update({ where: { id: tenantId }, data: { status: "ACTIVE" } }));
  });

  it("ABONNEMENT EXPIRÉ : bloque la publication", async () => {
    await withSuperAdminAccess((tx) => tx.tenantSubscription.update({ where: { tenantId }, data: { status: "CANCELED" } }));
    const result = await publishSite({ tenantId, tenantSiteId, actorUserId: ownerUserId }, deps());
    expect(result.outcome).toBe("blocked");
    if (result.outcome !== "blocked") throw new Error("unreachable");
    expect(result.report.issues.map((i) => i.code)).toContain("subscription_disallows_publish");
    await withSuperAdminAccess((tx) => tx.tenantSubscription.update({ where: { tenantId }, data: { status: "ACTIVE" } }));
  });

  it("MÉDIA MANQUANT/PRIVÉ : un document sensible référencé bloque, et n'est jamais promu public", async () => {
    const media = new InMemoryMediaRepository();
    const asset = await media.createPending(tenantId, {
      ownerId: ownerUserId,
      originalName: "contrat.pdf",
      storageKey: "k1",
      type: "DOCUMENT",
      mimeType: "application/pdf",
      sizeBytes: 10,
    });
    await media.markReady(tenantId, asset.id, { sizeBytes: 10, mimeType: "application/pdf", checksumSha256: "x" });

    const draft = await withTenant(tenantId, (tx) => getOrCreateDraftVersion(tx, tenantId, tenantSiteId));
    await withTenant(tenantId, (tx) =>
      updatePageBlocks(tx, draft.pages[0]!.id, [
        {
          id: "manifesto-1",
          sectionKey: "brand_manifesto",
          variant: "image-left",
          order: 0,
          isEnabled: true,
          animationOverride: "inherit",
          params: { statement: "x", media: { url: `http://x.test/api/demo-media/${asset.id}/file`, alt: "" } },
        },
      ]),
    );

    const result = await publishSite(
      { tenantId, tenantSiteId, actorUserId: ownerUserId },
      { lock: new InMemoryDistributedLock(), mediaRepository: media, invalidateCache: () => {} },
    );
    expect(result.outcome).toBe("blocked");
    if (result.outcome !== "blocked") throw new Error("unreachable");
    expect(result.report.issues.map((i) => i.code)).toContain("media_private_cannot_promote");

    const stillPrivate = await media.get(tenantId, asset.id);
    expect(stillPrivate!.isPublic).toBe(false);

    // Restaure une page valide pour les tests suivants.
    await withTenant(tenantId, (tx) =>
      updatePageBlocks(tx, draft.pages[0]!.id, [
        {
          id: "cta-1",
          sectionKey: "cta",
          variant: "banner",
          order: 0,
          isEnabled: true,
          animationOverride: "inherit",
          params: { title: "Titre", buttonLabel: "Go", buttonHref: "/x" },
        },
      ]),
    );
  });

  it("PUBLICATION PROGRAMMÉE + FUSEAU HORAIRE : programme puis promeut à l'échéance", async () => {
    const scheduledDateTimeLocal = localDakarDateTimeInFuture(1);
    const scheduleResult = await scheduleSitePublish(
      {
        tenantId,
        tenantSiteId,
        requestedByUserId: ownerUserId,
        scheduledDateTimeLocal,
        timeZone: "Africa/Dakar",
      },
      { mediaRepository: new InMemoryMediaRepository() },
    );
    expect(scheduleResult.outcome).toBe("scheduled");
    if (scheduleResult.outcome !== "scheduled") throw new Error("unreachable");
    expect(scheduleResult.scheduledAtUtc.toISOString()).toBe(
      resolveScheduledPublishUtc(scheduledDateTimeLocal, "Africa/Dakar").toISOString(),
    );

    const promotion = await promoteScheduledPublish(
      {
        tenantId,
        tenantSiteId,
        versionId: scheduleResult.versionId,
        scheduledAtIso: scheduleResult.scheduledAtUtc.toISOString(),
        requestedByUserId: ownerUserId,
      },
      deps(),
    );
    expect(promotion.outcome).toBe("published");

    // RÉESSAI/IDEMPOTENCE : rejouer le même job ne publie pas deux fois.
    const replay = await promoteScheduledPublish(
      {
        tenantId,
        tenantSiteId,
        versionId: scheduleResult.versionId,
        scheduledAtIso: scheduleResult.scheduledAtUtc.toISOString(),
        requestedByUserId: ownerUserId,
      },
      deps(),
    );
    expect(replay.outcome).toBe("already_handled");
  });

  it("PERMISSIONS RÉVOQUÉES ENTRE-TEMPS : une publication programmée est annulée si le rôle a perdu site.publish", async () => {
    const scheduleResult = await scheduleSitePublish(
      {
        tenantId,
        tenantSiteId,
        requestedByUserId: ownerUserId,
        scheduledDateTimeLocal: localDakarDateTimeInFuture(2),
      },
      { mediaRepository: new InMemoryMediaRepository() },
    );
    expect(scheduleResult.outcome).toBe("scheduled");
    if (scheduleResult.outcome !== "scheduled") throw new Error("unreachable");

    await withSuperAdminAccess((tx) => tx.role.update({ where: { id: roleId }, data: { permissions: [] } }));

    const promotion = await promoteScheduledPublish(
      {
        tenantId,
        tenantSiteId,
        versionId: scheduleResult.versionId,
        scheduledAtIso: scheduleResult.scheduledAtUtc.toISOString(),
        requestedByUserId: ownerUserId,
      },
      deps(),
    );
    expect(promotion.outcome).toBe("permission_revoked");

    await withSuperAdminAccess((tx) =>
      tx.role.update({ where: { id: roleId }, data: { permissions: ["site.publish", "site.schedule"] } }),
    );
  });

  it("RESTAURATION : republie le contenu d'une ancienne version SANS jamais modifier celle-ci, et conserve l'ancienne publiée", async () => {
    const history = await withTenant(tenantId, (tx) => listVersionHistory(tx, tenantSiteId));
    const archived = history.find((v) => v.status === "archived");
    expect(archived).toBeDefined();
    const archivedPagesBefore = await withSuperAdminAccess((tx) =>
      tx.page.findMany({ where: { tenantSiteVersionId: archived!.id } }),
    );

    const result = await restoreAndPublishVersion(
      {
        tenantId,
        tenantSiteId,
        sourceVersionId: archived!.id,
        actorUserId: ownerUserId,
        isSuperAdminAction: false,
      },
      deps(),
    );
    expect(result.outcome).toBe("published");

    const archivedAfter = await withSuperAdminAccess((tx) =>
      tx.tenantSiteVersion.findUniqueOrThrow({ where: { id: archived!.id } }),
    );
    expect(archivedAfter.status).toBe("archived"); // jamais modifiée par la restauration.
    const archivedPagesAfter = await withSuperAdminAccess((tx) =>
      tx.page.findMany({ where: { tenantSiteVersionId: archived!.id } }),
    );
    expect(archivedPagesAfter.map((p) => p.slug).sort()).toEqual(archivedPagesBefore.map((p) => p.slug).sort());
  });

  it("Super Admin : la restauration exige une justification obligatoire", async () => {
    const history = await withTenant(tenantId, (tx) => listVersionHistory(tx, tenantSiteId));
    const archived = history.find((v) => v.status === "archived")!;

    await expect(
      restoreAndPublishVersion(
        { tenantId, tenantSiteId, sourceVersionId: archived.id, actorUserId: ownerUserId, isSuperAdminAction: true },
        deps(),
      ),
    ).rejects.toThrow(/justification/);
  });
});
