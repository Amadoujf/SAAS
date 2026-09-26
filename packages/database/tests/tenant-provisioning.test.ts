import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../src/client";
import { withTenant } from "../src/tenant-context";
import { testOwnerClient } from "./test-owner-client";
import { createOwnerAccount, isSubdomainTaken, provisionTenantForOwner, ProvisioningError } from "../src/tenant-provisioning";

/** Onboarding public contre PostgreSQL réel : entreprise complète créée en une
 *  transaction, adresse et e-mail uniques, isolation du nouveau tenant. */
let databaseAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch (error) {
  if (process.env.REQUIRE_DB_TESTS === "true") throw new Error(`REQUIRE_DB_TESTS=true mais PostgreSQL est injoignable : ${String(error)}`);
  databaseAvailable = false;
}

describe.skipIf(!databaseAvailable)("Provisionnement d'une entreprise (onboarding)", () => {
  const suffix = `${Date.now()}`.slice(-8);
  const email = `proprio-${suffix}@exemple.sn`;
  const subdomain = `boutique-test-${suffix}`;
  const tenantIds: string[] = [];
  const userIds: string[] = [];

  afterAll(async () => {
    const owner = testOwnerClient();
    try {
      for (const id of tenantIds) {
        for (const model of ["tenantModule", "paymentProviderConfig", "shop", "tenantUser", "tenantSubscription", "domain"] as const) {
          await (owner[model] as unknown as { deleteMany: (a: unknown) => Promise<unknown> }).deleteMany({ where: { tenantId: id } });
        }
        await owner.tenant.deleteMany({ where: { id } });
      }
      await owner.user.deleteMany({ where: { id: { in: userIds } } });
    } finally {
      await owner.$disconnect();
    }
  });

  it("crée compte + entreprise ACTIVE, sous-domaine, essai, propriétaire OWNER, paiement à la livraison", async () => {
    const user = await createOwnerAccount({ email, fullName: "Ndèye Test", password: "motdepasse-solide" });
    userIds.push(user.id);
    const result = await provisionTenantForOwner({ ownerUserId: user.id, name: "Boutique Test", subdomain, subdomainSuffix: "yamacommerce.ai", sectorKey: "fashion", templatePreference: "teranga-atelier" });
    tenantIds.push(result.tenantId);
    expect(result.domain).toBe(`${subdomain}.yamacommerce.ai`);
    const data = await withTenant(result.tenantId, async (tx) => ({
      tenant: await tx.tenant.findUniqueOrThrow({ where: { id: result.tenantId } }),
      sub: await tx.tenantSubscription.findUniqueOrThrow({ where: { tenantId: result.tenantId } }),
      member: await tx.tenantUser.findFirstOrThrow({ where: { tenantId: result.tenantId }, include: { role: true } }),
      cod: await tx.paymentProviderConfig.findFirstOrThrow({ where: { tenantId: result.tenantId, provider: "cod" } }),
      modules: await tx.tenantModule.count({ where: { tenantId: result.tenantId, isEnabled: true } }),
    }));
    expect(data.tenant.status).toBe("ACTIVE");
    expect(data.tenant.sectorKey).toBe("fashion");
    expect((data.tenant.branding as { templatePreference?: string }).templatePreference).toBe("teranga-atelier");
    expect(data.sub.status).toBe("TRIALING");
    expect(data.member.role.name).toBe("OWNER");
    expect(data.cod.isEnabled).toBe(true);
    expect(data.modules).toBeGreaterThan(0);
    expect(await isSubdomainTaken(subdomain, "yamacommerce.ai")).toBe(true);
  });

  it("refuse un sous-domaine déjà pris et un e-mail déjà utilisé, sans rien créer à moitié", async () => {
    const other = await createOwnerAccount({ email: `autre-${email}`, fullName: "Autre", password: "motdepasse-solide" });
    userIds.push(other.id);
    const before = await testOwnerClient().tenant.count();
    await expect(provisionTenantForOwner({ ownerUserId: other.id, name: "Copie", subdomain, subdomainSuffix: "yamacommerce.ai", sectorKey: "fashion" })).rejects.toBeInstanceOf(ProvisioningError);
    expect(await testOwnerClient().tenant.count()).toBe(before);
    await expect(createOwnerAccount({ email: email.toUpperCase(), fullName: "Doublon", password: "motdepasse-solide" })).rejects.toThrow(/existe déjà/);
  });
});
