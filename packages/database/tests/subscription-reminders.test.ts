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
  let tenantId: string;
  let ownerUserId: string;
  let planId: string;

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.sector.create({ data: { key: sectorKey, name: "Secteur de test", defaultModuleKeys: [], isSystem: false } });
      const tenant = await tx.tenant.create({
        data: { slug: `test-sub-reminders-${suffix}`, name: "Boutique Rappels", businessType: "ECOMMERCE", sectorKey, status: "ACTIVE" },
      });
      tenantId = tenant.id;

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

      // Rôle OWNER scopé à CE tenant de test — jamais une dépendance au rôle système
      // global (`SYSTEM_ROLES`, seedé séparément par `seed.ts`, pas garanti présent
      // dans une base de test isolée) : même discipline d'isolation que le reste des
      // fixtures de ce fichier.
      const ownerRole = await tx.role.create({
        data: { tenantId, name: "OWNER", isSystem: false, permissions: [] },
      });
      const owner = await tx.user.create({
        data: { email: `owner-reminders-${suffix}@test.local`, passwordHash: "test", fullName: "Propriétaire Test" },
      });
      ownerUserId = owner.id;
      await tx.tenantUser.create({ data: { tenantId, userId: owner.id, roleId: ownerRole.id, status: "ACTIVE" } });
    });
  });

  afterAll(async () => {
    const owner = testOwnerClient();
    try {
      await owner.subscriptionEvent.deleteMany({ where: { tenantId } });
    } finally {
      await owner.$disconnect();
    }
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_super_admin', 'true', true)`;
      await tx.tenantSubscription.deleteMany({ where: { tenantId } });
      await tx.tenantUser.deleteMany({ where: { tenantId } });
      await tx.user.deleteMany({ where: { id: ownerUserId } });
      await tx.role.deleteMany({ where: { tenantId } });
      await tx.subscriptionPlan.deleteMany({ where: { id: planId } });
      await tx.tenant.deleteMany({ where: { id: tenantId } });
      await tx.sector.deleteMany({ where: { key: sectorKey } });
    });
  });

  it("détecte le palier J-3 pour un abonnement ACTIVE dont l'échéance est dans 2 jours, et résout le contact du propriétaire", async () => {
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
    const subscription = await withTenant(tenantId, (tx) =>
      tx.tenantSubscription.create({
        data: {
          tenantId,
          planId,
          status: "ACTIVE",
          billingCycle: "MONTHLY",
          currentPeriodStart: new Date(Date.now() - 29 * 86_400_000),
          currentPeriodEnd: new Date(Date.now() + 60_000), // dans 1 minute -> palier J0.
        },
      }),
    );

    const before = await findDueBillingReminders(500);
    expect(before.some((r) => r.subscriptionId === subscription.id)).toBe(true);

    await markBillingReminderSentForTenant(tenantId, subscription.id, "J0");

    const after = await findDueBillingReminders(500);
    expect(after.some((r) => r.subscriptionId === subscription.id)).toBe(false);

    await withSuperAdminAccess((tx) => tx.tenantSubscription.deleteMany({ where: { id: subscription.id } }));
  });

  it("découvre une confirmation immédiate de suspension et ne la redécouvre jamais après notification", async () => {
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

    await withSuperAdminAccess((tx) => tx.tenantSubscription.deleteMany({ where: { id: subscription.id } }));
  });

  it("ne détecte aucun palier pour un abonnement dont l'échéance est encore loin (> 7 jours)", async () => {
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

    await withSuperAdminAccess((tx) => tx.tenantSubscription.deleteMany({ where: { id: subscription.id } }));
  });
});
