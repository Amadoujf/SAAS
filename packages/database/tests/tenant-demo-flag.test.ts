import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";
import { findDemoTenant } from "../src/demo-guard";
import { testOwnerClient } from "./test-owner-client";

/**
 * Données de démonstration séparées des entreprises réelles (PostgreSQL RÉEL) : le
 * statut `isDemo` n'est modifiable que par la plateforme, et les scripts de
 * démonstration ignorent une entreprise réelle portant le même sous-domaine.
 */
let databaseAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch (error) {
  if (process.env.REQUIRE_DB_TESTS === "true") {
    throw new Error(`REQUIRE_DB_TESTS=true mais PostgreSQL est injoignable : ${error instanceof Error ? error.message : String(error)}`);
  }
  databaseAvailable = false;
  // eslint-disable-next-line no-console
  console.warn("[tenant-demo-flag.test] Base de données injoignable — suite ignorée (skip).");
}

describe.skipIf(!databaseAvailable)("statut « démonstration » d'une entreprise", () => {
  const suffix = Math.random().toString(36).slice(2, 10);
  let realId: string;
  let demoId: string;

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      const data = (s: string, isDemo: boolean) => ({ slug: `test-demo-${s}-${suffix}`, name: `Entreprise ${s}`, businessType: "ECOMMERCE" as const, status: "ACTIVE" as const, isDemo });
      realId = (await tx.tenant.create({ data: data("reelle", false) })).id;
      demoId = (await tx.tenant.create({ data: data("demo", true) })).id;
    });
  });

  afterAll(async () => {
    const o = testOwnerClient();
    await o.tenant.deleteMany({ where: { id: { in: [realId, demoId] } } });
    await o.$disconnect();
  });

  it("une entreprise ne peut ni se déclarer démonstration, ni s'en retirer", async () => {
    await expect(withTenant(realId, (tx) => tx.tenant.update({ where: { id: realId }, data: { isDemo: true } }))).rejects.toThrow(/que par la plateforme/);
    await expect(withTenant(demoId, (tx) => tx.tenant.update({ where: { id: demoId }, data: { isDemo: false } }))).rejects.toThrow(/que par la plateforme/);
    // Ses autres réglages restent modifiables normalement.
    await withTenant(realId, (tx) => tx.tenant.update({ where: { id: realId }, data: { name: "Entreprise réelle renommée" } }));
  });

  it("les scripts de démonstration ignorent une entreprise réelle", async () => {
    expect(await findDemoTenant(`test-demo-reelle-${suffix}`)).toBeNull();
    expect(await findDemoTenant(`test-demo-demo-${suffix}`)).toEqual({ id: demoId });
    expect(await findDemoTenant(`absente-${suffix}`)).toBeNull();
  });
});
