import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, withSuperAdminAccess } from "@yamacommerce/database";
import { isDomainAllowedForTls, isDomainAvailable, resolveTenantByHost } from "./resolve";

/**
 * Vérifie la résolution tenant-par-hôte et l'autorisation TLS — voir docs/13,
 * « STATUTS DU DOMAINE » et « HTTPS » : ne jamais servir/émettre un certificat pour
 * un domaine dont la propriété n'a pas été confirmée. Même politique que les autres
 * suites DB : ignorée en local sans PostgreSQL, obligatoire en CI.
 */
let databaseAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch (error) {
  if (process.env.REQUIRE_DB_TESTS === "true") {
    throw new Error(
      "REQUIRE_DB_TESTS=true mais PostgreSQL est injoignable : la suite de résolution " +
        `de domaine DOIT s'exécuter en CI. Cause : ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  databaseAvailable = false;
  // eslint-disable-next-line no-console
  console.warn("[resolve.test] Base de données injoignable — suite ignorée (skip).");
}

describe.skipIf(!databaseAvailable)("resolveTenantByHost / isDomainAllowedForTls", () => {
  const suffix = Date.now();
  const sectorKey = `test-sector-domains-${suffix}`;
  let tenantId: string;
  const domains = {
    draft: `draft-${suffix}.test-domains.example`,
    verified: `verified-${suffix}.test-domains.example`,
    sslPending: `ssl-pending-${suffix}.test-domains.example`,
    active: `active-${suffix}.test-domains.example`,
  } as const;

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.sector.create({
        data: { key: sectorKey, name: "Secteur de test", defaultModuleKeys: [], isSystem: false },
      });
      const tenant = await tx.tenant.create({
        data: {
          slug: `test-domains-${suffix}`,
          name: "Tenant Domaines",
          businessType: "ECOMMERCE",
          sectorKey,
          status: "ACTIVE",
        },
      });
      tenantId = tenant.id;

      await tx.domain.create({
        data: { tenantId, domain: domains.draft, type: "custom", lifecycleStatus: "DRAFT" },
      });
      await tx.domain.create({
        data: { tenantId, domain: domains.verified, type: "custom", lifecycleStatus: "VERIFIED" },
      });
      await tx.domain.create({
        data: { tenantId, domain: domains.sslPending, type: "custom", lifecycleStatus: "SSL_PENDING" },
      });
      await tx.domain.create({
        data: { tenantId, domain: domains.active, type: "custom", isPrimary: true, lifecycleStatus: "ACTIVE" },
      });
    });
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_super_admin', 'true', true)`;
      await tx.domain.deleteMany({ where: { tenantId } });
      await tx.tenant.deleteMany({ where: { id: tenantId } });
      await tx.sector.deleteMany({ where: { key: sectorKey } });
    });
  });

  it("resolveTenantByHost : renvoie null pour DRAFT, VERIFIED ou SSL_PENDING (pas encore ACTIVE)", async () => {
    expect(await resolveTenantByHost(domains.draft)).toBeNull();
    expect(await resolveTenantByHost(domains.verified)).toBeNull();
    expect(await resolveTenantByHost(domains.sslPending)).toBeNull();
  });

  it("resolveTenantByHost : renvoie le tenant SEULEMENT pour un domaine ACTIVE", async () => {
    const tenant = await resolveTenantByHost(domains.active);
    expect(tenant?.id).toBe(tenantId);
  });

  it("resolveTenantByHost : renvoie null pour un domaine inconnu", async () => {
    expect(await resolveTenantByHost("jamais-enregistre.test-domains.example")).toBeNull();
  });

  it("isDomainAllowedForTls : refuse tant que la propriété n'est pas confirmée (DRAFT)", async () => {
    expect(await isDomainAllowedForTls(domains.draft)).toBe(false);
  });

  it("isDomainAllowedForTls : autorise dès VERIFIED (avant même l'émission du certificat, sinon aucun certificat ne pourrait jamais être émis)", async () => {
    expect(await isDomainAllowedForTls(domains.verified)).toBe(true);
    expect(await isDomainAllowedForTls(domains.sslPending)).toBe(true);
    expect(await isDomainAllowedForTls(domains.active)).toBe(true);
  });

  it("isDomainAvailable : indisponible pour un domaine déjà enregistré, disponible sinon", async () => {
    expect(await isDomainAvailable(domains.active)).toBe(false);
    expect(await isDomainAvailable(`libre-${suffix}.test-domains.example`)).toBe(true);
  });
});
