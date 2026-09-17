import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, withSuperAdminAccess, withTenant } from "@yamacommerce/database";
import {
  InMemoryDnsResolver,
  InMemoryDnsZone,
  LocalDomainProvider,
  computeExpectedDnsRecords,
  computeVerificationTokenExpiry,
} from "@yamacommerce/domains";
import { checkDomainDnsAndAdvance, type DnsCheckDeps } from "./dns-check-pipeline";
import { addCustomDomain } from "./custom-domain-pipeline";
import { claimFreeSubdomain } from "./subdomain-pipeline";

/**
 * Vérifie le pipeline de détection DNS de bout en bout — voir docs/13,
 * « TESTS OBLIGATOIRES ». Utilise `LocalDomainProvider`/`InMemoryDnsResolver` (jamais
 * de vrai DNS/Caddy) MAIS un vrai PostgreSQL pour tenant/domaine (aucune alternative
 * en mémoire pour la RLS) : ignorée en local sans PostgreSQL, obligatoire en CI.
 */
let databaseAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch (error) {
  if (process.env.REQUIRE_DB_TESTS === "true") {
    throw new Error(
      "REQUIRE_DB_TESTS=true mais PostgreSQL est injoignable : la suite du pipeline de " +
        `domaines DOIT s'exécuter en CI. Cause : ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  databaseAvailable = false;
  // eslint-disable-next-line no-console
  console.warn("[dns-check-pipeline.test] Base de données injoignable — suite ignorée (skip).");
}

describe.skipIf(!databaseAvailable)("Pipeline de détection DNS", () => {
  const suffix = Date.now();
  const sectorKey = `test-sector-dnscheck-${suffix}`;
  let tenantId: string;
  let ownerUserId: string;

  function deps(zone: InMemoryDnsZone): DnsCheckDeps {
    return { dnsResolver: new InMemoryDnsResolver(zone), domainProvider: new LocalDomainProvider(zone, 2) };
  }

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.sector.create({
        data: { key: sectorKey, name: "Secteur de test", defaultModuleKeys: [], isSystem: false },
      });
      const tenant = await tx.tenant.create({
        data: {
          slug: `test-dnscheck-${suffix}`,
          name: "Tenant DNS Check",
          businessType: "ECOMMERCE",
          sectorKey,
          status: "ACTIVE",
        },
      });
      tenantId = tenant.id;
      const owner = await tx.user.create({
        data: { email: `owner-dnscheck-${suffix}@test.local`, passwordHash: "x", fullName: "Owner Test" },
      });
      ownerUserId = owner.id;
    });
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_super_admin', 'true', true)`;
      await tx.user.deleteMany({ where: { id: ownerUserId } });
      await tx.domain.deleteMany({ where: { tenantId } });
      await tx.tenant.deleteMany({ where: { id: tenantId } });
      await tx.sector.deleteMany({ where: { key: sectorKey } });
    });
  });

  it("SOUS-DOMAINE DISPONIBLE ET INDISPONIBLE : claimFreeSubdomain refuse un doublon", async () => {
    const first = await claimFreeSubdomain({
      tenantId,
      actorUserId: ownerUserId,
      rawSubdomain: `dnscheck-test-${suffix}`,
    });
    expect(first.outcome).toBe("claimed");

    const duplicate = await claimFreeSubdomain({
      tenantId,
      actorUserId: ownerUserId,
      rawSubdomain: `dnscheck-test-${suffix}`,
    });
    expect(duplicate.outcome).toBe("taken");
  });

  it("TERMES RÉSERVÉS : refuse un sous-domaine réservé", async () => {
    const result = await claimFreeSubdomain({ tenantId, actorUserId: ownerUserId, rawSubdomain: "admin" });
    expect(result.outcome).toBe("invalid");
  });

  it("VÉRIFICATION TXT puis SSL_PENDING puis ACTIVE, avec une zone DNS simulée dédiée", async () => {
    const zone = new InMemoryDnsZone();
    const rawDomain = `boutique-dnscheck-${suffix}.example.com`;

    const added = await addCustomDomain({ tenantId, actorUserId: ownerUserId, rawDomain });
    expect(added.outcome).toBe("created");
    if (added.outcome !== "created") throw new Error("unreachable");

    // DNS INCORRECT : rien n'est encore propagé.
    const firstCheck = await checkDomainDnsAndAdvance(tenantId, added.domainId, deps(zone));
    expect(firstCheck).toBe("pending_dns");

    // Propage manuellement les enregistrements attendus dans la zone simulée.
    const domainRow = await withTenant(tenantId, (tx) => tx.domain.findUniqueOrThrow({ where: { id: added.domainId } }));
    const expected = domainRow.expectedDnsRecords as unknown as { type: "A" | "CNAME" | "TXT"; host: string; value: string }[];
    for (const record of expected) {
      zone.setRecord(record.type, record.host === "@" ? rawDomain : record.host, record.value);
    }

    const secondCheck = await checkDomainDnsAndAdvance(tenantId, added.domainId, deps(zone));
    expect(secondCheck).toBe("ssl_pending");

    const thirdCheck = await checkDomainDnsAndAdvance(tenantId, added.domainId, deps(zone));
    expect(thirdCheck).toBe("active");

    const final = await withTenant(tenantId, (tx) => tx.domain.findUniqueOrThrow({ where: { id: added.domainId } }));
    expect(final.lifecycleStatus).toBe("ACTIVE");
  });

  it("JETON EXPIRÉ : bloque la vérification tant que le jeton n'est pas régénéré", async () => {
    const zone = new InMemoryDnsZone();
    const rawDomain = `expired-token-${suffix}.example.com`;
    const added = await addCustomDomain({ tenantId, actorUserId: ownerUserId, rawDomain });
    if (added.outcome !== "created") throw new Error("unreachable");

    // Force l'expiration directement en base (le pipeline ne l'expose pas).
    await withTenant(tenantId, (tx) =>
      tx.domain.update({ where: { id: added.domainId }, data: { verificationTokenExpiresAt: new Date(0) } }),
    );

    const outcome = await checkDomainDnsAndAdvance(tenantId, added.domainId, deps(zone));
    expect(outcome).toBe("token_expired");
  });

  it("DOMAINE PRINCIPAL puis REDIRECTIONS : le sous-domaine gratuit redirige vers le domaine actif devenu principal", async () => {
    const zone = new InMemoryDnsZone();
    const rawDomain = `primary-flow-${suffix}.example.com`;
    const added = await addCustomDomain({ tenantId, actorUserId: ownerUserId, rawDomain });
    if (added.outcome !== "created") throw new Error("unreachable");

    const expectedRecords = computeExpectedDnsRecords(rawDomain, "unused"); // juste pour connaître les hosts.
    const domainRow = await withTenant(tenantId, (tx) => tx.domain.findUniqueOrThrow({ where: { id: added.domainId } }));
    const token = domainRow.verificationToken!;
    for (const record of expectedRecords) {
      const value = record.type === "TXT" ? token : record.value;
      zone.setRecord(record.type, record.host === "@" ? rawDomain : record.host, value);
    }

    await checkDomainDnsAndAdvance(tenantId, added.domainId, deps(zone)); // -> ssl_pending
    const outcome = await checkDomainDnsAndAdvance(tenantId, added.domainId, deps(zone)); // -> active
    expect(outcome).toBe("active");

    const { setPrimaryDomain } = await import("./custom-domain-pipeline");
    const primaryResult = await setPrimaryDomain(tenantId, ownerUserId, added.domainId);
    expect(primaryResult.outcome).toBe("primary_set");

    const allDomains = await withTenant(tenantId, (tx) => tx.domain.findMany({ where: { tenantId } }));
    const primaries = allDomains.filter((d) => d.isPrimary);
    expect(primaries).toHaveLength(1);
    expect(primaries[0]!.id).toBe(added.domainId);
  });

  it("RETRAIT : removeDomain passe le domaine à REMOVED sans supprimer la ligne", async () => {
    const rawDomain = `to-remove-${suffix}.example.com`;
    const added = await addCustomDomain({ tenantId, actorUserId: ownerUserId, rawDomain });
    if (added.outcome !== "created") throw new Error("unreachable");

    const { removeDomain } = await import("./custom-domain-pipeline");
    await removeDomain(tenantId, ownerUserId, added.domainId);

    const row = await withTenant(tenantId, (tx) => tx.domain.findUniqueOrThrow({ where: { id: added.domainId } }));
    expect(row.lifecycleStatus).toBe("REMOVED");
  });

  it("ISOLATION ENTRE TENANTS : un domaine créé pour ce tenant est invisible depuis un autre", async () => {
    const otherTenant = await withSuperAdminAccess((tx) =>
      tx.tenant.create({
        data: {
          slug: `test-dnscheck-other-${suffix}`,
          name: "Autre tenant",
          businessType: "ECOMMERCE",
          sectorKey,
          status: "ACTIVE",
        },
      }),
    );

    const visibleFromOther = await withTenant(otherTenant.id, (tx) => tx.domain.findMany({ where: { tenantId } }));
    expect(visibleFromOther).toHaveLength(0);

    await withSuperAdminAccess((tx) => tx.tenant.delete({ where: { id: otherTenant.id } }));
  });
});
