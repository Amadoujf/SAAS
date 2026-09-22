import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";

/**
 * Preuve dédiée que `PaymentWebhookEvent` est RÉELLEMENT protégée par Row-Level
 * Security — cette table n'avait ni `tenantId` ni policy avant l'étape 2
 * (clients/panier/commandes/livraison, 19 septembre 2026) : le tenant était résolu
 * via l'URL de callback mais jamais stocké, et aucune route HTTP ne l'atteignait
 * réellement avant cette étape (voir `packages/payments/src/webhook-processor.ts`).
 * Même méthode que `catalog-rls.test.ts`.
 *
 * Même politique que les autres suites DB : ignorée en local sans PostgreSQL,
 * obligatoire en CI via REQUIRE_DB_TESTS.
 */
let databaseAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch (error) {
  if (process.env.REQUIRE_DB_TESTS === "true") {
    throw new Error(
      "REQUIRE_DB_TESTS=true mais PostgreSQL est injoignable : la suite RLS des " +
        `événements webhook DOIT s'exécuter en CI. Cause : ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  databaseAvailable = false;
  // eslint-disable-next-line no-console
  console.warn("[payment-webhook-event-rls.test] Base de données injoignable — suite ignorée (skip).");
}

describe.skipIf(!databaseAvailable)("RLS réelle — PaymentWebhookEvent", () => {
  const suffix = Date.now();
  const sectorKey = `test-sector-webhook-rls-${suffix}`;
  let tenantAId: string;
  let tenantBId: string;
  let eventAId: string;

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.sector.create({
        data: { key: sectorKey, name: "Secteur de test", defaultModuleKeys: [], isSystem: false },
      });
      const tenantA = await tx.tenant.create({
        data: {
          slug: `test-webhook-rls-a-${suffix}`,
          name: "Boutique Webhook A",
          businessType: "ECOMMERCE",
          sectorKey,
          status: "ACTIVE",
        },
      });
      const tenantB = await tx.tenant.create({
        data: {
          slug: `test-webhook-rls-b-${suffix}`,
          name: "Boutique Webhook B",
          businessType: "ECOMMERCE",
          sectorKey,
          status: "ACTIVE",
        },
      });
      tenantAId = tenantA.id;
      tenantBId = tenantB.id;
    });

    await withTenant(tenantAId, async (tx) => {
      const event = await tx.paymentWebhookEvent.create({
        data: {
          tenantId: tenantAId,
          provider: "paydunya",
          eventId: `evt-rls-a-${suffix}`,
          payload: { ok: true },
          status: "received",
        },
      });
      eventAId = event.id;
    });
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_super_admin', 'true', true)`;
      await tx.paymentWebhookEvent.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await tx.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
      await tx.sector.deleteMany({ where: { key: sectorKey } });
    });
  });

  it("sans aucun contexte tenant (client Prisma nu) : ne renvoie rien", async () => {
    const results = await prisma.paymentWebhookEvent.findMany({ where: { id: eventAId } });
    expect(results).toHaveLength(0);
  });

  describe("avec le contexte du MAUVAIS tenant (withTenant(tenantB, ...))", () => {
    it("LECTURE par id exact échoue", async () => {
      const result = await withTenant(tenantBId, (tx) => tx.paymentWebhookEvent.findUnique({ where: { id: eventAId } }));
      expect(result).toBeNull();
    });

    it("MODIFICATION par id exact n'affecte aucune ligne", async () => {
      const result = await withTenant(tenantBId, (tx) =>
        tx.paymentWebhookEvent.updateMany({ where: { id: eventAId }, data: { status: "ignored" } }),
      );
      expect(result.count).toBe(0);
      const stillIntact = await withTenant(tenantAId, (tx) =>
        tx.paymentWebhookEvent.findUnique({ where: { id: eventAId } }),
      );
      expect(stillIntact?.status).toBe("received");
    });
  });

  it("le tenant A, lui, continue de voir normalement son propre événement (RLS ne bloque pas le bon contexte)", async () => {
    const event = await withTenant(tenantAId, (tx) => tx.paymentWebhookEvent.findUnique({ where: { id: eventAId } }));
    expect(event?.id).toBe(eventAId);
  });
});
