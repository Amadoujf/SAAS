import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma, withSuperAdminAccess, withTenant, PrismaClient } from "@yamacommerce/database";
import { processSaasBillingWebhook } from "./webhook-processor";

/** Client Prisma élevé (rôle propriétaire), réservé au nettoyage — `SubscriptionEvent`
 *  a perdu UPDATE/DELETE pour le rôle applicatif (immuabilité, voir la migration
 *  `20260928000000_saas_billing_foundation`). Copie locale, même précédent que
 *  `packages/payments/src/webhook-processor.test.ts`. */
function testOwnerClient(): PrismaClient {
  return new PrismaClient({ datasources: { db: { url: process.env.MIGRATE_DATABASE_URL } } });
}

/**
 * Comble le même vide que `packages/payments/src/webhook-processor.test.ts`, pour le
 * domaine de facturation SaaS (voir docs/14-facturation-saas-abonnements.md) — teste
 * `processSaasBillingWebhook` de bout en bout contre PostgreSQL réel, avec
 * `ManualBillingAdapter` (jamais un vrai appel Chariow — voir `SAAS_BILLING_PROVIDER`).
 *
 * Différence structurelle avec les tests `packages/payments` : il n'existe PAS de
 * scénario "webhook adressé au mauvais tenant depuis l'URL", car cette architecture ne
 * route JAMAIS par un tenant déclaré dans l'URL — le tenant est TOUJOURS retrouvé via
 * `internalReference` (jeton aléatoire unique, non devinable) -> `BillingCheckoutSession
 * .tenantId`, jamais fait confiance autrement. La classe d'attaque testée ici est donc
 * différente : falsification du CONTENU d'un événement pourtant "vérifié" (montant
 * incohérent), rejeu, et référence interne inconnue/expirée.
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
      "REQUIRE_DB_TESTS=true mais PostgreSQL est injoignable : la suite billing webhook-processor " +
        `DOIT s'exécuter en CI. Cause : ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  databaseAvailable = false;
  // eslint-disable-next-line no-console
  console.warn("[billing/webhook-processor.test] Base de données injoignable — suite ignorée (skip).");
}

process.env.SAAS_BILLING_PROVIDER = "manual";

describe.skipIf(!databaseAvailable)("processSaasBillingWebhook (réel, PostgreSQL + ManualBillingAdapter)", () => {
  const suffix = Date.now();
  const sectorKey = `test-sector-billing-webhook-${suffix}`;
  let tenantId: string;
  let planId: string;
  let subscriptionId: string;

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.sector.create({
        data: { key: sectorKey, name: "Secteur de test facturation", defaultModuleKeys: [], isSystem: false },
      });
      const tenant = await tx.tenant.create({
        data: {
          slug: `test-billing-webhook-${suffix}`,
          name: "Boutique Facturation Webhook",
          businessType: "ECOMMERCE",
          sectorKey,
          status: "ACTIVE",
        },
      });
      tenantId = tenant.id;

      const plan = await tx.subscriptionPlan.create({
        data: {
          name: `Formule Test Webhook ${suffix}`,
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
          chariowMonthlyProductId: `chariow_prod_monthly_${suffix}`,
        },
      });
      planId = plan.id;
    });

    await withTenant(tenantId, async (tx) => {
      const subscription = await tx.tenantSubscription.create({
        data: {
          tenantId,
          planId,
          status: "PENDING",
          billingCycle: "MONTHLY",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(), // déjà "expiré" par construction : PENDING n'a jamais eu de période réelle.
        },
      });
      subscriptionId = subscription.id;
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
      await tx.subscriptionPayment.deleteMany({ where: { tenantId } });
      await tx.billingCheckoutSession.deleteMany({ where: { tenantId } });
      await tx.tenantSubscription.deleteMany({ where: { tenantId } });
      await tx.subscriptionPlan.deleteMany({ where: { id: planId } });
      await tx.tenant.deleteMany({ where: { id: tenantId } });
      await tx.sector.deleteMany({ where: { key: sectorKey } });
    });
  });

  async function createSession(overrides: Partial<{ amountXOF: number; currency: string; expiresAt: Date }> = {}) {
    return withTenant(tenantId, (tx) =>
      tx.billingCheckoutSession.create({
        data: {
          tenantId,
          subscriptionId,
          planId,
          billingCycle: "MONTHLY",
          provider: "manual",
          internalReference: `sub_checkout_test_${suffix}_${Math.random().toString(36).slice(2)}`,
          status: "PENDING",
          amountXOF: overrides.amountXOF ?? 15_000,
          currency: overrides.currency ?? "XOF",
          expiresAt: overrides.expiresAt ?? new Date(Date.now() + 30 * 60_000),
        },
      }),
    );
  }

  it("paiement valide confirmé : abonnement PENDING -> ACTIVE, période étendue, session CONFIRMED", async () => {
    const session = await createSession();

    const result = await processSaasBillingWebhook({
      headers: {},
      rawBody: JSON.stringify({
        providerSaleId: `sale_${suffix}_ok`,
        status: "succeeded",
        amountXOF: 15_000,
        currency: "XOF",
        internalReference: session.internalReference,
      }),
    });

    expect(result.status).toBe("processed");

    const subscription = await withTenant(tenantId, (tx) => tx.tenantSubscription.findUniqueOrThrow({ where: { id: subscriptionId } }));
    expect(subscription.status).toBe("ACTIVE");
    expect(subscription.currentPeriodEnd.getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000); // ~30 jours.

    const updatedSession = await withTenant(tenantId, (tx) => tx.billingCheckoutSession.findUniqueOrThrow({ where: { id: session.id } }));
    expect(updatedSession.status).toBe("CONFIRMED");

    const payment = await withTenant(tenantId, (tx) =>
      tx.subscriptionPayment.findFirstOrThrow({ where: { providerSaleId: `sale_${suffix}_ok` } }),
    );
    expect(payment.status).toBe("SUCCEEDED");
    expect(payment.periodExtensionDays).toBe(30);
  });

  it("REJEU (même providerSaleId) : ignored_duplicate, jamais une double extension", async () => {
    const before = await withTenant(tenantId, (tx) => tx.tenantSubscription.findUniqueOrThrow({ where: { id: subscriptionId } }));

    const session = await createSession();
    const result = await processSaasBillingWebhook({
      headers: {},
      rawBody: JSON.stringify({
        providerSaleId: `sale_${suffix}_ok`, // même vente que le test précédent.
        status: "succeeded",
        amountXOF: 15_000,
        currency: "XOF",
        internalReference: session.internalReference,
      }),
    });

    expect(result.status).toBe("ignored_duplicate");

    const after = await withTenant(tenantId, (tx) => tx.tenantSubscription.findUniqueOrThrow({ where: { id: subscriptionId } }));
    expect(after.currentPeriodEnd.getTime()).toBe(before.currentPeriodEnd.getTime()); // inchangé.
  });

  it("MONTANT INCOHÉRENT : rejeté, journalisé, abonnement inchangé", async () => {
    const before = await withTenant(tenantId, (tx) => tx.tenantSubscription.findUniqueOrThrow({ where: { id: subscriptionId } }));
    const session = await createSession({ amountXOF: 15_000 });

    const result = await processSaasBillingWebhook({
      headers: {},
      rawBody: JSON.stringify({
        providerSaleId: `sale_${suffix}_bad_amount`,
        status: "succeeded",
        amountXOF: 1, // ne correspond PAS aux 15 000 XOF attendus par la session.
        currency: "XOF",
        internalReference: session.internalReference,
      }),
    });

    expect(result.status).toBe("error");
    expect(result.reason).toBe("amount_or_currency_mismatch");

    const after = await withTenant(tenantId, (tx) => tx.tenantSubscription.findUniqueOrThrow({ where: { id: subscriptionId } }));
    expect(after.currentPeriodEnd.getTime()).toBe(before.currentPeriodEnd.getTime());

    const event = await withTenant(tenantId, (tx) =>
      tx.subscriptionEvent.findFirstOrThrow({ where: { type: "webhook_rejected_amount_mismatch", subscriptionId } }),
    );
    expect(event.actorType).toBe("webhook");
  });

  it("DEVISE INCOHÉRENTE (montant correct, devise différente) : rejeté, journalisé, abonnement inchangé", async () => {
    // Distinct du test « MONTANT INCOHÉRENT » ci-dessus : la garde teste
    // `amountXOF !== ... || currency !== ...` — envoyer un montant correct avec une
    // devise différente est la SEULE façon de prouver que la moitié « devise » de
    // cette condition est réellement vérifiée, et pas seulement la moitié « montant ».
    const before = await withTenant(tenantId, (tx) => tx.tenantSubscription.findUniqueOrThrow({ where: { id: subscriptionId } }));
    const session = await createSession({ amountXOF: 15_000, currency: "XOF" });

    const result = await processSaasBillingWebhook({
      headers: {},
      rawBody: JSON.stringify({
        providerSaleId: `sale_${suffix}_bad_currency`,
        status: "succeeded",
        amountXOF: 15_000, // montant correct...
        currency: "EUR", // ...mais devise différente de celle attendue par la session (XOF).
        internalReference: session.internalReference,
      }),
    });

    expect(result.status).toBe("error");
    expect(result.reason).toBe("amount_or_currency_mismatch");

    const after = await withTenant(tenantId, (tx) => tx.tenantSubscription.findUniqueOrThrow({ where: { id: subscriptionId } }));
    expect(after.currentPeriodEnd.getTime()).toBe(before.currentPeriodEnd.getTime());

    // `orderBy` — un second événement `webhook_rejected_amount_mismatch` existe déjà
    // pour cet abonnement (test « MONTANT INCOHÉRENT » ci-dessus) : le plus récent est
    // forcément celui-ci, exécuté ensuite dans le même fichier.
    const event = await withTenant(tenantId, (tx) =>
      tx.subscriptionEvent.findFirstOrThrow({
        where: { type: "webhook_rejected_amount_mismatch", subscriptionId },
        orderBy: { createdAt: "desc" },
      }),
    );
    expect(event.actorType).toBe("webhook");
    expect((event.payloadSnapshot as { received?: { currency?: string } })?.received?.currency).toBe("EUR");
  });

  it("PRODUIT INCOHÉRENT (identifiant Chariow différent de la formule+cycle attendus) : rejeté, journalisé, abonnement inchangé", async () => {
    const before = await withTenant(tenantId, (tx) => tx.tenantSubscription.findUniqueOrThrow({ where: { id: subscriptionId } }));
    const session = await createSession({ amountXOF: 15_000, currency: "XOF" });

    const result = await processSaasBillingWebhook({
      headers: {},
      rawBody: JSON.stringify({
        providerSaleId: `sale_${suffix}_bad_product`,
        status: "succeeded",
        amountXOF: 15_000,
        currency: "XOF",
        internalReference: session.internalReference,
        // Ne correspond PAS à `chariowMonthlyProductId` de la formule (voir beforeAll)
        // — un client ayant payé pour UNE AUTRE formule/produit chez Chariow ne doit
        // jamais activer CET abonnement-ci.
        providerProductId: "chariow_prod_totally_different",
      }),
    });

    expect(result.status).toBe("error");
    expect(result.reason).toBe("product_mismatch");

    const after = await withTenant(tenantId, (tx) => tx.tenantSubscription.findUniqueOrThrow({ where: { id: subscriptionId } }));
    expect(after.currentPeriodEnd.getTime()).toBe(before.currentPeriodEnd.getTime());

    const event = await withTenant(tenantId, (tx) =>
      tx.subscriptionEvent.findFirstOrThrow({ where: { type: "webhook_rejected_product_mismatch", subscriptionId } }),
    );
    expect(event.actorType).toBe("webhook");
  });

  it("RÉFÉRENCE INTERNE INCONNUE : rejeté, aucun effet", async () => {
    const result = await processSaasBillingWebhook({
      headers: {},
      rawBody: JSON.stringify({
        providerSaleId: `sale_${suffix}_unknown_ref`,
        status: "succeeded",
        amountXOF: 15_000,
        currency: "XOF",
        internalReference: "sub_checkout_does_not_exist",
      }),
    });

    expect(result.status).toBe("error");
    expect(result.reason).toBe("session_not_found");
  });

  it("ÉVÉNEMENT INVALIDE (champs requis manquants) : rejeté sans exception non gérée", async () => {
    const result = await processSaasBillingWebhook({ headers: {}, rawBody: JSON.stringify({ status: "succeeded" }) });
    expect(result.status).toBe("error");
    expect(result.reason).toBe("invalid_signature");
  });

  it("PAIEMENT EN ATTENTE (status pending) : journalisé, jamais une confirmation", async () => {
    const session = await createSession();

    const result = await processSaasBillingWebhook({
      headers: {},
      rawBody: JSON.stringify({
        providerSaleId: `sale_${suffix}_pending`,
        status: "pending",
        amountXOF: 15_000,
        currency: "XOF",
        internalReference: session.internalReference,
      }),
    });

    expect(result.status).toBe("processed");

    const updatedSession = await withTenant(tenantId, (tx) => tx.billingCheckoutSession.findUniqueOrThrow({ where: { id: session.id } }));
    expect(updatedSession.status).toBe("PENDING"); // pas confirmée par un statut "pending".

    const event = await withTenant(tenantId, (tx) =>
      tx.subscriptionEvent.findFirstOrThrow({ where: { type: "payment_pending", subscriptionId } }),
    );
    expect(event).toBeTruthy();
  });
});
