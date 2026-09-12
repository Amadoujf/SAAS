import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";

/**
 * Preuve automatisée de l'isolation multi-tenant (adjustement #11 des instructions de
 * Phase 0) : un utilisateur/contexte du tenant A ne peut jamais lire, modifier ou
 * supprimer les données du tenant B, y compris en connaissant l'identifiant exact de la
 * ressource visée. La protection est assurée par PostgreSQL (Row-Level Security), pas
 * seulement par le filtrage applicatif — voir
 * prisma/migrations/*_enable_row_level_security/migration.sql et
 * docs/03-architecture-technique.md#32-stratégie-multi-tenant.
 *
 * Nécessite une base PostgreSQL migrée et accessible via DATABASE_URL /
 * MIGRATE_DATABASE_URL (voir README.md — section Phase 0). En local, sans PostgreSQL
 * disponible, la suite est ignorée (skip) pour ne pas casser `pnpm test` sur un poste
 * sans Docker — le résultat "skipped" doit alors être traité comme "non vérifié",
 * jamais comme "réussi".
 *
 * En CI (voir .github/workflows/ci.yml), la variable d'environnement
 * `REQUIRE_DB_TESTS=true` est positionnée : une base injoignable devient alors une
 * ERREUR qui fait échouer le job, au lieu d'un skip silencieux. C'est ce qui garantit
 * que ce test tourne réellement à chaque exécution de la CI — jamais désactivé, jamais
 * simulé (voir la demande de validation du 12 septembre 2026).
 *
 * La vérification de connectivité a lieu en haut de fichier (top-level await, supporté
 * par l'environnement ESM de Vitest) car `describe.skipIf` évalue sa condition au moment
 * de la collecte des tests, avant qu'un `beforeAll` interne ait pu s'exécuter.
 */
let databaseAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch (error) {
  if (process.env.REQUIRE_DB_TESTS === "true") {
    throw new Error(
      "REQUIRE_DB_TESTS=true mais PostgreSQL est injoignable : la suite d'isolation " +
        "multi-tenant DOIT s'exécuter dans cet environnement (CI). Elle ne peut pas être " +
        `ignorée ici. Cause : ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  databaseAvailable = false;
  // eslint-disable-next-line no-console
  console.warn(
    "[tenant-isolation.test] Base de données injoignable — suite ignorée (skip). " +
      "Démarrez PostgreSQL et migrez le schéma (voir README.md) puis relancez " +
      "`pnpm --filter @yamacommerce/database test`.",
  );
}

describe.skipIf(!databaseAvailable)("Isolation multi-tenant (Row-Level Security)", () => {
  let tenantAId: string;
  let tenantBId: string;
  let productAId: string;

  beforeAll(async () => {
    if (!databaseAvailable) return;

    const suffix = Date.now();
    // La création d'un tenant est une opération Super Admin par nature (voir
    // docs/02-architecture-fonctionnelle.md §2.3) : sous RLS, elle exige un accès élevé
    // explicite — il n'existe de toute façon pas encore de contexte tenant à ce stade.
    const { tenantA, tenantB } = await withSuperAdminAccess(async (tx) => {
      const a = await tx.tenant.create({
        data: {
          slug: `test-tenant-a-${suffix}`,
          name: "Tenant Test A",
          businessType: "ECOMMERCE",
          status: "ACTIVE",
        },
      });
      const b = await tx.tenant.create({
        data: {
          slug: `test-tenant-b-${suffix}`,
          name: "Tenant Test B",
          businessType: "ECOMMERCE",
          status: "ACTIVE",
        },
      });
      return { tenantA: a, tenantB: b };
    });
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    await withTenant(tenantAId, async (tx) => {
      await tx.customer.create({
        data: { tenantId: tenantAId, firstName: "Client", lastName: "Confidentiel A" },
      });
      const product = await tx.product.create({
        data: {
          tenantId: tenantAId,
          name: "Produit confidentiel A",
          slug: `produit-confidentiel-a-${suffix}`,
          basePrice: 10_000,
        },
      });
      productAId = product.id;
    });
  });

  afterAll(async () => {
    if (!databaseAvailable) return;
    // Nettoyage via un accès explicitement élevé (bypass RLS), réservé aux scripts de
    // maintenance — jamais utilisé par le code applicatif tenant/dashboard.
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_super_admin', 'true', true)`;
      await tx.product.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await tx.customer.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await tx.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
    });
  });

  it("le tenant B ne peut pas LIRE un produit du tenant A par son identifiant exact", async () => {
    const result = await withTenant(tenantBId, (tx) =>
      tx.product.findUnique({ where: { id: productAId } }),
    );
    expect(result).toBeNull();
  });

  it("le tenant B ne peut pas LISTER les clients du tenant A", async () => {
    const results = await withTenant(tenantBId, (tx) =>
      tx.customer.findMany({ where: { tenantId: tenantAId } }),
    );
    expect(results).toHaveLength(0);
  });

  it("le tenant B ne peut pas MODIFIER un produit du tenant A (aucune ligne affectée)", async () => {
    const result = await withTenant(tenantBId, (tx) =>
      tx.product.updateMany({
        where: { id: productAId },
        data: { name: "Piraté par le tenant B" },
      }),
    );
    expect(result.count).toBe(0);

    const stillIntact = await withTenant(tenantAId, (tx) =>
      tx.product.findUnique({ where: { id: productAId } }),
    );
    expect(stillIntact?.name).toBe("Produit confidentiel A");
  });

  it("le tenant B ne peut pas SUPPRIMER un produit du tenant A (aucune ligne affectée)", async () => {
    const result = await withTenant(tenantBId, (tx) =>
      tx.product.deleteMany({ where: { id: productAId } }),
    );
    expect(result.count).toBe(0);

    const stillExists = await withTenant(tenantAId, (tx) =>
      tx.product.findUnique({ where: { id: productAId } }),
    );
    expect(stillExists).not.toBeNull();
  });

  it("le tenant A peut lire normalement ses propres données", async () => {
    const result = await withTenant(tenantAId, (tx) =>
      tx.product.findUnique({ where: { id: productAId } }),
    );
    expect(result?.id).toBe(productAId);
  });

  it("une requête sans contexte tenant ne renvoie aucune donnée métier (échec fermé par défaut)", async () => {
    // Simule un bug applicatif qui oublierait d'appeler withTenant() avant une requête.
    const results = await prisma.product.findMany({ where: { id: productAId } });
    expect(results).toHaveLength(0);
  });
});
