import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  prisma,
  withSuperAdminAccess,
  withTenant,
  upsertTemplate,
  assignTemplateToTenant,
  publishTemplate,
  getOrCreateDraftVersion,
  publishVersion,
  updatePageBlocks,
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
  let tenantSiteAId: string;

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
      const tenantSiteA = await assignTemplateToTenant(tx, tenantAId, templateId);
      tenantSiteAId = tenantSiteA.id;
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
      // `publishVersion` incrémente un `Counter` — sans ceci, la contrainte de clé
      // étrangère bloque la suppression du tenant (trouvé en exécutant cette suite
      // pour de vrai contre PostgreSQL, revue du 18 septembre 2026).
      await tx.counter.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
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
    // `prisma.tenantSite.update` NU (sans `withTenant`/`withSuperAdminAccess`) est
    // bloqué par la RLS — trouvé en exécutant cette suite pour de vrai contre
    // PostgreSQL (revue du 18 septembre 2026) : "Record to update not found" alors
    // que la ligne existe bel et bien, simplement invisible sans contexte RLS.
    await withTenant(tenantAId, (tx) =>
      tx.tenantSite.update({ where: { tenantId: tenantAId }, data: { isPublished: true } }),
    );

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

  /**
   * Fondation éditeur visuel (docs/12 §12.2) : une fois qu'un tenant publie une
   * version personnalisée via l'éditeur, c'est CETTE version qui doit être servie en
   * mode "live" et "preview" — pas le manifeste par défaut du template. Vérifie
   * l'intégration `resolve-tenant-site.ts` ↔ `site-versions-registry.ts` de bout en
   * bout, avec de vraies données DB (pas un mock).
   */
  it("mode live et preview : sert la version PUBLIÉE de l'éditeur une fois personnalisée", async () => {
    const draft = await withTenant(tenantAId, (tx) =>
      getOrCreateDraftVersion(tx, tenantAId, tenantSiteAId),
    );
    const homePage = draft.pages.find((p) => p.isHome) ?? draft.pages[0]!;

    await withTenant(tenantAId, (tx) =>
      updatePageBlocks(tx, homePage.id, [
        {
          id: "cta-1",
          sectionKey: "cta",
          variant: "banner",
          order: 0,
          isEnabled: true,
          animationOverride: "inherit",
          params: {
            title: "Titre personnalisé par l'éditeur",
            buttonLabel: "Go",
            buttonHref: "/y",
          },
        },
      ]),
    );
    await withTenant(tenantAId, (tx) => publishVersion(tx, tenantAId, tenantSiteAId));

    const live = await resolveTenantSiteForRendering(tenantAId, "live");
    const preview = await resolveTenantSiteForRendering(tenantAId, "preview");

    expect(live).not.toBeNull();
    expect(preview).not.toBeNull();
    expect((live!.manifest.pages[0]!.sections[0]!.params as { title: string }).title).toBe(
      "Titre personnalisé par l'éditeur",
    );
    // Preview sert désormais le NOUVEAU brouillon créé par publishVersion (copie
    // fidèle de ce qui vient d'être publié) — même contenu tant que rien n'a encore
    // été réédité.
    expect((preview!.manifest.pages[0]!.sections[0]!.params as { title: string }).title).toBe(
      "Titre personnalisé par l'éditeur",
    );
  });
});
