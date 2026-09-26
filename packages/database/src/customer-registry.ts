import type { Prisma } from "@prisma/client";

/**
 * Persistance des clients — étape 2 (clients/panier/commandes/livraison, 19
 * septembre 2026). Même convention que `catalog-registry.ts` : chaque fonction
 * reçoit `tx` (déjà scoping-vérifié par `withTenant(tenantId, ...)`) ET `tenantId`
 * explicitement. `Customer` a une policy RLS Pattern A directe ; `CustomerAddress`
 * l'a reçue à cette même étape (dénormalisation `tenantId` depuis `Customer`, voir
 * la migration `20260926000000_orders_cart_delivery_foundation`) — chaque fonction
 * continue néanmoins de filtrer EXPLICITEMENT par `tenantId`, défense en profondeur,
 * même discipline que partout ailleurs dans ce projet.
 *
 * DEUX chemins de création distincts, volontairement séparés :
 * - `createCustomer` : création MANUELLE (dashboard, staff) — s'appuie sur la
 *   contrainte `@@unique([tenantId, phone])` et laisse remonter l'erreur en cas de
 *   doublon (même convention que le SKU produit) : un membre de l'équipe voit
 *   l'échec et peut retrouver la fiche existante au lieu d'en créer une seconde en
 *   silence.
 * - `resolveOrCreateCustomer` : dédoublonnage TRANSPARENT au moment du checkout
 *   (étape 2, M3) — un client qui repasse commande avec le même téléphone ne doit
 *   jamais produire une seconde fiche. Priorité : téléphone, protégé par l'index
 *   unique réel `@@unique([tenantId, phone])` — voir CORRECTION DE STABILISATION
 *   ci-dessous — puis, à défaut, e-mail (`findFirst` puis `create` — PAS protégé par
 *   une contrainte DB, donc un « best effort », pas une garantie sous concurrence :
 *   deux checkouts simultanés avec le même e-mail mais sans téléphone peuvent encore
 *   produire deux fiches — limite documentée).
 *
 * CORRECTION DE STABILISATION — bogue réel trouvé en exécutant la suite réelle sur
 * GitHub Actions (jamais reproduit localement) : la branche téléphone utilisait
 * `tx.customer.upsert(...)`, présumé « sûr sous concurrence » sur l'index unique réel
 * — un présupposé faux en pratique : sous une vraie course (5 checkouts simultanés
 * avec le même téléphone), Prisma a laissé remonter une violation de contrainte
 * unique (P2002) au lieu de la résoudre en interne. Remplacé par le même idiome déjà
 * établi ailleurs dans ce projet pour EXACTEMENT ce cas (voir `getOrCreateActiveCart`,
 * `getOrCreateSubscription`) : `create()` + capture de la violation P2002 + relecture
 * du gagnant — jamais un `upsert` pour une création dédupliquée sous concurrence
 * réelle.
 */

export interface CustomerInput {
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  customerGroup?: string;
  internalNotes?: string | null;
}

export async function createCustomer(tx: Prisma.TransactionClient, tenantId: string, input: CustomerInput) {
  return tx.customer.create({
    data: {
      tenantId,
      firstName: input.firstName,
      lastName: input.lastName ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      customerGroup: input.customerGroup ?? "retail",
      internalNotes: input.internalNotes ?? null,
    },
  });
}

export async function updateCustomer(
  tx: Prisma.TransactionClient,
  tenantId: string,
  id: string,
  input: Partial<CustomerInput>,
) {
  const { count } = await tx.customer.updateMany({ where: { id, tenantId }, data: input });
  if (count === 0) throw new Error(`updateCustomer : client "${id}" introuvable pour ce tenant.`);
  return tx.customer.findFirstOrThrow({ where: { id, tenantId } });
}

