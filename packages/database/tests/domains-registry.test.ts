import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";
import {
  configureManagedDomain,
  createCustomDomain,
  createFreeSubdomain,
  listDomainsForTenant,
  markActive,
  markMisconfigured,
  markSslPending,
  markVerified,
  reactivateDomain,
  recordDnsCheckAttempt,
  regenerateVerificationToken,
  removeDomain,
  searchDomains,
  setPrimaryDomain,
  suspendDomain,
} from "../src/domains-registry";

/**
 * Vérifie le cycle de vie complet d'un domaine — voir docs/13 (assistant de domaines
 * personnalisés). Même politique que les autres suites DB : ignorée en local sans
 * PostgreSQL, obligatoire en CI via REQUIRE_DB_TESTS.
 */
let databaseAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch (error) {
  if (process.env.REQUIRE_DB_TESTS === "true") {
    throw new Error(
      "REQUIRE_DB_TESTS=true mais PostgreSQL est injoignable : la suite des domaines " +
        `DOIT s'exécuter en CI. Cause : ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  databaseAvailable = false;
  // eslint-disable-next-line no-console
  console.warn("[domains-registry.test] Base de données injoignable — suite ignorée (skip).");
}

describe.skipIf(!databaseAvailable)("Registre des domaines", () => {
  const suffix = Date.now();
  const sectorKey = `test-sector-domains-registry-${suffix}`;
  let tenantAId: string;
  let tenantBId: string;

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.sector.create({
        data: { key: sectorKey, name: "Secteur de test", defaultModuleKeys: [], isSystem: false },
      });
      const tenantA = await tx.tenant.create({
        data: {
          slug: `test-domreg-a-${suffix}`,
          name: "Tenant Domaines A",
          businessType: "ECOMMERCE",
          sectorKey,
          status: "ACTIVE",
        },
      });
      const tenantB = await tx.tenant.create({
        data: {
          slug: `test-domreg-b-${suffix}`,
          name: "Tenant Domaines B",
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
      await tx.domain.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await tx.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
      await tx.sector.deleteMany({ where: { key: sectorKey } });
    });
  });

  it("SOUS-DOMAINE GRATUIT : créé ACTIVE et principal (premier domaine du tenant)", async () => {
    const sub = await withTenant(tenantAId, (tx) =>
      createFreeSubdomain(tx, tenantAId, `boutique-a-${suffix}.yamacommerce.ai`, "caddy"),
    );
    expect(sub.lifecycleStatus).toBe("ACTIVE");
    expect(sub.isPrimary).toBe(true);
    expect(sub.serveDirectlyWhenNotPrimary).toBe(true);
  });

  it("DOMAINE PERSONNALISÉ : créé PENDING_DNS avec le jeton fourni", async () => {
    const future = new Date(Date.now() + 7 * 24 * 3600_000);
    const domain = await withTenant(tenantAId, (tx) =>
      createCustomDomain(tx, tenantAId, {
        domain: `boutique-a-${suffix}.example.com`,
        type: "custom",
        verificationToken: "token-abc",
        verificationTokenExpiresAt: future,
        expectedDnsRecords: [],
        dnsProvider: "caddy",
      }),
    );
    expect(domain.lifecycleStatus).toBe("PENDING_DNS");
    expect(domain.verificationToken).toBe("token-abc");
  });

  it("DOMAINE DÉJÀ ASSOCIÉ : la contrainte d'unicité globale refuse un doublon, même pour un autre tenant", async () => {
    await expect(
      withTenant(tenantBId, (tx) =>
        createCustomDomain(tx, tenantBId, {
          domain: `boutique-a-${suffix}.example.com`, // déjà pris par le tenant A.
          type: "custom",
          verificationToken: "autre-token",
          verificationTokenExpiresAt: new Date(Date.now() + 3600_000),
          expectedDnsRecords: [],
          dnsProvider: "caddy",
        }),
      ),
    ).rejects.toThrow();
  });

  it("VÉRIFICATION TXT : recordDnsCheckAttempt passe PENDING_DNS -> VERIFYING, puis markVerified -> VERIFIED", async () => {
    const domains = await withTenant(tenantAId, (tx) => listDomainsForTenant(tx, tenantAId));
    const custom = domains.find((d) => d.type === "custom")!;

    const afterAttempt = await withTenant(tenantAId, (tx) =>
      recordDnsCheckAttempt(tx, tenantAId, custom.id, [{ type: "TXT", host: "x", value: "y" }]),
    );
    expect(afterAttempt.lifecycleStatus).toBe("VERIFYING");
    expect(afterAttempt.verificationAttempts).toBe(1);

    await withTenant(tenantAId, (tx) => markVerified(tx, tenantAId, custom.id));
    const verified = await withTenant(tenantAId, (tx) => tx.domain.findUniqueOrThrow({ where: { id: custom.id } }));
    expect(verified.lifecycleStatus).toBe("VERIFIED");
  });

  it("ACTIVATION : VERIFIED -> SSL_PENDING -> ACTIVE, jamais ACTIVE directement depuis VERIFIED", async () => {
    const domains = await withTenant(tenantAId, (tx) => listDomainsForTenant(tx, tenantAId));
    const custom = domains.find((d) => d.type === "custom")!;

    await withTenant(tenantAId, (tx) => markSslPending(tx, tenantAId, custom.id));
    let current = await withTenant(tenantAId, (tx) => tx.domain.findUniqueOrThrow({ where: { id: custom.id } }));
    expect(current.lifecycleStatus).toBe("SSL_PENDING");

    await withTenant(tenantAId, (tx) => markActive(tx, tenantAId, custom.id));
    current = await withTenant(tenantAId, (tx) => tx.domain.findUniqueOrThrow({ where: { id: custom.id } }));
    expect(current.lifecycleStatus).toBe("ACTIVE");
  });

  it("DOMAINE PRINCIPAL : setPrimaryDomain exige ACTIVE et désigne un seul principal par tenant", async () => {
    const domains = await withTenant(tenantAId, (tx) => listDomainsForTenant(tx, tenantAId));
    const custom = domains.find((d) => d.type === "custom")!;
    const subdomain = domains.find((d) => d.type === "subdomain")!;
    expect(subdomain.isPrimary).toBe(true); // encore principal à ce stade.

    await withTenant(tenantAId, (tx) => setPrimaryDomain(tx, tenantAId, custom.id));

    const after = await withTenant(tenantAId, (tx) => listDomainsForTenant(tx, tenantAId));
    const primaries = after.filter((d) => d.isPrimary);
    expect(primaries).toHaveLength(1);
    expect(primaries[0]!.id).toBe(custom.id);
  });

  it("setPrimaryDomain refuse un domaine pas encore ACTIVE", async () => {
    const draftDomain = await withTenant(tenantAId, (tx) =>
      createCustomDomain(tx, tenantAId, {
        domain: `pas-encore-active-${suffix}.example.com`,
        type: "custom",
        verificationToken: "t",
        verificationTokenExpiresAt: new Date(Date.now() + 3600_000),
        expectedDnsRecords: [],
        dnsProvider: "caddy",
      }),
    );
    await expect(withTenant(tenantAId, (tx) => setPrimaryDomain(tx, tenantAId, draftDomain.id))).rejects.toThrow();
  });

  it("JETON EXPIRÉ / RENOUVELABLE : regenerateVerificationToken réinitialise le jeton et les tentatives", async () => {
    const domains = await withTenant(tenantAId, (tx) => listDomainsForTenant(tx, tenantAId));
    const target = domains.find((d) => d.domain.startsWith("pas-encore-active"))!;
    await withTenant(tenantAId, (tx) =>
      regenerateVerificationToken(tx, tenantAId, target.id, "nouveau-token", new Date(Date.now() + 3600_000), []),
    );
    const refreshed = await withTenant(tenantAId, (tx) => tx.domain.findUniqueOrThrow({ where: { id: target.id } }));
    expect(refreshed.verificationToken).toBe("nouveau-token");
    expect(refreshed.verificationAttempts).toBe(0);
    expect(refreshed.lifecycleStatus).toBe("PENDING_DNS");
  });

  it("DNS INCORRECT : markMisconfigured fonctionne depuis n'importe quel statut actif, jamais depuis REMOVED/SUSPENDED", async () => {
    const domains = await withTenant(tenantAId, (tx) => listDomainsForTenant(tx, tenantAId));
    const active = domains.find((d) => d.lifecycleStatus === "ACTIVE")!;
    await withTenant(tenantAId, (tx) => markMisconfigured(tx, tenantAId, active.id));
    const after = await withTenant(tenantAId, (tx) => tx.domain.findUniqueOrThrow({ where: { id: active.id } }));
    expect(after.lifecycleStatus).toBe("MISCONFIGURED");

    // Remet en ACTIVE pour ne pas perturber les tests suivants (retrait).
    await withTenant(tenantAId, (tx) => markVerified(tx, tenantAId, active.id));
    await withTenant(tenantAId, (tx) => markSslPending(tx, tenantAId, active.id));
    await withTenant(tenantAId, (tx) => markActive(tx, tenantAId, active.id));
  });

  it("RETRAIT : removeDomain passe en REMOVED — ne supprime jamais la ligne (audit)", async () => {
    const domains = await withTenant(tenantAId, (tx) => listDomainsForTenant(tx, tenantAId));
    const target = domains.find((d) => d.domain.startsWith("pas-encore-active"))!;
    await withTenant(tenantAId, (tx) => removeDomain(tx, tenantAId, target.id));
    const after = await withTenant(tenantAId, (tx) => tx.domain.findUniqueOrThrow({ where: { id: target.id } }));
    expect(after.lifecycleStatus).toBe("REMOVED");

    await expect(withTenant(tenantAId, (tx) => removeDomain(tx, tenantAId, target.id))).rejects.toThrow();
  });

  it("ISOLATION ENTRE TENANTS : le tenant B ne voit jamais les domaines du tenant A", async () => {
    const visibleFromB = await withTenant(tenantBId, (tx) => listDomainsForTenant(tx, tenantAId));
    expect(visibleFromB).toHaveLength(0);
  });

  it("SUPER ADMIN : searchDomains voit tous les tenants ; suspendDomain puis reactivateDomain", async () => {
    const results = await withSuperAdminAccess((tx) => searchDomains(tx, { query: `boutique-a-${suffix}` }));
    expect(results.length).toBeGreaterThan(0);

    const activeOne = results.find((d) => d.lifecycleStatus === "ACTIVE")!;
    await withSuperAdminAccess((tx) => suspendDomain(tx, activeOne.id));
    let refreshed = await withSuperAdminAccess((tx) => tx.domain.findUniqueOrThrow({ where: { id: activeOne.id } }));
    expect(refreshed.lifecycleStatus).toBe("SUSPENDED");

    await withSuperAdminAccess((tx) => reactivateDomain(tx, activeOne.id));
    refreshed = await withSuperAdminAccess((tx) => tx.domain.findUniqueOrThrow({ where: { id: activeOne.id } }));
    expect(refreshed.lifecycleStatus).toBe("VERIFIED");
  });

  it("SUPER ADMIN : configureManagedDomain enregistre les informations d'achat/facturation, le titulaire légal restant le client", async () => {
    const domains = await withTenant(tenantAId, (tx) => listDomainsForTenant(tx, tenantAId));
    const target = domains.find((d) => d.type === "custom" && d.lifecycleStatus !== "REMOVED")!;

    const updated = await withSuperAdminAccess((tx) =>
      configureManagedDomain(tx, target.id, {
        managedByPlatform: true,
        registrarProvider: "manual",
        purchaseCostXOF: 5_000,
        priceBilledXOF: 10_000,
        paymentStatus: "paid",
        legalOwnerName: "Fatou Diop", // le CLIENT, même si géré par la plateforme.
        legalOwnerContact: { email: "fatou@example.com" },
        isLocked: true,
      }),
    );
    expect(updated.managedByPlatform).toBe(true);
    expect(updated.legalOwnerName).toBe("Fatou Diop");
  });
});
