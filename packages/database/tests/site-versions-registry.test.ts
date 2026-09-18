import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_DESIGN_TOKENS } from "@yamacommerce/design-tokens";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";
import { assignTemplateToTenant, upsertTemplate } from "../src/templates-registry";
import { writeAuditLog } from "../src/audit-log-registry";
import {
  cancelScheduledPublish,
  duplicatePage,
  getOrCreateDraftVersion,
  getPublishedVersion,
  listVersionHistory,
  publishScheduledVersion,
  publishVersion,
  restoreVersionIntoDraft,
  scheduleVersionPublish,
  updatePageBlocks,
  updatePageMeta,
} from "../src/site-versions-registry";

/**
 * Vérifie la fondation données de l'éditeur visuel (docs/12 §12.2, docs/04 §4.5.7) :
 * seed initial du brouillon depuis le manifeste du template, garde-fou "on ne modifie
 * jamais une version publiée/archivée", cycle publier → archiver l'ancienne → nouveau
 * brouillon, restauration depuis l'historique, et isolation multi-tenant de
 * `TenantSiteVersion`/`Page` (même garantie RLS que le reste du schéma).
 *
 * Même politique que les autres suites DB : ignorée en local sans PostgreSQL,
 * obligatoire en CI via REQUIRE_DB_TESTS.
 */
let databaseAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch (error) {
  if (process.env.REQUIRE_DB_TESTS === "true") {
    throw new Error(
      "REQUIRE_DB_TESTS=true mais PostgreSQL est injoignable : la suite de l'éditeur " +
        `visuel DOIT s'exécuter en CI. Cause : ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  databaseAvailable = false;
  // eslint-disable-next-line no-console
  console.warn("[site-versions-registry.test] Base de données injoignable — suite ignorée (skip).");
}

const validManifest = {
  pages: [
    {
      slug: "accueil",
      title: "Accueil",
      isHome: true,
      sections: [
        {
          id: "hero-1",
          sectionKey: "hero" as const,
          variant: "split",
          order: 0,
          params: { title: "Bienvenue", media: { url: "https://example.com/hero.jpg" } },
        },
      ],
    },
  ],
};

describe.skipIf(!databaseAvailable)("Fondation données de l'éditeur visuel", () => {
  const suffix = Date.now();
  const sectorKey = `test-sector-editor-${suffix}`;
  let tenantAId: string;
  let tenantBId: string;
  let templateId: string;
  let tenantSiteAId: string;
  let tenantSiteBId: string;

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.sector.create({
        data: { key: sectorKey, name: "Secteur de test", defaultModuleKeys: [], isSystem: false },
      });
      const tenantA = await tx.tenant.create({
        data: {
          slug: `test-editor-a-${suffix}`,
          name: "Tenant Editeur A",
          businessType: "ECOMMERCE",
          sectorKey,
          status: "ACTIVE",
        },
      });
      const tenantB = await tx.tenant.create({
        data: {
          slug: `test-editor-b-${suffix}`,
          name: "Tenant Editeur B",
          businessType: "ECOMMERCE",
          sectorKey,
          status: "ACTIVE",
        },
      });
      tenantAId = tenantA.id;
      tenantBId = tenantB.id;

      const template = await upsertTemplate(tx, {
        key: `test-editor-template-${suffix}`,
        name: "Template de test",
        sectorKey,
        artDirectionKey: "test",
        pageManifest: validManifest,
        defaultDesignTokens: DEFAULT_DESIGN_TOKENS,
      });
      templateId = template.id;

      const siteA = await assignTemplateToTenant(tx, tenantAId, templateId);
      const siteB = await assignTemplateToTenant(tx, tenantBId, templateId);
      tenantSiteAId = siteA.id;
      tenantSiteBId = siteB.id;
    });
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_super_admin', 'true', true)`;
      await tx.auditLog.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await tx.page.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await tx.tenantSiteVersion.deleteMany({
        where: { tenantId: { in: [tenantAId, tenantBId] } },
      });
      await tx.tenantSite.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      // `publishVersion` incrémente un `Counter` (numérotation de version, voir
      // `nextCounterValue`) — trouvé en exécutant cette suite pour de vrai contre
      // PostgreSQL (revue de l'assistant de domaines, 18 septembre 2026) : sans
      // cette ligne, la contrainte de clé étrangère bloque la suppression du tenant.
      await tx.counter.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await tx.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
      await tx.siteTemplate.deleteMany({ where: { id: templateId } });
      await tx.sector.deleteMany({ where: { key: sectorKey } });
    });
  });

  it("crée un brouillon initial seedé depuis le manifeste du template", async () => {
    const draft = await withTenant(tenantAId, (tx) =>
      getOrCreateDraftVersion(tx, tenantAId, tenantSiteAId),
    );
    expect(draft.status).toBe("draft");
    expect(draft.pages).toHaveLength(1);
    expect(draft.pages[0]?.slug).toBe("accueil");
  });

  it("réutilise le même brouillon à un appel ultérieur (ne le recrée pas)", async () => {
    const first = await withTenant(tenantAId, (tx) =>
      getOrCreateDraftVersion(tx, tenantAId, tenantSiteAId),
    );
    const second = await withTenant(tenantAId, (tx) =>
      getOrCreateDraftVersion(tx, tenantAId, tenantSiteAId),
    );
    expect(second.id).toBe(first.id);
  });

  it("modifie les sections d'une page du brouillon après validation", async () => {
    const draft = await withTenant(tenantAId, (tx) =>
      getOrCreateDraftVersion(tx, tenantAId, tenantSiteAId),
    );
    const page = draft.pages[0]!;

    const updated = await withTenant(tenantAId, (tx) =>
      updatePageBlocks(tx, page.id, [
        {
          id: "hero-1",
          sectionKey: "hero",
          variant: "centered",
          order: 0,
          isEnabled: true,
          animationOverride: "inherit",
          params: { title: "Nouveau titre", media: { url: "https://example.com/y.jpg" } },
        },
      ]),
    );
    const blocks = updated.blocks as unknown as { variant: string }[];
    expect(blocks[0]?.variant).toBe("centered");
  });

  it("rejette des sections invalides (variante incompatible avec la section)", async () => {
    const draft = await withTenant(tenantAId, (tx) =>
      getOrCreateDraftVersion(tx, tenantAId, tenantSiteAId),
    );
    const page = draft.pages[0]!;

    await expect(
      withTenant(tenantAId, (tx) =>
        updatePageBlocks(tx, page.id, [
          {
            id: "hero-1",
            sectionKey: "hero",
            variant: "n-importe-quoi",
            order: 0,
            isEnabled: true,
            animationOverride: "inherit",
            params: { title: "x", media: { url: "https://example.com/y.jpg" } },
          } as never,
        ]),
      ),
    ).rejects.toThrow();
  });

  it("renomme une page du brouillon", async () => {
    const draft = await withTenant(tenantAId, (tx) =>
      getOrCreateDraftVersion(tx, tenantAId, tenantSiteAId),
    );
    const page = draft.pages[0]!;
    const updated = await withTenant(tenantAId, (tx) =>
      updatePageMeta(tx, page.id, { title: "Accueil (v2)" }),
    );
    expect(updated.title).toBe("Accueil (v2)");
  });

  it("duplique une page du brouillon sous un nouveau slug", async () => {
    const draft = await withTenant(tenantAId, (tx) =>
      getOrCreateDraftVersion(tx, tenantAId, tenantSiteAId),
    );
    const page = draft.pages[0]!;
    const copy = await withTenant(tenantAId, (tx) =>
      duplicatePage(tx, page.id, "accueil-copie", "Accueil (copie)"),
    );
    expect(copy.slug).toBe("accueil-copie");
    expect(copy.isHome).toBe(false);
  });

  it("publie le brouillon : crée une version publiée et un nouveau brouillon", async () => {
    const before = await withTenant(tenantAId, (tx) =>
      getOrCreateDraftVersion(tx, tenantAId, tenantSiteAId),
    );

    const { published, newDraft, changesSummary } = await withTenant(tenantAId, (tx) =>
      publishVersion(tx, tenantAId, tenantSiteAId, {
        publishMessage: "Première mise en ligne",
        domainUsed: "boutique-test.yamacommerce.app",
      }),
    );

    expect(published.id).toBe(before.id);
    expect(published.status).toBe("published");
    expect(published.publishedAt).not.toBeNull();
    // Première publication : aucune version publiée précédente à comparer, toutes les
    // pages du brouillon sont donc comptées comme "ajoutées" — y compris
    // "accueil-copie", dupliquée par le test précédent (voir le commentaire plus bas).
    expect(published.versionNumber).toBe(1);
    expect(published.publishMessage).toBe("Première mise en ligne");
    expect(published.domainUsed).toBe("boutique-test.yamacommerce.app");
    expect(published.wasScheduled).toBe(false);
    expect(changesSummary.addedPageSlugs.sort()).toEqual(["accueil", "accueil-copie"]);
    expect(newDraft.id).not.toBe(before.id);
    expect(newDraft.status).toBe("draft");
    // `before` inclut déjà la page dupliquée par le test précédent (2 pages) — le
    // nouveau brouillon est une copie fidèle du brouillon publié, même nombre de pages.
    expect(newDraft.pages).toHaveLength(before.pages.length);
    expect(before.pages.length).toBe(2);

    const publishedLookup = await withTenant(tenantAId, (tx) =>
      getPublishedVersion(tx, tenantSiteAId),
    );
    expect(publishedLookup?.id).toBe(published.id);

    const site = await withTenant(tenantAId, (tx) =>
      tx.tenantSite.findUniqueOrThrow({ where: { id: tenantSiteAId } }),
    );
    expect(site.isPublished).toBe(true);
  });

  it("republier archive l'ancienne version publiée au lieu de l'écraser, et incrémente le numéro de version", async () => {
    const firstPublished = await withTenant(tenantAId, (tx) =>
      getPublishedVersion(tx, tenantSiteAId),
    );

    const { published: secondPublished, changesSummary } = await withTenant(tenantAId, (tx) =>
      publishVersion(tx, tenantAId, tenantSiteAId),
    );
    expect(secondPublished.versionNumber).toBe((firstPublished!.versionNumber ?? 0) + 1);
    // Rien n'a changé entre les deux publications : le résumé ne doit signaler aucune
    // page modifiée.
    expect(changesSummary.totalChangedPages).toBe(0);

    const history = await withTenant(tenantAId, (tx) => listVersionHistory(tx, tenantSiteAId));
    const archivedEntry = history.find((v) => v.id === firstPublished!.id);
    expect(archivedEntry?.status).toBe("archived");

    const currentlyPublished = await withTenant(tenantAId, (tx) =>
      getPublishedVersion(tx, tenantSiteAId),
    );
    expect(currentlyPublished?.id).not.toBe(firstPublished!.id);
  });

  it("refuse de modifier une page d'une version publiée ou archivée", async () => {
    const published = await withTenant(tenantAId, (tx) => getPublishedVersion(tx, tenantSiteAId));
    const publishedPage = published!.pages[0]!;

    await expect(
      withTenant(tenantAId, (tx) =>
        updatePageBlocks(tx, publishedPage.id, [
          {
            id: "hero-1",
            sectionKey: "hero",
            variant: "split",
            order: 0,
            isEnabled: true,
            animationOverride: "inherit",
            params: { title: "x", media: { url: "https://example.com/y.jpg" } },
          },
        ]),
      ),
    ).rejects.toThrow(/brouillon/);
  });

  it("restaure une version archivée dans le brouillon courant", async () => {
    const history = await withTenant(tenantAId, (tx) => listVersionHistory(tx, tenantSiteAId));
    const archived = history.find((v) => v.status === "archived")!;

    const restoredDraft = await withTenant(tenantAId, (tx) =>
      restoreVersionIntoDraft(tx, tenantAId, tenantSiteAId, archived.id),
    );

    const archivedPages = await withSuperAdminAccess((tx) =>
      tx.page.findMany({ where: { tenantSiteVersionId: archived.id } }),
    );
    expect(restoredDraft.pages).toHaveLength(archivedPages.length);
    expect(restoredDraft.pages.map((p) => p.slug).sort()).toEqual(
      archivedPages.map((p) => p.slug).sort(),
    );
  });

  it("programme puis annule une publication programmée", async () => {
    const draft = await withTenant(tenantAId, (tx) =>
      getOrCreateDraftVersion(tx, tenantAId, tenantSiteAId),
    );
    const future = new Date(Date.now() + 3_600_000);

    const scheduled = await withTenant(tenantAId, (tx) =>
      scheduleVersionPublish(tx, draft.id, future),
    );
    expect(scheduled.status).toBe("scheduled");
    expect(scheduled.scheduledAt?.getTime()).toBe(future.getTime());

    const cancelled = await withTenant(tenantAId, (tx) => cancelScheduledPublish(tx, draft.id));
    expect(cancelled.status).toBe("draft");
    expect(cancelled.scheduledAt).toBeNull();
  });

  it("rejette une programmation dans le passé", async () => {
    const draft = await withTenant(tenantAId, (tx) =>
      getOrCreateDraftVersion(tx, tenantAId, tenantSiteAId),
    );
    const past = new Date(Date.now() - 1000);

    await expect(
      withTenant(tenantAId, (tx) => scheduleVersionPublish(tx, draft.id, past)),
    ).rejects.toThrow();
  });

  it("publishScheduledVersion : publie une version programmée précise SANS toucher à un brouillon créé entre-temps", async () => {
    const draftToSchedule = await withTenant(tenantAId, (tx) =>
      getOrCreateDraftVersion(tx, tenantAId, tenantSiteAId),
    );
    const future = new Date(Date.now() + 3_600_000);
    await withTenant(tenantAId, (tx) => scheduleVersionPublish(tx, draftToSchedule.id, future));

    // L'utilisateur continue à éditer pendant l'attente : un NOUVEAU brouillon apparaît
    // (aucune ligne "draft" n'existe plus tant que celui-ci est "scheduled").
    const newDraftWhileWaiting = await withTenant(tenantAId, (tx) =>
      getOrCreateDraftVersion(tx, tenantAId, tenantSiteAId),
    );
    expect(newDraftWhileWaiting.id).not.toBe(draftToSchedule.id);
    const renamed = await withTenant(tenantAId, (tx) =>
      updatePageMeta(tx, newDraftWhileWaiting.pages[0]!.id, { title: "Modifié pendant l'attente" }),
    );
    expect(renamed.title).toBe("Modifié pendant l'attente");

    const result = await withTenant(tenantAId, (tx) =>
      publishScheduledVersion(tx, tenantAId, tenantSiteAId, draftToSchedule.id),
    );
    expect(result).not.toBeNull();
    expect(result!.published.id).toBe(draftToSchedule.id);
    expect(result!.published.status).toBe("published");
    expect(result!.published.wasScheduled).toBe(true);
    // Le brouillon créé PENDANT l'attente n'est ni remplacé ni écrasé.
    expect(result!.newDraft.id).toBe(newDraftWhileWaiting.id);

    const stillEditableDraft = await withTenant(tenantAId, (tx) =>
      tx.page.findUniqueOrThrow({ where: { id: newDraftWhileWaiting.pages[0]!.id } }),
    );
    expect(stillEditableDraft.title).toBe("Modifié pendant l'attente");
  });

  it("publishScheduledVersion : idempotent — ne fait rien si la version n'est plus 'scheduled' (déjà rejouée)", async () => {
    const draft = await withTenant(tenantAId, (tx) =>
      getOrCreateDraftVersion(tx, tenantAId, tenantSiteAId),
    );
    const future = new Date(Date.now() + 3_600_000);
    await withTenant(tenantAId, (tx) => scheduleVersionPublish(tx, draft.id, future));

    const first = await withTenant(tenantAId, (tx) =>
      publishScheduledVersion(tx, tenantAId, tenantSiteAId, draft.id),
    );
    expect(first).not.toBeNull();

    const replay = await withTenant(tenantAId, (tx) =>
      publishScheduledVersion(tx, tenantAId, tenantSiteAId, draft.id),
    );
    expect(replay).toBeNull();
  });

  it("une publication issue d'une restauration trace la version source et la justification (Super Admin)", async () => {
    const history = await withTenant(tenantAId, (tx) => listVersionHistory(tx, tenantSiteAId));
    const archived = history.find((v) => v.status === "archived")!;

    await withTenant(tenantAId, (tx) =>
      restoreVersionIntoDraft(tx, tenantAId, tenantSiteAId, archived.id),
    );

    const { published } = await withTenant(tenantAId, (tx) =>
      publishVersion(tx, tenantAId, tenantSiteAId, {
        restoredFromVersionId: archived.id,
        restoreJustification: "Rollback demandé par le client après incident.",
      }),
    );

    expect(published.restoredFromVersionId).toBe(archived.id);
    expect(published.restoreJustification).toBe("Rollback demandé par le client après incident.");

    // La restauration ne modifie JAMAIS la version archivée source elle-même.
    const sourceStillArchived = await withTenant(tenantAId, (tx) =>
      tx.tenantSiteVersion.findUniqueOrThrow({ where: { id: archived.id } }),
    );
    expect(sourceStillArchived.status).toBe("archived");
    expect(sourceStillArchived.restoredFromVersionId).toBeNull();
  });

  it("journalise une action Super Admin dans AuditLog (premier point d'écriture du modèle)", async () => {
    const entry = await withSuperAdminAccess((tx) =>
      writeAuditLog(tx, {
        tenantId: tenantAId,
        actorUserId: null,
        actorType: "super_admin",
        action: "site_version.restored",
        entityType: "TenantSiteVersion",
        entityId: tenantSiteAId,
        metadata: { reason: "test" },
      }),
    );
    expect(entry.tenantId).toBe(tenantAId);
    expect(entry.action).toBe("site_version.restored");

    const readBack = await withTenant(tenantAId, (tx) =>
      tx.auditLog.findUniqueOrThrow({ where: { id: entry.id } }),
    );
    expect(readBack.actorType).toBe("super_admin");
  });

  it("isole TenantSiteVersion et Page entre tenants (même garantie RLS que les autres tables)", async () => {
    await withTenant(tenantBId, (tx) => getOrCreateDraftVersion(tx, tenantBId, tenantSiteBId));

    const versionsVisibleFromB = await withTenant(tenantBId, (tx) =>
      tx.tenantSiteVersion.findMany({ where: { tenantSiteId: tenantSiteAId } }),
    );
    const pagesVisibleFromB = await withTenant(tenantBId, (tx) =>
      tx.page.findMany({ where: { tenantId: tenantAId } }),
    );
    expect(versionsVisibleFromB).toHaveLength(0);
    expect(pagesVisibleFromB).toHaveLength(0);
  });
});
