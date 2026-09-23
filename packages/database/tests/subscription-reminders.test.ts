import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";
import { testOwnerClient } from "./test-owner-client";
import { suspendSubscription } from "../src/subscription-registry";
import {
  findDueBillingReminders,
  markBillingReminderSentForTenant,
  findDueStatusChangeNotifications,
  markStatusChangeNotificationSent,
} from "../src/subscription-reminders";

/**
 * Vérifie la découverte des rappels d'échéance (M8) contre PostgreSQL réel — voir
 * docs/14-facturation-saas-abonnements.md. Couvre : détection du bon palier
 * (J-7/J-3/J-1/J0), idempotence (jamais un second rappel pour le même palier tant
 * que la période ne change pas), résolution du contact propriétaire, et les
 * confirmations immédiates de changement de statut.
 *
 * CORRECTION DE STABILISATION (22 septembre 2026) — trouvé en exécutant réellement
 * cette suite pour la première fois : un tenant partagé + suppression manuelle en fin
 * de test pour libérer `TenantSubscription.tenantId @unique` est fragile (un test qui
 * échoue avant sa ligne de nettoyage casse tous les suivants). Corrigé en donnant à
 * CHAQUE test son propre tenant dédié (le propriétaire/rôle/formule restent partagés,
 * aucune contrainte d'unicité ne s'y oppose).
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
      "REQUIRE_DB_TESTS=true mais PostgreSQL est injoignable : la suite subscription-reminders " +
        `DOIT s'exécuter en CI. Cause : ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  databaseAvailable = false;
  // eslint-disable-next-line no-console
  console.warn("[subscription-reminders.test] Base de données injoignable — suite ignorée (skip).");
}

describe.skipIf(!databaseAvailable)("Rappels d'échéance et confirmations de statut (réel, PostgreSQL)", () => {
  const suffix = Date.now();
  const sectorKey = `test-sector-subscription-reminders-${suffix}`;
  let planId: string;
  let ownerUserId: string;
  let tenantCounter = 0;
  const createdTenantIds: string[] = [];

  /** Un tenant DÉDIÉ par test, avec SON PROPRE rôle "OWNER" (nom exact, requis par le
   *  filtre `r.name = 'OWNER'` de `findDueBillingReminders`/`findDueStatusChangeNotifications`)
   *  — voir la note de tête de fichier. `Role.@@unique([tenantId, name])` autorise un
   *  "OWNER" par tenant sans jamais entrer en collision avec le rôle système global
   *  "OWNER" (`tenantId: null`) déjà seedé par `seed.ts` dans cette même base de test. */
  async function createTestTenant() {
    tenantCounter += 1;
    const tenant = await withSuperAdminAccess(async (tx) => {
      const created = await tx.tenant.create({
        data: {
          slug: `test-sub-reminders-${suffix}-${tenantCounter}`,
          name: "Boutique Rappels",
          businessType: "ECOMMERCE",
          sectorKey,
          status: "ACTIVE",
        },
      });
      const ownerRole = await tx.role.create({ data: { tenantId: created.id, name: "OWNER", isSystem: false, permissions: [] } });
      await tx.tenantUser.create({ data: { tenantId: created.id, userId: ownerUserId, roleId: ownerRole.id, status: "ACTIVE" } });
      return created;
    });
    createdTenantIds.push(tenant.id);
    return tenant.id;
  }

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.sector.create({ data: { key: sectorKey, name: "Secteur de test", defaultModuleKeys: [], isSystem: false } });

      const plan = await tx.subscriptionPlan.create({
        data: {
          name: `Formule Test Rappels ${suffix}`,
          status: "PUBLISHED",
          priceMonthly: 15_000,
          priceYearly: 150_000,
          maxProducts: 100,
          maxEmployees: 5,
          maxShops: 1,
          storageMB: 1024,
          maxAIGenerationsPerMonth: 100,
          maxAIImagesAnalyzedPerMonth: 100,
          maxAIProductsImportedPerMonth: 100,
        },
      });
      planId = plan.id;

      const owner = await tx.user.create({
        data: { email: `owner-reminders-${suffix}@test.local`, passwordHash: "test", fullName: "Propriétaire Test" },
      });
      ownerUserId = owner.id;
    });
  });

  afterAll(async () => {
    const owner = testOwnerClient();
    try {
      await owner.subscriptionEvent.deleteMany({ where: { tenantId: { in: createdTenantIds } } });
    } finally {
      await owner.$disconnect();
    }
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_super_admin', 'true', true)`;
      await tx.tenantSubscription.deleteMany({ where: { tenantId: { in: createdTenantIds } } });
      await tx.tenantUser.deleteMany({ where: { tenantId: { in: createdTenantIds } } });
      await tx.role.deleteMany({ where: { tenantId: { in: createdTenantIds } } });
      await tx.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
      await tx.user.deleteMany({ where: { id: ownerUserId } });
      await tx.subscriptionPlan.deleteMany({ where: { id: planId } });
      await tx.sector.deleteMany({ where: { key: sectorKey } });
    });
  });

  it("détecte le palier J-3 pour un abonnement ACTIVE dont l'échéance est dans 2 jours, et résout le contact du propriétaire", async () => {
    const tenantId = await createTestTenant();
    const subscription = await withTenant(tenantId, (tx) =>
      tx.tenantSubscription.create({
        data: {
          tenantId,
          planId,
          status: "ACTIVE",
          billingCycle: "MONTHLY",
          currentPeriodStart: new Date(Date.now() - 28 * 86_400_000),
          currentPeriodEnd: new Date(Date.now() + 2 * 86_400_000), // dans 2 jours -> palier J-3.
        },
      }),
    );

    const due = await findDueBillingReminders(500);
    const mine = due.find((r) => r.subscriptionId === subscription.id);
    expect(mine).toBeDefined();
    expect(mine?.milestone).toBe("J-3");
    expect(mine?.ownerEmail).toBe(`owner-reminders-${suffix}@test.local`);
    expect(mine?.tenantName).toBe("Boutique Rappels");
  });

  it("ne redécouvre jamais le même palier une fois marqué comme envoyé", async () => {
    const tenantId = await createTestTenant();
    const subscription = await withTenant(tenantId, (tx) =>
      tx.tenantSubscription.create({
        data: {
          tenantId,
          planId,
          status: "ACTIVE",
          billingCycle: "MONTHLY",
          currentPeriodStart: new Date(Date.now() - 30 * 86_400_000),
          // Échéance déjà dépassée d'1 minute -> `currentPeriodEnd <= NOW()` -> palier
          // J0 sans ambiguïté (contrairement à une échéance encore future de peu, qui
          // tomberait dans le palier J-1 — trouvé en exécutant réellement ce test pour
          // la première fois, correction de stabilisation du 22 septembre 2026).
          currentPeriodEnd: new Date(Date.now() - 60_000),
        },
      }),
    );

    const before = await findDueBillingReminders(500);
    expect(before.some((r) => r.subscriptionId === subscription.id)).toBe(true);

    await markBillingReminderSentForTenant(tenantId, subscription.id, "J0");

    const after = await findDueBillingReminders(500);
    expect(after.some((r) => r.subscriptionId === subscription.id)).toBe(false);
  });

  it("découvre une confirmation immédiate de suspension et ne la redécouvre jamais après notification", async () => {
    const tenantId = await createTestTenant();
    const subscription = await withTenant(tenantId, (tx) =>
      tx.tenantSubscription.create({
        data: {
          tenantId,
          planId,
          status: "GRACE_PERIOD",
          billingCycle: "MONTHLY",
          currentPeriodStart: new Date(Date.now() - 33 * 86_400_000),
          currentPeriodEnd: new Date(Date.now() - 3 * 86_400_000),
          graceEndsAt: new Date(Date.now() - 60_000),
        },
      }),
    );

    await withTenant(tenantId, (tx) =>
      suspendSubscription(tx, tenantId, subscription.id, { actorType: "system", justification: "Test rappel de suspension." }),
    );

    const due = await findDueStatusChangeNotifications(500);
    const mine = due.find((n) => n.subscriptionId === subscription.id && n.eventType === "suspended");
    expect(mine).toBeDefined();
    expect(mine?.ownerEmail).toBe(`owner-reminders-${suffix}@test.local`);

    await markStatusChangeNotificationSent(tenantId, subscription.id, mine!.eventId);

    const after = await findDueStatusChangeNotifications(500);
    expect(after.some((n) => n.eventId === mine!.eventId)).toBe(false);
  });

  it("ne détecte aucun palier pour un abonnement dont l'échéance est encore loin (> 7 jours)", async () => {
    const tenantId = await createTestTenant();
    const subscription = await withTenant(tenantId, (tx) =>
      tx.tenantSubscription.create({
        data: {
          tenantId,
          planId,
          status: "ACTIVE",
          billingCycle: "MONTHLY",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 20 * 86_400_000),
        },
      }),
    );

    const due = await findDueBillingReminders(500);
    expect(due.some((r) => r.subscriptionId === subscription.id)).toBe(false);
  });
});
