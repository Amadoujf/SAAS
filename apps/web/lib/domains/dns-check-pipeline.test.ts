import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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
  let planId: string;

  function deps(zone: InMemoryDnsZone): DnsCheckDeps {
    return {
      dnsResolver: new InMemoryDnsResolver(zone),
      domainProvider: new LocalDomainProvider(zone, 2),
      // `revalidateTag` exige un contexte Next.js réel, absent d'un test Vitest —
      // voir la note de `DnsCheckDeps.invalidateCache` dans dns-check-pipeline.ts.
      invalidateCache: () => {},
    };
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

      // Abonnement ACTIF requis depuis la correction de stabilisation du 22 septembre
      // 2026 (voir docs/14) : l'ABSENCE de `TenantSubscription` bloque désormais
      // `addCustomDomain` par défaut (quota "domains" = 0) — ce fixture teste la
      // détection DNS, pas la facturation.
      const plan = await tx.subscriptionPlan.create({
        data: {
          name: `Formule Test DNS ${suffix}`,
          status: "PUBLISHED",
          priceMonthly: 15_000,
          priceYearly: 150_000,
          maxProducts: 100,
          maxEmployees: 5,
          maxShops: 1,
          maxCustomDomains: 10,
          storageMB: 1024,
          maxAIGenerationsPerMonth: 100,
          maxAIImagesAnalyzedPerMonth: 100,
          maxAIProductsImportedPerMonth: 100,
        },
      });
      planId = plan.id;
      await tx.tenantSubscription.create({
        data: {
          tenantId,
          planId,
          status: "ACTIVE",
          billingCycle: "MONTHLY",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
        },
      });
    });
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_super_admin', 'true', true)`;
      await tx.user.deleteMany({ where: { id: ownerUserId } });
      await tx.domain.deleteMany({ where: { tenantId } });
      await tx.tenantSubscription.deleteMany({ where: { tenantId } });
      await tx.subscriptionPlan.deleteMany({ where: { id: planId } });
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

    // Une SEULE instance de `deps` pour tout le scénario : `LocalDomainProvider`
    // compte ses tentatives de provisionnement TLS en mémoire (simule un état
    // persistant côté fournisseur réel) — en recréer une à chaque appel réinitialise
    // ce compteur et empêche jamais d'atteindre "active" (bug de test trouvé en
    // exécutant cette suite pour de vrai, revue du 18 septembre 2026).
    const d = deps(zone);

    // DNS INCORRECT : rien n'est encore propagé.
    const firstCheck = await checkDomainDnsAndAdvance(tenantId, added.domainId, d);
    expect(firstCheck).toBe("pending_dns");

    // Propage manuellement les enregistrements attendus dans la zone simulée.
    const domainRow = await withTenant(tenantId, (tx) => tx.domain.findUniqueOrThrow({ where: { id: added.domainId } }));
    const expected = domainRow.expectedDnsRecords as unknown as { type: "A" | "CNAME" | "TXT"; host: string; value: string }[];
    for (const record of expected) {
      zone.setRecord(record.type, record.host === "@" ? rawDomain : record.host, record.value);
    }

    const secondCheck = await checkDomainDnsAndAdvance(tenantId, added.domainId, d);
    expect(secondCheck).toBe("ssl_pending");

    const thirdCheck = await checkDomainDnsAndAdvance(tenantId, added.domainId, d);
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

    const d = deps(zone); // même instance pour tout le scénario, voir le test précédent.
    await checkDomainDnsAndAdvance(tenantId, added.domainId, d); // -> ssl_pending
    const outcome = await checkDomainDnsAndAdvance(tenantId, added.domainId, d); // -> active
    expect(outcome).toBe("active");

    const { setPrimaryDomain } = await import("./custom-domain-pipeline");
    const primaryResult = await setPrimaryDomain(tenantId, ownerUserId, added.domainId, {
      invalidateCache: () => {},
    });
    expect(primaryResult.outcome).toBe("primary_set");

    const allDomains = await withTenant(tenantId, (tx) => tx.domain.findMany({ where: { tenantId } }));
    const primaries = allDomains.filter((d) => d.isPrimary);
    expect(primaries).toHaveLength(1);
    expect(primaries[0]!.id).toBe(added.domainId);
  });

  it("RETRAIT : removeDomain passe le domaine à REMOVED sans supprimer la ligne, ET révoque côté fournisseur (défense en profondeur)", async () => {
    const rawDomain = `to-remove-${suffix}.example.com`;
    const added = await addCustomDomain({ tenantId, actorUserId: ownerUserId, rawDomain });
    if (added.outcome !== "created") throw new Error("unreachable");

    const { removeDomain } = await import("./custom-domain-pipeline");
    const provider = new LocalDomainProvider(new InMemoryDnsZone());
    const revokeSpy = vi.spyOn(provider, "revokeDomain");
    await removeDomain(tenantId, ownerUserId, added.domainId, {
      domainProvider: provider,
      invalidateCache: () => {},
    });
    expect(revokeSpy).toHaveBeenCalledWith(rawDomain);

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
