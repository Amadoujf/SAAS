import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  prisma,
  withSuperAdminAccess,
  upsertTemplate,
  assignTemplateToTenant,
  publishTemplate,
} from "@yamacommerce/database";
import { DEFAULT_DESIGN_TOKENS } from "@yamacommerce/design-tokens";
import { resolveTenantSiteForRendering } from "./resolve-tenant-site";

/**
 * Vérifie le chemin de résolution réel par tenant (DB) : isolation multi-tenant,
 * et gating brouillon/publié — voir les exigences du moteur de rendu (« respecter le
 * tenant courant », « ne jamais exposer les données d'une autre entreprise »,
 * « supporter les versions brouillon et publiée »).
 *
 * Même politique que les suites DB de packages/database : ignorée en local sans
 * PostgreSQL, obligatoire en CI via REQUIRE_DB_TESTS.
 */
let databaseAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch (error) {
  if (process.env.REQUIRE_DB_TESTS === "true") {
    throw new Error(
      "REQUIRE_DB_TESTS=true mais PostgreSQL est injoignable : la suite de résolution " +
        `de site DOIT s'exécuter en CI. Cause : ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  databaseAvailable = false;
  // eslint-disable-next-line no-console
  console.warn("[resolve-tenant-site.test] Base de données injoignable — suite ignorée (skip).");
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

describe.skipIf(!databaseAvailable)("resolveTenantSiteForRendering", () => {
  const suffix = Date.now();
  const sectorKey = `test-sector-render-${suffix}`;
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
          slug: `test-render-a-${suffix}`,
          name: "Tenant Render A",
          businessType: "ECOMMERCE",
          sectorKey,
          status: "ACTIVE",
        },
      });
      const tenantB = await tx.tenant.create({
        data: {
          slug: `test-render-b-${suffix}`,
          name: "Tenant Render B",
          businessType: "ECOMMERCE",
          sectorKey,
          status: "ACTIVE",
        },
      });
      tenantAId = tenantA.id;
      tenantBId = tenantB.id;

      const template = await upsertTemplate(tx, {
        key: `test-render-template-${suffix}`,
        name: "Template de test",
        sectorKey,
        artDirectionKey: "test",
        pageManifest: validManifest,
        defaultDesignTokens: DEFAULT_DESIGN_TOKENS,
      });
      templateId = template.id;

      // Seul le tenant A reçoit un site — le tenant B n'en a aucun.
      await assignTemplateToTenant(tx, tenantAId, templateId);
    });
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_super_admin', 'true', true)`;
      await tx.tenantSite.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await tx.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
      await tx.siteTemplate.deleteMany({ where: { id: templateId } });
      await tx.sector.deleteMany({ where: { key: sectorKey } });
    });
  });

  it("mode live : renvoie null tant que le template/site n'est pas publié", async () => {
    const result = await resolveTenantSiteForRendering(tenantAId, "live");
    expect(result).toBeNull();
  });

  it("mode preview : renvoie le contenu même en brouillon", async () => {
    const result = await resolveTenantSiteForRendering(tenantAId, "preview");
    expect(result).not.toBeNull();
    expect(result?.manifest.pages[0]?.slug).toBe("accueil");
  });

  it("mode live : renvoie le contenu une fois le template ET le site publiés", async () => {
    await withSuperAdminAccess((tx) => publishTemplate(tx, templateId));
    await prisma.tenantSite.update({ where: { tenantId: tenantAId }, data: { isPublished: true } });

    const result = await resolveTenantSiteForRendering(tenantAId, "live");
    expect(result).not.toBeNull();
    expect(result?.animationLevel).toBe(DEFAULT_DESIGN_TOKENS.animation.level);
  });

  it("isolation multi-tenant : le tenant B (sans site) ne récupère jamais le site du tenant A", async () => {
    const resultLive = await resolveTenantSiteForRendering(tenantBId, "live");
    const resultPreview = await resolveTenantSiteForRendering(tenantBId, "preview");
    expect(resultLive).toBeNull();
    expect(resultPreview).toBeNull();
  });
});
