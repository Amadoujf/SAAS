import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_DESIGN_TOKENS } from "@yamacommerce/design-tokens";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";
import {
  archiveTemplate,
  assignTemplateToTenant,
  getPublishedTemplatesForSector,
  publishTemplate,
  resolveEffectiveDesignTokens,
  upsertTemplate,
} from "../src/templates-registry";

/**
 * Vérifie le registre de templates (docs/12-systeme-templates-et-direction-artistique.md) :
 * validation du manifeste et des tokens à l'écriture, cycle de statut, fusion des
 * tokens (template + surcharge tenant), isolation multi-tenant de `TenantSite`, et la
 * garantie centrale : changer de template ne supprime JAMAIS une donnée métier.
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
      "REQUIRE_DB_TESTS=true mais PostgreSQL est injoignable : la suite du registre " +
        `de templates DOIT s'exécuter en CI. Cause : ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  databaseAvailable = false;
  // eslint-disable-next-line no-console
  console.warn("[templates-registry.test] Base de données injoignable — suite ignorée (skip).");
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
          params: { title: "Bienvenue", media: { url: "https://example.com/hero.jpg" } },
          order: 0,
        },
      ],
    },
  ],
};

describe.skipIf(!databaseAvailable)("Registre de templates", () => {
  const suffix = Date.now();
  const sectorKey = `test-sector-tpl-${suffix}`;
  let tenantAId: string;
  let tenantBId: string;
  let templateId: string;

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.sector.create({
        data: { key: sectorKey, name: "Secteur de test", defaultModuleKeys: [], isSystem: false },
      });

      const tenantA = await tx.tenant.create({
        data: {
          slug: `test-tpl-a-${suffix}`,
          name: "Tenant Templates A",
          businessType: "ECOMMERCE",
          sectorKey,
          status: "ACTIVE",
        },
      });
      const tenantB = await tx.tenant.create({
        data: {
          slug: `test-tpl-b-${suffix}`,
          name: "Tenant Templates B",
          businessType: "ECOMMERCE",
          sectorKey,
          status: "ACTIVE",
        },
      });
      tenantAId = tenantA.id;
      tenantBId = tenantB.id;

      const template = await upsertTemplate(tx, {
        key: `test-template-${suffix}`,
        name: "Template de test",
        sectorKey,
        artDirectionKey: "test-direction",
        pageManifest: validManifest,
        defaultDesignTokens: DEFAULT_DESIGN_TOKENS,
      });
      templateId = template.id;
    });
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_super_admin', 'true', true)`;
      await tx.tenantSite.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await tx.product.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await tx.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
      await tx.siteTemplate.deleteMany({ where: { id: templateId } });
      await tx.sector.deleteMany({ where: { key: sectorKey } });
    });
  });

  it("rejette un manifeste invalide à la création", async () => {
    await withSuperAdminAccess((tx) =>
      expect(
        upsertTemplate(tx, {
          key: `invalid-${suffix}`,
          name: "Invalide",
          sectorKey,
          artDirectionKey: "x",
          pageManifest: { pages: [] }, // min(1) requis
          defaultDesignTokens: DEFAULT_DESIGN_TOKENS,
        }),
      ).rejects.toThrow(),
    );
  });

  it("un template créé est en brouillon et n'apparaît pas dans les templates publiés", async () => {
    const published = await withSuperAdminAccess((tx) =>
      getPublishedTemplatesForSector(tx, sectorKey),
    );
    expect(published.find((t) => t.id === templateId)).toBeUndefined();
  });

  it("publier puis archiver change le statut", async () => {
    await withSuperAdminAccess((tx) => publishTemplate(tx, templateId));
    const publishedList = await withSuperAdminAccess((tx) =>
      getPublishedTemplatesForSector(tx, sectorKey),
    );
    expect(publishedList.some((t) => t.id === templateId)).toBe(true);

    await withSuperAdminAccess((tx) => archiveTemplate(tx, templateId));
    const afterArchive = await withSuperAdminAccess((tx) =>
      getPublishedTemplatesForSector(tx, sectorKey),
    );
    expect(afterArchive.some((t) => t.id === templateId)).toBe(false);
  });

  it("attribue un template à un tenant sans jamais toucher ses données métier", async () => {
    // Donnée métier créée AVANT l'attribution du template.
    const product = await withTenant(tenantAId, (tx) =>
      tx.product.create({
        data: {
          tenantId: tenantAId,
          name: "Produit témoin",
          slug: `produit-temoin-${suffix}`,
          basePrice: 12_000,
        },
      }),
    );

    await withSuperAdminAccess((tx) => assignTemplateToTenant(tx, tenantAId, templateId));
    // Changement de template une seconde fois (simule un vrai changement, pas une
    // simple première attribution).
    await withSuperAdminAccess((tx) => assignTemplateToTenant(tx, tenantAId, templateId));

    const stillThere = await withTenant(tenantAId, (tx) =>
      tx.product.findUnique({ where: { id: product.id } }),
    );
    expect(stillThere).not.toBeNull();
    expect(stillThere?.name).toBe("Produit témoin");
  });

  it("fusionne les tokens du template avec la surcharge du tenant", async () => {
    await withTenant(tenantAId, (tx) =>
      tx.tenantSite.update({
        where: { tenantId: tenantAId },
        data: { designTokenOverrides: { colors: { primary: "#ABCDEF" } } },
      }),
    );

    const effective = await withTenant(tenantAId, (tx) =>
      resolveEffectiveDesignTokens(tx, tenantAId),
    );
    expect(effective.colors.primary).toBe("#ABCDEF");
    expect(effective.colors.secondary).toBe(DEFAULT_DESIGN_TOKENS.colors.secondary);
  });

  it("isole TenantSite entre tenants (même garantie RLS que les autres tables)", async () => {
    const visibleFromB = await withTenant(tenantBId, (tx) =>
      tx.tenantSite.findMany({ where: { tenantId: tenantAId } }),
    );
    expect(visibleFromB).toHaveLength(0);
  });
});
