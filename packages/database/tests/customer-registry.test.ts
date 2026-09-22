import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";
import {
  addCustomerAddress,
  createCustomer,
  deleteCustomerAddress,
  getCustomerForTenant,
  listCustomerAddresses,
  listCustomers,
  resolveOrCreateCustomer,
  updateCustomer,
  updateCustomerAddress,
} from "../src/customer-registry";

/**
 * Vérifie le registre clients (étape 2 — clients/panier/commandes/livraison, 19
 * septembre 2026) contre PostgreSQL réel : CRUD, isolation entre entreprises (même
 * si `Customer` a une RLS Pattern A directe, `CustomerAddress` ne l'a reçue qu'à
 * cette étape), et surtout le dédoublonnage contrôlé par téléphone/e-mail exigé par
 * la revue — y compris sous concurrence RÉELLE pour le chemin téléphone.
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
      "REQUIRE_DB_TESTS=true mais PostgreSQL est injoignable : la suite clients " +
        `DOIT s'exécuter en CI. Cause : ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  databaseAvailable = false;
  // eslint-disable-next-line no-console
  console.warn("[customer-registry.test] Base de données injoignable — suite ignorée (skip).");
}

describe.skipIf(!databaseAvailable)("Registre des clients", () => {
  const suffix = Date.now();
  const sectorKey = `test-sector-customers-${suffix}`;
  let tenantAId: string;
  let tenantBId: string;

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.sector.create({
        data: { key: sectorKey, name: "Secteur de test", defaultModuleKeys: [], isSystem: false },
      });
      const tenantA = await tx.tenant.create({
        data: {
          slug: `test-customers-a-${suffix}`,
          name: "Boutique Clients A",
          businessType: "ECOMMERCE",
          sectorKey,
          status: "ACTIVE",
        },
      });
      const tenantB = await tx.tenant.create({
        data: {
          slug: `test-customers-b-${suffix}`,
          name: "Boutique Clients B",
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
      await tx.customerAddress.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await tx.customer.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await tx.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
      await tx.sector.deleteMany({ where: { key: sectorKey } });
    });
  });

  describe("CRUD de base", () => {
    let customerId: string;

    it("crée un client", async () => {
      const customer = await withTenant(tenantAId, (tx) =>
        createCustomer(tx, tenantAId, { firstName: "Awa", lastName: "Diop", phone: `+22177${suffix}` }),
      );
      customerId = customer.id;
      expect(customer.firstName).toBe("Awa");
      expect(customer.customerGroup).toBe("retail");
    });

    it("met à jour un client, y compris ses notes internes", async () => {
      const updated = await withTenant(tenantAId, (tx) =>
        updateCustomer(tx, tenantAId, customerId, { internalNotes: "Cliente fidèle, préfère la livraison le matin." }),
      );
      expect(updated.internalNotes).toBe("Cliente fidèle, préfère la livraison le matin.");
    });

    it("lit un client avec ses adresses et son historique de commandes", async () => {
      const found = await withTenant(tenantAId, (tx) => getCustomerForTenant(tx, tenantAId, customerId));
      expect(found?.id).toBe(customerId);
      expect(found?.addresses).toEqual([]);
      expect(found?.orders).toEqual([]);
    });

    it("liste les clients d'un tenant, avec recherche par nom/téléphone/e-mail", async () => {
      const all = await withTenant(tenantAId, (tx) => listCustomers(tx, tenantAId));
      expect(all.some((c) => c.id === customerId)).toBe(true);

      const found = await withTenant(tenantAId, (tx) => listCustomers(tx, tenantAId, { search: "Awa" }));
      expect(found.some((c) => c.id === customerId)).toBe(true);

      const notFound = await withTenant(tenantAId, (tx) => listCustomers(tx, tenantAId, { search: "Inexistant" }));
      expect(notFound).toHaveLength(0);
    });

    it("ISOLATION : le tenant B ne peut ni lire ni modifier un client du tenant A, même par id direct", async () => {
      const fromB = await withTenant(tenantBId, (tx) => getCustomerForTenant(tx, tenantBId, customerId));
      expect(fromB).toBeNull();

      await expect(
        withTenant(tenantBId, (tx) => updateCustomer(tx, tenantBId, customerId, { firstName: "Piraté" })),
      ).rejects.toThrow(/introuvable/);
    });

    it("refuse un doublon de téléphone à la création manuelle (dashboard) — erreur explicite, jamais une fusion silencieuse", async () => {
      await expect(
        withTenant(tenantAId, (tx) => createCustomer(tx, tenantAId, { firstName: "Autre", phone: `+22177${suffix}` })),
      ).rejects.toThrow();
    });

    it("le même téléphone reste réutilisable par UN AUTRE tenant (pas d'unicité globale)", async () => {
      const customerB = await withTenant(tenantBId, (tx) =>
        createCustomer(tx, tenantBId, { firstName: "Fatou", phone: `+22177${suffix}` }),
      );
      expect(customerB.phone).toBe(`+22177${suffix}`);
    });
  });

  describe("ADRESSES — RLS Pattern A depuis cette étape", () => {
    let customerId: string;
    let addressId: string;

    beforeAll(async () => {
      const customer = await withTenant(tenantAId, (tx) =>
        createCustomer(tx, tenantAId, { firstName: "Moussa", phone: `+22178${suffix}` }),
      );
      customerId = customer.id;
    });

    it("ajoute une adresse", async () => {
      const address = await withTenant(tenantAId, (tx) =>
        addCustomerAddress(tx, tenantAId, customerId, { region: "Dakar", commune: "Plateau", isDefault: true }),
      );
      addressId = address.id;
      expect(address.isDefault).toBe(true);
    });

    it("une seconde adresse par défaut retire le drapeau de la précédente", async () => {
      const second = await withTenant(tenantAId, (tx) =>
        addCustomerAddress(tx, tenantAId, customerId, { region: "Thiès", isDefault: true }),
      );
      const addresses = await withTenant(tenantAId, (tx) => listCustomerAddresses(tx, tenantAId, customerId));
      const first = addresses.find((a) => a.id === addressId);
      const last = addresses.find((a) => a.id === second.id);
      expect(first?.isDefault).toBe(false);
      expect(last?.isDefault).toBe(true);
    });

    it("ISOLATION : le tenant B ne peut ni lire ni modifier ni supprimer une adresse du tenant A", async () => {
      const fromB = await withTenant(tenantBId, (tx) => listCustomerAddresses(tx, tenantBId, customerId));
      expect(fromB).toHaveLength(0);

      await expect(
        withTenant(tenantBId, (tx) => updateCustomerAddress(tx, tenantBId, addressId, { region: "Ziguinchor" })),
      ).rejects.toThrow(/introuvable/);

      await expect(withTenant(tenantBId, (tx) => deleteCustomerAddress(tx, tenantBId, addressId))).rejects.toThrow(
        /introuvable/,
      );

      const stillThere = await withTenant(tenantAId, (tx) => listCustomerAddresses(tx, tenantAId, customerId));
      expect(stillThere.some((a) => a.id === addressId)).toBe(true);
    });

    it("supprime une adresse dans le bon tenant", async () => {
      await withTenant(tenantAId, (tx) => deleteCustomerAddress(tx, tenantAId, addressId));
      const addresses = await withTenant(tenantAId, (tx) => listCustomerAddresses(tx, tenantAId, customerId));
      expect(addresses.some((a) => a.id === addressId)).toBe(false);
    });
  });

  describe("DÉDOUBLONNAGE — resolveOrCreateCustomer (checkout, étape 2)", () => {
    it("téléphone déjà connu : réutilise la fiche existante, ne crée jamais de doublon", async () => {
      const phone = `+22176${suffix}`;
      const first = await withTenant(tenantAId, (tx) =>
        resolveOrCreateCustomer(tx, tenantAId, { firstName: "Ibrahima", phone }),
      );
      const second = await withTenant(tenantAId, (tx) =>
        resolveOrCreateCustomer(tx, tenantAId, { firstName: "Ibrahima (nouvelle commande)", phone }),
      );
      expect(second.id).toBe(first.id);
      // Le nom déjà connu n'est jamais écrasé silencieusement par un rejeu.
      expect(second.firstName).toBe("Ibrahima");

      const all = await withTenant(tenantAId, (tx) => tx.customer.findMany({ where: { tenantId: tenantAId, phone } }));
      expect(all).toHaveLength(1);
    });

    it("CONCURRENCE RÉELLE : plusieurs checkouts simultanés avec le même téléphone ne créent qu'UNE SEULE fiche", async () => {
      const phone = `+22175${suffix}`;
      const attempts = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          withTenant(tenantAId, (tx) => resolveOrCreateCustomer(tx, tenantAId, { firstName: `Client ${i}`, phone })),
        ),
      );
      const uniqueIds = new Set(attempts.map((c) => c.id));
      expect(uniqueIds.size).toBe(1);

      const all = await withTenant(tenantAId, (tx) => tx.customer.findMany({ where: { tenantId: tenantAId, phone } }));
      expect(all).toHaveLength(1);
    });

    it("pas de téléphone mais e-mail déjà connu : réutilise (best effort, non protégé par une contrainte DB)", async () => {
      const email = `client-${suffix}@example.test`;
      const first = await withTenant(tenantAId, (tx) =>
        resolveOrCreateCustomer(tx, tenantAId, { firstName: "Sans Téléphone", email }),
      );
      const second = await withTenant(tenantAId, (tx) => resolveOrCreateCustomer(tx, tenantAId, { firstName: "Rejeu", email }));
      expect(second.id).toBe(first.id);
    });

    it("ni téléphone ni e-mail : crée toujours une nouvelle fiche (rien à dédoublonner)", async () => {
      const first = await withTenant(tenantAId, (tx) => resolveOrCreateCustomer(tx, tenantAId, { firstName: "Anonyme" }));
      const second = await withTenant(tenantAId, (tx) => resolveOrCreateCustomer(tx, tenantAId, { firstName: "Anonyme" }));
      expect(second.id).not.toBe(first.id);
    });
  });
});
