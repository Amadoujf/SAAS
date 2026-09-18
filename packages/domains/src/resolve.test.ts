import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, withSuperAdminAccess, type DomainLifecycleStatus } from "@yamacommerce/database";
import { isDomainAllowedForTls, isDomainAvailable, resolveTenantByHost } from "./resolve";

/**
 * Vérifie la résolution tenant-par-hôte et l'autorisation TLS — voir docs/13,
 * « STATUTS DU DOMAINE » et « HTTPS » : ne jamais servir/émettre un certificat pour
 * un domaine dont la propriété n'a pas été confirmée, et — voir la revue du 18
 * septembre 2026 — « la résolution publique doit uniquement servir les domaines
 * autorisés, jamais un domaine suspendu ou supprimé » : couvre ICI explicitement
 * les 10 statuts un par un (pas un échantillon), plus la combinaison "domaine
 * ACTIVE mais tenant SUSPENDU" (le domaine, une fois actif, n'est jamais rétrogradé
 * automatiquement si SEUL le tenant est suspendu ensuite — la garantie doit donc
 * tenir même dans ce cas précis). Même politique que les autres suites DB : ignorée
 * en local sans PostgreSQL, obligatoire en CI.
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

const ALL_STATUSES: DomainLifecycleStatus[] = [
  "DRAFT",
  "PENDING_DNS",
  "VERIFYING",
  "VERIFIED",
  "SSL_PENDING",
  "ACTIVE",
  "MISCONFIGURED",
  "SUSPENDED",
  "EXPIRED",
  "REMOVED",
];

describe.skipIf(!databaseAvailable)("resolveTenantByHost / isDomainAllowedForTls", () => {
  const suffix = Date.now();
  const sectorKey = `test-sector-domains-${suffix}`;
  let tenantId: string;
  let suspendedTenantId: string;
  const domainByStatus = new Map<DomainLifecycleStatus, string>(
    ALL_STATUSES.map((status) => [status, `${status.toLowerCase()}-${suffix}.test-domains.example`]),
  );
  const activeDomainOfSuspendedTenant = `active-suspended-tenant-${suffix}.test-domains.example`;

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

      for (const [status, domain] of domainByStatus) {
        await tx.domain.create({
          data: { tenantId, domain, type: "custom", isPrimary: status === "ACTIVE", lifecycleStatus: status },
        });
      }

      const suspendedTenant = await tx.tenant.create({
        data: {
          slug: `test-domains-suspended-${suffix}`,
          name: "Tenant Suspendu Avec Domaine Actif",
          businessType: "ECOMMERCE",
          sectorKey,
          status: "SUSPENDED",
        },
      });
      suspendedTenantId = suspendedTenant.id;
      await tx.domain.create({
        data: {
          tenantId: suspendedTenantId,
          domain: activeDomainOfSuspendedTenant,
          type: "custom",
          isPrimary: true,
          lifecycleStatus: "ACTIVE",
        },
      });
    });
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_super_admin', 'true', true)`;
      await tx.domain.deleteMany({ where: { tenantId: { in: [tenantId, suspendedTenantId] } } });
      await tx.tenant.deleteMany({ where: { id: { in: [tenantId, suspendedTenantId] } } });
      await tx.sector.deleteMany({ where: { key: sectorKey } });
    });
  });

  it("resolveTenantByHost : ne renvoie JAMAIS de tenant pour un statut de domaine autre que ACTIVE (les 9 autres statuts, un par un)", async () => {
    for (const status of ALL_STATUSES) {
      if (status === "ACTIVE") continue;
      const domain = domainByStatus.get(status)!;
      const result = await resolveTenantByHost(domain);
      expect(result, `statut ${status} ne doit jamais résoudre un tenant`).toBeNull();
    }
  });

  it("resolveTenantByHost : SUSPENDU et SUPPRIMÉ en particulier — jamais résolus (préoccupation explicite du 18 septembre 2026)", async () => {
    expect(await resolveTenantByHost(domainByStatus.get("SUSPENDED")!)).toBeNull();
    expect(await resolveTenantByHost(domainByStatus.get("REMOVED")!)).toBeNull();
  });

  it("resolveTenantByHost : renvoie le tenant SEULEMENT pour un domaine ACTIVE", async () => {
    const tenant = await resolveTenantByHost(domainByStatus.get("ACTIVE")!);
    expect(tenant?.id).toBe(tenantId);
  });

  it("resolveTenantByHost : renvoie null pour un domaine inconnu", async () => {
    expect(await resolveTenantByHost("jamais-enregistre.test-domains.example")).toBeNull();
  });

  it("DÉFENSE EN PROFONDEUR : un domaine ACTIVE résout bien un tenant même si CE tenant est par ailleurs suspendu — c'est à l'appelant (resolvePublicSite) de vérifier tenant.status séparément, jamais supposé implicite", async () => {
    // Ce test documente le comportement actuel plutôt que de le cacher : voir
    // apps/web/lib/rendering/resolve-public-site.ts, qui vérifie EXPLICITEMENT
    // `tenant.status === "SUSPENDED"` après cet appel — jamais un simple "ça doit
    // marcher tout seul". S'il devient un jour tentant de retirer cette vérification
    // côté appelant en pensant qu'elle est redondante, ce test échouera pour le
    // rappeler.
    const tenant = await resolveTenantByHost(activeDomainOfSuspendedTenant);
    expect(tenant?.id).toBe(suspendedTenantId);
    expect(tenant?.status).toBe("SUSPENDED");
  });

  it("isDomainAllowedForTls : refuse tant que la propriété n'est pas confirmée (DRAFT, PENDING_DNS, VERIFYING)", async () => {
    expect(await isDomainAllowedForTls(domainByStatus.get("DRAFT")!)).toBe(false);
    expect(await isDomainAllowedForTls(domainByStatus.get("PENDING_DNS")!)).toBe(false);
    expect(await isDomainAllowedForTls(domainByStatus.get("VERIFYING")!)).toBe(false);
  });

  it("isDomainAllowedForTls : autorise dès VERIFIED (avant même l'émission du certificat, sinon aucun certificat ne pourrait jamais être émis)", async () => {
    expect(await isDomainAllowedForTls(domainByStatus.get("VERIFIED")!)).toBe(true);
    expect(await isDomainAllowedForTls(domainByStatus.get("SSL_PENDING")!)).toBe(true);
    expect(await isDomainAllowedForTls(domainByStatus.get("ACTIVE")!)).toBe(true);
  });

  it("isDomainAllowedForTls : refuse MISCONFIGURED, SUSPENDU, EXPIRÉ et SUPPRIMÉ — jamais de nouveau certificat pour ces statuts", async () => {
    expect(await isDomainAllowedForTls(domainByStatus.get("MISCONFIGURED")!)).toBe(false);
    expect(await isDomainAllowedForTls(domainByStatus.get("SUSPENDED")!)).toBe(false);
    expect(await isDomainAllowedForTls(domainByStatus.get("EXPIRED")!)).toBe(false);
    expect(await isDomainAllowedForTls(domainByStatus.get("REMOVED")!)).toBe(false);
  });

  it("isDomainAllowedForTls : refuse un domaine par ailleurs VERIFIED/ACTIVE si son TENANT est suspendu", async () => {
    expect(await isDomainAllowedForTls(activeDomainOfSuspendedTenant)).toBe(false);
  });

  it("isDomainAvailable : indisponible pour un domaine déjà enregistré, disponible sinon", async () => {
    expect(await isDomainAvailable(domainByStatus.get("ACTIVE")!)).toBe(false);
    expect(await isDomainAvailable(`libre-${suffix}.test-domains.example`)).toBe(true);
  });
});
