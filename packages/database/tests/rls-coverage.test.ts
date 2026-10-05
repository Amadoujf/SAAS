import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";

/**
 * Couverture RLS de TOUTE la base (audit de sécurité avant prévisualisation) : une table
 * ajoutée sans Row-Level Security forcée fait échouer ce test. Les seules exceptions
 * sont listées et justifiées ci-dessous. Complète tenant-isolation.test.ts (preuves
 * fonctionnelles) par une vérification exhaustive du schéma.
 */
const WITHOUT_RLS: Record<string, string> = {
  _prisma_migrations: "journal des migrations (aucune donnée métier)",
  User: "lu à la connexion, avant tout contexte d'entreprise ; jamais exposé tel quel",
};

let databaseAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch (error) {
  if (process.env.REQUIRE_DB_TESTS === "true") throw error;
  databaseAvailable = false;
}

describe.skipIf(!databaseAvailable)("Couverture Row-Level Security", () => {
  let tenantAId: string;
  let tenantBId: string;
  let productAId: string;
  const suffix = Date.now();

  beforeAll(async () => {
    const { a, b } = await withSuperAdminAccess(async (tx) => ({
      a: await tx.tenant.create({ data: { slug: `rls-cov-a-${suffix}`, name: "RLS A", businessType: "ECOMMERCE", status: "ACTIVE" } }),
      b: await tx.tenant.create({ data: { slug: `rls-cov-b-${suffix}`, name: "RLS B", businessType: "ECOMMERCE", status: "ACTIVE" } }),
    }));
    tenantAId = a.id;
    tenantBId = b.id;
    productAId = await withTenant(tenantAId, async (tx) => {
      const p = await tx.product.create({ data: { tenantId: tenantAId, name: "Pièce A", slug: `piece-a-${suffix}`, basePrice: 1000 } });
      await tx.productImage.create({ data: { productId: p.id, url: "/a.webp", position: 0 } });
      return p.id;
    });
  });

  afterAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.productImage.deleteMany({ where: { productId: productAId } });
      await tx.product.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await tx.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
    });
  });

  it("chaque table a la RLS activée ET forcée, avec au moins une politique (sauf exceptions justifiées)", async () => {
    const rows = await prisma.$queryRaw<{ name: string; enabled: boolean; forced: boolean; policies: bigint }[]>`
      SELECT c.relname AS name, c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced,
             (SELECT count(*) FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policies
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'`;
    const unprotected = rows.filter((r) => !(r.name in WITHOUT_RLS) && (!r.enabled || !r.forced || Number(r.policies) === 0)).map((r) => r.name);
    expect(unprotected).toEqual([]);
    expect(rows.length).toBeGreaterThan(100);
  });

  it("le rôle applicatif n'est ni super-utilisateur ni exempté de la RLS", async () => {
    const [role] = await prisma.$queryRaw<{ rolsuper: boolean; rolbypassrls: boolean }[]>`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
    expect(role).toEqual({ rolsuper: false, rolbypassrls: false });
  });

  it("table fille sans tenantId : l'entreprise B ne voit pas, ni n'ajoute, d'image sur un produit de A", async () => {
    const seen = await withTenant(tenantBId, (tx) => tx.productImage.findMany({ where: { productId: productAId } }));
    expect(seen).toEqual([]);
    await expect(withTenant(tenantBId, (tx) => tx.productImage.create({ data: { productId: productAId, url: "/intrus.webp", position: 1 } }))).rejects.toThrow();
    const own = await withTenant(tenantAId, (tx) => tx.productImage.findMany({ where: { productId: productAId } }));
    expect(own).toHaveLength(1);
  });

  it("référentiels globaux : lisibles par une entreprise, jamais modifiables sans accès super-administrateur", async () => {
    const plans = await withTenant(tenantAId, (tx) => tx.subscriptionPlan.findMany());
    expect(plans.length).toBeGreaterThan(0);
    const before = plans[0]!;
    const changed = await withTenant(tenantAId, (tx) => tx.subscriptionPlan.updateMany({ where: { id: before.id }, data: { priceMonthly: 1 } }));
    expect(changed.count).toBe(0);
    await expect(withTenant(tenantAId, (tx) => tx.module.create({ data: { key: `intrus-${suffix}`, name: "Intrus", category: "sector" } }))).rejects.toThrow();
    const after = await withSuperAdminAccess((tx) => tx.subscriptionPlan.findUniqueOrThrow({ where: { id: before.id } }));
    expect(after.priceMonthly).toBe(before.priceMonthly);
  });
});