export async function getCustomerForTenant(tx: Prisma.TransactionClient, tenantId: string, id: string) {
  return tx.customer.findFirst({
    where: { id, tenantId },
    include: {
      addresses: true,
      orders: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
}

export interface ListCustomersFilter {
  search?: string;
}

export async function listCustomers(
  tx: Prisma.TransactionClient,
  tenantId: string,
  filter?: ListCustomersFilter,
) {
  return tx.customer.findMany({
    where: {
      tenantId,
      ...(filter?.search
        ? {
            OR: [
              { firstName: { contains: filter.search, mode: "insensitive" } },
              { lastName: { contains: filter.search, mode: "insensitive" } },
              { phone: { contains: filter.search } },
              { email: { contains: filter.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Dédoublonnage contrôlé par téléphone/e-mail — voir la note de tête de fichier.
 * Toujours appelée à l'intérieur d'une transaction `withTenant` déjà ouverte (ex.
 * checkout, M3), jamais en dehors.
 */
export async function resolveOrCreateCustomer(
  tx: Prisma.TransactionClient,
  tenantId: string,
  input: CustomerInput,
) {
  if (input.phone) {
    const phone = input.phone;
    const existing = await tx.customer.findUnique({ where: { tenantId_phone: { tenantId, phone } } });
    if (existing) {
      // Une commande existante ne doit jamais réécrire silencieusement le nom d'un
      // client déjà connu (ex. faute de frappe volontaire d'un tiers) — seul l'e-mail
      // est complété, jamais un champ déjà renseigné.
      return input.email ? tx.customer.update({ where: { id: existing.id }, data: { email: input.email } }) : existing;
    }
    try {
      return await tx.customer.create({
        data: {
          tenantId,
          firstName: input.firstName,
          lastName: input.lastName ?? null,
          email: input.email ?? null,
          phone,
          customerGroup: input.customerGroup ?? "retail",
        },
      });
    } catch (error) {
      // Un checkout concurrent avec le MÊME téléphone a gagné la course entre notre
      // lecture ci-dessus et notre tentative de création — voir CORRECTION DE
      // STABILISATION en tête de fichier.
      const winner = await tx.customer.findUnique({ where: { tenantId_phone: { tenantId, phone } } });
      if (!winner) throw error;
      return input.email ? tx.customer.update({ where: { id: winner.id }, data: { email: input.email } }) : winner;
    }
  }

  if (input.email) {
    const existing = await tx.customer.findFirst({ where: { tenantId, email: input.email } });
    if (existing) return existing;
  }

  return createCustomer(tx, tenantId, input);
}

// ============================================================================
// ADRESSES — RLS Pattern A depuis l'étape 2 (tenantId dénormalisé depuis Customer).
// ============================================================================

export interface CustomerAddressInput {
  label?: string | null;
  region: string;
  department?: string | null;
  commune?: string | null;
  neighborhood?: string | null;
  street?: string | null;
  geoLat?: number | null;
  geoLng?: number | null;
  isDefault?: boolean;
}

export async function addCustomerAddress(
  tx: Prisma.TransactionClient,
  tenantId: string,
  customerId: string,
  input: CustomerAddressInput,
) {
  const customer = await tx.customer.findFirst({ where: { id: customerId, tenantId } });
  if (!customer) throw new Error(`addCustomerAddress : client "${customerId}" introuvable pour ce tenant.`);

  if (input.isDefault) {
    await tx.customerAddress.updateMany({ where: { tenantId, customerId }, data: { isDefault: false } });
  }

  return tx.customerAddress.create({
    data: {
      tenantId,
      customerId,
      label: input.label ?? null,
      region: input.region,
      department: input.department ?? null,
      commune: input.commune ?? null,
      neighborhood: input.neighborhood ?? null,
      street: input.street ?? null,
      geoLat: input.geoLat ?? null,
      geoLng: input.geoLng ?? null,
      isDefault: input.isDefault ?? false,
    },
  });
}

export async function updateCustomerAddress(
  tx: Prisma.TransactionClient,
  tenantId: string,
  addressId: string,
  input: Partial<CustomerAddressInput>,
) {
  const address = await tx.customerAddress.findFirst({ where: { id: addressId, tenantId } });
  if (!address) throw new Error(`updateCustomerAddress : adresse "${addressId}" introuvable pour ce tenant.`);

  if (input.isDefault) {
    await tx.customerAddress.updateMany({
      where: { tenantId, customerId: address.customerId, id: { not: addressId } },
      data: { isDefault: false },
    });
  }

  return tx.customerAddress.update({ where: { id: addressId }, data: input });
}

export async function deleteCustomerAddress(tx: Prisma.TransactionClient, tenantId: string, addressId: string) {
  const { count } = await tx.customerAddress.deleteMany({ where: { id: addressId, tenantId } });
  if (count === 0) throw new Error(`deleteCustomerAddress : adresse "${addressId}" introuvable pour ce tenant.`);
}

export async function listCustomerAddresses(tx: Prisma.TransactionClient, tenantId: string, customerId: string) {
  return tx.customerAddress.findMany({
    where: { tenantId, customerId },
    orderBy: [{ isDefault: "desc" }, { label: "asc" }],
  });
}
