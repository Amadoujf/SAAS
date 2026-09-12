import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";
import { activateSectorDefaults, isModuleEnabled, setModuleEnabled } from "../src/modules-registry";

/**
 * Vérifie le registre secteurs/modules (docs/11-secteurs-et-modules.md) : activation
 * des modules par défaut d'un secteur, idempotence, protection des modules core, et
 * isolation multi-tenant de `TenantModule` (même garantie que les autres tables —
 * voir tenant-isolation.test.ts).
 *
 * Même politique que tenant-isolation.test.ts : ignoré (skip) si PostgreSQL est
 * injoignable en local, mais `REQUIRE_DB_TESTS=true` (posé par la CI) transforme
 * cette absence en échec explicite plutôt qu'en skip silencieux.
 */
let databaseAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch (error) {
  if (process.env.REQUIRE_DB_TESTS === "true") {
    throw new Error(
      "REQUIRE_DB_TESTS=true mais PostgreSQL est injoignable : la suite du registre " +
        `secteurs/modules DOIT s'exécuter en CI. Cause : ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  databaseAvailable = false;
  // eslint-disable-next-line no-console
  console.warn("[module-registry.test] Base de données injoignable — suite ignorée (skip).");
}

describe.skipIf(!databaseAvailable)("Registre secteurs/modules", () => {
  let tenantAId: string;
  let tenantBId: string;
  const suffix = Date.now();
  const sectorKey = `test-sector-${suffix}`;

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.module.upsert({
        where: { key: "catalog" },
        update: {},
        create: { key: "catalog", name: "Catalogue", category: "sector", sectorKeys: [sectorKey] },
      });
      await tx.module.upsert({
        where: { key: "auth" },
        update: {},
        create: { key: "auth", name: "Authentification", category: "core", sectorKeys: [] },
      });
      await tx.sector.create({
        data: {
          key: sectorKey,
          name: "Secteur de test",
          defaultModuleKeys: ["catalog"],
          isSystem: false,
        },
      });

      const tenantA = await tx.tenant.create({
        data: {
          slug: `test-modreg-a-${suffix}`,
          name: "Tenant Modules A",
          businessType: "ECOMMERCE",
          sectorKey,
          status: "ACTIVE",
        },
      });
      const tenantB = await tx.tenant.create({
        data: {
          slug: `test-modreg-b-${suffix}`,
          name: "Tenant Modules B",
          businessType: "ECOMMERCE",
          sectorKey,
          status: "ACTIVE",
        },
      });
      tenantAId = tenantA.id;
      tenantBId = tenantB.id;
    });
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_super_admin', 'true', true)`;
      await tx.tenantModule.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await tx.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
      await tx.sector.deleteMany({ where: { key: sectorKey } });
    });
  });

  it("active les modules par défaut du secteur choisi", async () => {
    await withTenant(tenantAId, (tx) => activateSectorDefaults(tx, tenantAId, sectorKey));

    const enabled = await withTenant(tenantAId, (tx) => isModuleEnabled(tx, tenantAId, "catalog"));
    expect(enabled).toBe(true);
  });

  it("est idempotent : un module déjà activé manuellement n'est pas écrasé", async () => {
    await withTenant(tenantAId, (tx) => activateSectorDefaults(tx, tenantAId, sectorKey));
    await withTenant(tenantAId, (tx) =>
      setModuleEnabled(tx, { tenantId: tenantAId, moduleKey: "catalog", isEnabled: false }),
    );

    // Un second appel à activateSectorDefaults ne doit PAS réactiver un module que le
    // propriétaire a désactivé volontairement (voir docs/11 §11.6 règle 3).
    await withTenant(tenantAId, (tx) => activateSectorDefaults(tx, tenantAId, sectorKey));
    const stillDisabled = await withTenant(tenantAId, (tx) =>
      isModuleEnabled(tx, tenantAId, "catalog"),
    );
    expect(stillDisabled).toBe(false);
  });

  it("refuse de désactiver un module core", async () => {
    await expect(
      withTenant(tenantAId, (tx) =>
        setModuleEnabled(tx, { tenantId: tenantAId, moduleKey: "auth", isEnabled: false }),
      ),
    ).rejects.toThrow(/ne peut pas être désactivé/);
  });

  it("isole TenantModule entre tenants (même garantie RLS que les autres tables)", async () => {
    await withTenant(tenantAId, (tx) => activateSectorDefaults(tx, tenantAId, sectorKey));

    const visibleFromB = await withTenant(tenantBId, (tx) =>
      tx.tenantModule.findMany({ where: { tenantId: tenantAId } }),
    );
    expect(visibleFromB).toHaveLength(0);

    const enabledFromB = await withTenant(tenantBId, (tx) =>
      isModuleEnabled(tx, tenantAId, "catalog"),
    );
    expect(enabledFromB).toBe(false);
  });
});
