import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_DESIGN_TOKENS } from "@yamacommerce/design-tokens";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";
import { assignTemplateToTenant, upsertTemplate } from "../src/templates-registry";
import {
  cancelScheduledPublish,
  duplicatePage,
  getOrCreateDraftVersion,
  getPublishedVersion,
  listVersionHistory,
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
      await tx.page.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await tx.tenantSiteVersion.deleteMany({
        where: { tenantId: { in: [tenantAId, tenantBId] } },
      });
      await tx.tenantSite.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
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

    const { published, newDraft } = await withTenant(tenantAId, (tx) =>
      publishVersion(tx, tenantAId, tenantSiteAId),
    );

    expect(published.id).toBe(before.id);
    expect(published.status).toBe("published");
    expect(published.publishedAt).not.toBeNull();
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

  it("republier archive l'ancienne version publiée au lieu de l'écraser", async () => {
    const firstPublished = await withTenant(tenantAId, (tx) =>
      getPublishedVersion(tx, tenantSiteAId),
    );

    await withTenant(tenantAId, (tx) => publishVersion(tx, tenantAId, tenantSiteAId));

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
