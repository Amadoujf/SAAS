import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";
import { testOwnerClient } from "./test-owner-client";
import { addCartItem, getOrCreateActiveCart } from "../src/cart-registry";
import { convertCartToOrder, type ConvertCartToOrderInput } from "../src/order-registry";
import { releaseExpiredReservation } from "../src/order-reservation";
import {
  computeZoneShipping,
  createDeliveryZone,
  deleteDeliveryZone,
  quoteDeliveryForCart,
  updateCommerceSettings,
} from "../src/commerce-registry";
import {
  advanceOrderStatus,
  approveManualPayment,
  assignDeliverer,
  cancelOrderByCustomer,
  createDeliverer,
  findOrderForGuest,
  getCommerceOverview,
  getOrderDetailForTenant,
  getOrderForCustomer,
  listOrdersForTenant,
  rejectManualPayment,
  submitManualPaymentProof,
} from "../src/order-operations";
import { markNotificationOutcome, recordNotification } from "../src/notification-registry";

/**
 * Parcours e-commerce opérationnel (1er octobre 2026) contre PostgreSQL réel :
 * zones de livraison configurables (gratuité, encombrant, exclusions, zone inactive,
 * retrait désactivé), paiement manuel Wave/Orange Money (preuve, double validation
 * concurrente, refus, expiration), opérations dashboard (transitions interdites,
 * livraison, remboursement), accès client (invité, jeton, annulation) et isolation
 * entre entreprises.
 */
let databaseAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch (error) {
  if (process.env.REQUIRE_DB_TESTS === "true") {
    throw new Error(
      "REQUIRE_DB_TESTS=true mais PostgreSQL est injoignable : la suite opérations commerce " +
        `DOIT s'exécuter en CI. Cause : ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  databaseAvailable = false;
  // eslint-disable-next-line no-console
  console.warn("[commerce-operations.test] Base de données injoignable — suite ignorée (skip).");
}

describe.skipIf(!databaseAvailable)("Opérations commerce (livraison, paiement manuel, suivi)", () => {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const sectorKey = `test-sector-commerce-${suffix}`;
  let tenantId: string;
  let otherTenantId: string;
  let shopId: string;
  let variantId: string;
  let bulkyVariantId: string;
  let fragileVariantId: string;
  let fragileCategoryId: string;
  let dakarZoneId: string;
  let thiesZoneId: string;
  let phoneCounter = 0;

  function nextPhone() {
    phoneCounter += 1;
    return `+22177${String(Number(suffix.slice(-4)) * 100 + phoneCounter).padStart(7, "0").slice(-7)}`;
  }

  async function cartWith(lines: { variantId: string; quantity: number }[], forTenant = tenantId) {
    const visitorToken = `visiteur-${suffix}-${Math.random().toString(36).slice(2)}`;
    return withTenant(forTenant, async (tx) => {
      const cart = await getOrCreateActiveCart(tx, forTenant, visitorToken);
      for (const line of lines) await addCartItem(tx, forTenant, cart.id, { productVariantId: line.variantId, quantity: line.quantity });
      return cart.id;
    });
  }

  async function order(input: Partial<ConvertCartToOrderInput> & { lines?: { variantId: string; quantity: number }[] }) {
    const cartId = await cartWith(input.lines ?? [{ variantId, quantity: 1 }]);
    const phone = input.customer?.phone ?? nextPhone();
    const { order: created } = await withTenant(tenantId, (tx) =>
      convertCartToOrder(tx, tenantId, {
        cartId,
        customer: { firstName: "Awa", phone },
        deliveryMethod: input.deliveryMethod ?? "delivery",
        deliveryZoneId: input.deliveryMethod === "pickup" ? null : (input.deliveryZoneId ?? dakarZoneId),
        deliveryAddress: input.deliveryMethod === "pickup" ? null : { region: "Dakar", commune: "Plateau" },
        paymentMethod: input.paymentMethod ?? "cod",
      }),
    );
    return { order: created, phone };
  }

  async function manualOrderWithPayment(method: "manual_wave" | "manual_orange_money" = "manual_wave") {
    const created = await order({ paymentMethod: method });
    await withTenant(tenantId, (tx) =>
      tx.payment.create({
        data: {
          tenantId,
          orderId: created.order.id,
          provider: method === "manual_wave" ? "wave_direct" : "orange_money_direct",
          idempotencyKey: `pay_${created.order.id}_${Math.random()}`,
          amount: created.order.total,
          status: "PENDING",
        },
      }),
    );
    return created;
  }

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.sector.create({ data: { key: sectorKey, name: "Secteur de test", defaultModuleKeys: [], isSystem: false } });
      const tenant = await tx.tenant.create({
        data: { slug: `test-commerce-${suffix}`, name: "Boutique Opérations", businessType: "ECOMMERCE", sectorKey, status: "ACTIVE" },
      });
      tenantId = tenant.id;
      const other = await tx.tenant.create({
        data: { slug: `test-commerce-autre-${suffix}`, name: "Autre boutique", businessType: "ECOMMERCE", sectorKey, status: "ACTIVE" },
      });
      otherTenantId = other.id;
    });

    await withTenant(tenantId, async (tx) => {
      const shop = await tx.shop.create({ data: { tenantId, name: "Boutique principale", isMain: true } });
      shopId = shop.id;
      const category = await tx.category.create({ data: { tenantId, name: "Fragile", slug: `fragile-${suffix}` } });
      fragileCategoryId = category.id;

      const makeVariant = async (name: string, price: number, extra: Record<string, unknown> = {}) => {
        const product = await tx.product.create({
          data: { tenantId, name, slug: `${name.toLowerCase().replace(/\W+/g, "-")}-${suffix}`, basePrice: price, status: "PUBLISHED", ...extra },
        });
        const variant = await tx.productVariant.create({ data: { tenantId, productId: product.id, name: "Unique", price, attributes: {} } });
        await tx.inventoryItem.create({ data: { tenantId, productVariantId: variant.id, shopId: shop.id, availableQuantity: 100 } });
        return variant.id;
      };
      variantId = await makeVariant("Boubou brodé", 25_000);
      bulkyVariantId = await makeVariant("Fauteuil", 60_000, { isBulky: true });
      fragileVariantId = await makeVariant("Vase", 15_000, { categoryId: category.id });

      dakarZoneId = (await createDeliveryZone(tx, tenantId, { name: "Dakar express", region: "Dakar", fee: 2_000, freeThreshold: 50_000, bulkySurcharge: 3_000, estimatedDays: 1 })).id;
      thiesZoneId = (await createDeliveryZone(tx, tenantId, { region: "Thiès", fee: 4_000, excludedCategoryIds: [category.id], estimatedDays: 3 })).id;
    });
  });

  afterAll(async () => {
    const owner = testOwnerClient();
    try {
      for (const id of [tenantId, otherTenantId]) {
        await owner.notificationLog.deleteMany({ where: { tenantId: id } });
        await owner.auditLog.deleteMany({ where: { tenantId: id } });
        await owner.refund.deleteMany({ where: { tenantId: id } });
        await owner.delivery.deleteMany({ where: { tenantId: id } });
        await owner.deliverer.deleteMany({ where: { tenantId: id } });
        await owner.payment.deleteMany({ where: { tenantId: id } });
        await owner.orderStatusHistory.deleteMany({ where: { tenantId: id } });
        await owner.stockMovement.deleteMany({ where: { tenantId: id } });
        await owner.orderItem.deleteMany({ where: { tenantId: id } });
        await owner.order.deleteMany({ where: { tenantId: id } });
        await owner.cartItem.deleteMany({ where: { tenantId: id } });
        await owner.cart.deleteMany({ where: { tenantId: id } });
        await owner.customerAddress.deleteMany({ where: { tenantId: id } });
        await owner.customer.deleteMany({ where: { tenantId: id } });
        await owner.inventoryItem.deleteMany({ where: { tenantId: id } });
        await owner.productVariant.deleteMany({ where: { tenantId: id } });
        await owner.product.deleteMany({ where: { tenantId: id } });
        await owner.category.deleteMany({ where: { tenantId: id } });
        await owner.deliveryZone.deleteMany({ where: { tenantId: id } });
        await owner.commerceSettings.deleteMany({ where: { tenantId: id } });
        await owner.counter.deleteMany({ where: { tenantId: id } });
        await owner.shop.deleteMany({ where: { tenantId: id } });
        await owner.tenant.deleteMany({ where: { id } });
      }
      await owner.sector.deleteMany({ where: { key: sectorKey } });
    } finally {
      await owner.$disconnect();
    }
  });

  // --- Livraison -----------------------------------------------------------

  it("LIVRAISON GRATUITE : au-delà du seuil de la zone, les frais tombent à zéro", async () => {
    const small = await order({ lines: [{ variantId, quantity: 1 }] });
    expect(small.order.shippingTotal).toBe(2_000);
    const large = await order({ lines: [{ variantId, quantity: 2 }] });
    expect(large.order.subtotal).toBe(50_000);
    expect(large.order.shippingTotal).toBe(0);
    expect(large.order.total).toBe(50_000);
  });

  it("ENCOMBRANT : le supplément s'ajoute même quand la livraison est gratuite", async () => {
    const created = await order({ lines: [{ variantId: bulkyVariantId, quantity: 1 }] });
    expect(created.order.shippingTotal).toBe(3_000);
  });

  it("EXCLUSION PAR CATÉGORIE : une zone qui exclut une catégorie est refusée par le serveur et signalée au devis", async () => {
    const cartId = await cartWith([{ variantId: fragileVariantId, quantity: 1 }]);
    const quote = await withTenant(tenantId, (tx) => quoteDeliveryForCart(tx, tenantId, cartId));
    const thies = quote.zones.find((z) => z.id === thiesZoneId)!;
    expect(thies.available).toBe(false);
    expect(thies.fee).toBeNull();
    expect(quote.zones.find((z) => z.id === dakarZoneId)!.available).toBe(true);

    await expect(
      withTenant(tenantId, (tx) =>
        convertCartToOrder(tx, tenantId, {
          cartId,
          customer: { firstName: "Moussa", phone: nextPhone() },
          deliveryMethod: "delivery",
          deliveryZoneId: thiesZoneId,
          deliveryAddress: { region: "Thiès" },
          paymentMethod: "cod",
        }),
      ),
    ).rejects.toThrow(/pas livrable dans cette zone/);
  });

  it("DEVIS = FACTURATION : le montant affiché au checkout est exactement celui de la commande créée", async () => {
    const cartId = await cartWith([{ variantId: bulkyVariantId, quantity: 1 }, { variantId, quantity: 1 }]);
    const quote = await withTenant(tenantId, (tx) => quoteDeliveryForCart(tx, tenantId, cartId, "Dakar"));
    const zone = quote.zones.find((z) => z.id === dakarZoneId)!;
    const { order: created } = await withTenant(tenantId, (tx) =>
      convertCartToOrder(tx, tenantId, {
        cartId,
        customer: { firstName: "Fatou", phone: nextPhone() },
        deliveryMethod: "delivery",
        deliveryZoneId: dakarZoneId,
        deliveryAddress: { region: "Dakar" },
        paymentMethod: "cod",
      }),
    );
    expect(created.shippingTotal).toBe(zone.fee);
    expect(created.subtotal).toBe(quote.subtotal);
  });

  it("ZONE DÉSACTIVÉE : refusée à la commande, absente du devis ; une zone utilisée est désactivée plutôt que supprimée", async () => {
    const zone = await withTenant(tenantId, (tx) => createDeliveryZone(tx, tenantId, { region: "Louga", fee: 5_000 }));
    await order({ deliveryZoneId: zone.id });
    const result = await withTenant(tenantId, (tx) => deleteDeliveryZone(tx, tenantId, zone.id));
    expect(result).toEqual({ deleted: false, deactivated: true });

    const cartId = await cartWith([{ variantId, quantity: 1 }]);
    const quote = await withTenant(tenantId, (tx) => quoteDeliveryForCart(tx, tenantId, cartId));
    expect(quote.zones.some((z) => z.id === zone.id)).toBe(false);
    await expect(
      withTenant(tenantId, (tx) =>
        convertCartToOrder(tx, tenantId, {
          cartId,
          customer: { firstName: "Ibou", phone: nextPhone() },
          deliveryMethod: "delivery",
          deliveryZoneId: zone.id,
          deliveryAddress: { region: "Louga" },
          paymentMethod: "cod",
        }),
      ),
    ).rejects.toThrow(/plus disponible/);
  });

  it("RETRAIT EN BOUTIQUE : sans frais ; refusé côté serveur quand l'entreprise le désactive", async () => {
    const pickup = await order({ deliveryMethod: "pickup" });
    expect(pickup.order.shippingTotal).toBe(0);
    expect(pickup.order.deliveryMethod).toBe("pickup");

    await withTenant(tenantId, (tx) => updateCommerceSettings(tx, tenantId, { pickupEnabled: false }));
    try {
      await expect(order({ deliveryMethod: "pickup" })).rejects.toThrow(/retrait en boutique n'est pas proposé/);
    } finally {
      await withTenant(tenantId, (tx) => updateCommerceSettings(tx, tenantId, { pickupEnabled: true }));
    }
  });

  it("computeZoneShipping : logique pure (zone inactive, article non livrable)", () => {
    const zone = {
      id: "z", tenantId: "t", name: null, isActive: true, excludedCategoryIds: [], region: "Dakar", department: null,
      commune: null, neighborhood: null, fee: 1_000, freeThreshold: null, bulkySurcharge: 0, estimatedDays: null,
    };
    expect(computeZoneShipping(zone, { subtotal: 1, hasBulky: false, hasNonDeliverable: false, categoryIds: [] })).toMatchObject({ available: true, fee: 1_000 });
    expect(computeZoneShipping({ ...zone, isActive: false }, { subtotal: 1, hasBulky: false, hasNonDeliverable: false, categoryIds: [] })).toEqual({ available: false, reason: "inactive" });
    expect(computeZoneShipping(zone, { subtotal: 1, hasBulky: false, hasNonDeliverable: true, categoryIds: [] })).toEqual({ available: false, reason: "non_deliverable_item" });
  });

  // --- Paiement manuel -----------------------------------------------------

  it("PAIEMENT MANUEL : la commande reste EN ATTENTE après dépôt de preuve — jamais présentée comme payée", async () => {
    const { order: created } = await manualOrderWithPayment();
    expect(created.status).toBe("AWAITING_PAYMENT");
    expect(created.paymentMethod).toBe("manual_wave");
    // Fenêtre de réservation du paiement manuel (24 h par défaut), pas 30 minutes.
    expect(created.reservationExpiresAt!.getTime() - Date.now()).toBeGreaterThan(23 * 3_600_000);

    await withTenant(tenantId, (tx) => submitManualPaymentProof(tx, tenantId, created.id, created.accessToken, { reference: "WAVE-TX-8842" }));
    const after = await withTenant(tenantId, (tx) => tx.order.findUniqueOrThrow({ where: { id: created.id } }));
    expect(after.status).toBe("AWAITING_PAYMENT");
    expect(after.paymentStatus).toBe("UNPAID");
    expect(after.reservationExpiresAt).toBeNull(); // suspendue pendant la vérification.
  });

  it("PREUVE : refusée sans le bon jeton d'accès (un client ne peut pas agir sur la commande d'un autre)", async () => {
    const { order: created } = await manualOrderWithPayment();
    await expect(
      withTenant(tenantId, (tx) => submitManualPaymentProof(tx, tenantId, created.id, "jeton-deviné", { reference: "WAVE-1234" })),
    ).rejects.toThrow(/introuvable/);
  });

  it("DOUBLE VALIDATION CONCURRENTE : deux membres de l'équipe valident en même temps — une seule confirmation, stock commis une fois", async () => {
    const { order: created } = await manualOrderWithPayment();
    await withTenant(tenantId, (tx) => submitManualPaymentProof(tx, tenantId, created.id, created.accessToken, { reference: "WAVE-DOUBLE-1" }));
    const inventoryBefore = await withTenant(tenantId, (tx) => tx.inventoryItem.findFirstOrThrow({ where: { productVariantId: variantId, shopId } }));

    const results = await Promise.all(
      [1, 2, 3].map(() => withTenant(tenantId, (tx) => approveManualPayment(tx, tenantId, created.id, { userId: null, type: "owner" }))),
    );
    expect(results.filter((r) => r.outcome === "approved")).toHaveLength(1);
    expect(results.filter((r) => r.outcome === "already_approved")).toHaveLength(2);

    const final = await withTenant(tenantId, (tx) => tx.order.findUniqueOrThrow({ where: { id: created.id } }));
    expect(final.status).toBe("CONFIRMED");
    expect(final.paymentStatus).toBe("PAID");
    const inventoryAfter = await withTenant(tenantId, (tx) => tx.inventoryItem.findFirstOrThrow({ where: { productVariantId: variantId, shopId } }));
    expect(inventoryAfter.reservedQuantity).toBe(inventoryBefore.reservedQuantity - 1);
    const movements = await withTenant(tenantId, (tx) => tx.stockMovement.findMany({ where: { referenceId: created.id, type: "out" } }));
    expect(movements).toHaveLength(1);
  });

  it("VALIDATION sans preuve déposée : refusée (pas de « marquer payé » à l'aveugle)", async () => {
    const { order: created } = await manualOrderWithPayment();
    await expect(
      withTenant(tenantId, (tx) => approveManualPayment(tx, tenantId, created.id, { userId: null, type: "owner" })),
    ).rejects.toThrow(/Aucune preuve/);
  });

  it("REFUS : la preuve est rejetée avec un motif, l'échéance de réservation reprend, et le client peut redéposer", async () => {
    const { order: created } = await manualOrderWithPayment("manual_orange_money");
    await withTenant(tenantId, (tx) => submitManualPaymentProof(tx, tenantId, created.id, created.accessToken, { reference: "OM-0001" }));
    await withTenant(tenantId, (tx) => rejectManualPayment(tx, tenantId, created.id, { userId: null, type: "owner" }, "Montant reçu incomplet"));

    const view = await withTenant(tenantId, (tx) => getOrderForCustomer(tx, tenantId, created.id, created.accessToken));
    expect(view!.status).toBe("AWAITING_PAYMENT");
    expect(view!.payments[0]!.status).toBe("FAILED");
    expect(view!.payments[0]!.reviewNote).toBe("Montant reçu incomplet");
    const reloaded = await withTenant(tenantId, (tx) => tx.order.findUniqueOrThrow({ where: { id: created.id } }));
    expect(reloaded.reservationExpiresAt).not.toBeNull();

    await withTenant(tenantId, (tx) => submitManualPaymentProof(tx, tenantId, created.id, created.accessToken, { reference: "OM-0002" }));
    const outcome = await withTenant(tenantId, (tx) => approveManualPayment(tx, tenantId, created.id, { userId: null, type: "owner" }));
    expect(outcome.outcome).toBe("approved");
  });

  it("EXPIRATION : sans preuve, la réservation expirée est libérée ; une preuve tardive est alors refusée", async () => {
    const { order: created } = await manualOrderWithPayment();
    await withSuperAdminAccess((tx) => tx.order.update({ where: { id: created.id }, data: { reservationExpiresAt: new Date(Date.now() - 60_000) } }));
    expect((await releaseExpiredReservation(tenantId, created.id)).outcome).toBe("released");
    await expect(
      withTenant(tenantId, (tx) => submitManualPaymentProof(tx, tenantId, created.id, created.accessToken, { reference: "WAVE-TARD" })),
    ).rejects.toThrow(/expiré ou a été annulée/);
  });

  // --- Opérations dashboard ------------------------------------------------

  it("TRANSITIONS INTERDITES : impossible de sauter la validation du paiement ou de revenir en arrière", async () => {
    const { order: pending } = await manualOrderWithPayment();
    await expect(
      withTenant(tenantId, (tx) => advanceOrderStatus(tx, tenantId, pending.id, "PAID", { userId: null, type: "owner" })),
    ).rejects.toThrow(/validation d'un paiement/);
    await expect(
      withTenant(tenantId, (tx) => advanceOrderStatus(tx, tenantId, pending.id, "PREPARING", { userId: null, type: "owner" })),
    ).rejects.toThrow(/Transition interdite/);

    const { order: cod } = await order({});
    await withTenant(tenantId, (tx) => advanceOrderStatus(tx, tenantId, cod.id, "PREPARING", { userId: null, type: "owner" }));
    await expect(
      withTenant(tenantId, (tx) => advanceOrderStatus(tx, tenantId, cod.id, "CONFIRMED" as never, { userId: null, type: "owner" })),
    ).rejects.toThrow();
  });

  it("CYCLE COMPLET COD : préparation → expédition → livraison ; encaissement à la remise, livreur affecté, historique immuable", async () => {
    const { order: cod } = await order({});
    const deliverer = await withTenant(tenantId, (tx) => createDeliverer(tx, tenantId, { phone: "77 555 12 34", vehicleType: "moto" }));
    await withTenant(tenantId, (tx) => assignDeliverer(tx, tenantId, cod.id, deliverer.id, { userId: null, type: "owner" }));
    for (const status of ["PREPARING", "READY", "SHIPPED", "DELIVERED"] as const) {
      await withTenant(tenantId, (tx) => advanceOrderStatus(tx, tenantId, cod.id, status, { userId: null, type: "employee" }));
    }
    const detail = await withTenant(tenantId, (tx) => getOrderDetailForTenant(tx, tenantId, cod.id));
    expect(detail!.status).toBe("DELIVERED");
    expect(detail!.paymentStatus).toBe("PAID");
    expect(detail!.delivery!.status).toBe("delivered");
    expect(detail!.delivery!.deliverer!.phone).toBe("+221775551234");
    expect(detail!.delivery!.codAmountCollected).toBe(cod.total);
    expect(detail!.statusHistory.map((h) => h.toStatus)).toEqual(["NEW", "CONFIRMED", "PREPARING", "READY", "SHIPPED", "DELIVERED"]);

    await expect(
      withTenant(tenantId, (tx) => tx.orderStatusHistory.updateMany({ where: { orderId: cod.id }, data: { note: "falsifié" } })),
    ).rejects.toThrow();
  });

  it("REMBOURSEMENT : trace une demande (pending), jamais un remboursement présenté comme exécuté", async () => {
    const { order: created } = await manualOrderWithPayment();
    await withTenant(tenantId, (tx) => submitManualPaymentProof(tx, tenantId, created.id, created.accessToken, { reference: "WAVE-REFUND" }));
    await withTenant(tenantId, (tx) => approveManualPayment(tx, tenantId, created.id, { userId: null, type: "owner" }));
    await withTenant(tenantId, (tx) => advanceOrderStatus(tx, tenantId, created.id, "CANCELED", { userId: null, type: "owner" }));
    const refunds = await withTenant(tenantId, (tx) => tx.refund.findMany({ where: { orderId: created.id } }));
    // Une commande annulée après paiement reste à rembourser hors plateforme — aucun
    // remboursement « exécuté » n'est inventé par l'annulation.
    expect(refunds.every((r) => r.status === "pending")).toBe(true);
  });

  // --- Accès client --------------------------------------------------------

  it("COMMANDE INVITÉE : accès par numéro + téléphone ; aucune fuite si l'un des deux est faux", async () => {
    const { order: created, phone } = await order({});
    const ok = await withTenant(tenantId, (tx) => findOrderForGuest(tx, tenantId, created.orderNumber.toLowerCase(), phone.replace("+221", "")));
    expect(ok).toEqual({ orderId: created.id, accessToken: created.accessToken });
    expect(await withTenant(tenantId, (tx) => findOrderForGuest(tx, tenantId, created.orderNumber, "+221781112233"))).toBeNull();
    expect(await withTenant(tenantId, (tx) => findOrderForGuest(tx, tenantId, "CMD-1999-000001", phone))).toBeNull();
  });

  it("VUE CLIENT : jeton obligatoire, notes internes jamais exposées", async () => {
    const { order: created } = await order({});
    await withTenant(tenantId, (tx) => tx.order.update({ where: { id: created.id }, data: { internalNotes: "client difficile" } }));
    expect(await withTenant(tenantId, (tx) => getOrderForCustomer(tx, tenantId, created.id, "mauvais-jeton"))).toBeNull();
    const view = await withTenant(tenantId, (tx) => getOrderForCustomer(tx, tenantId, created.id, created.accessToken));
    expect(view).not.toBeNull();
    expect(JSON.stringify(view)).not.toContain("client difficile");
    expect("internalNotes" in view!).toBe(false);
  });

  it("ANNULATION CLIENT : possible avant préparation, refusée ensuite", async () => {
    const { order: early } = await order({});
    const canceled = await withTenant(tenantId, (tx) => cancelOrderByCustomer(tx, tenantId, early.id, early.accessToken));
    expect(canceled.status).toBe("CANCELED");

    const { order: late } = await order({});
    await withTenant(tenantId, (tx) => advanceOrderStatus(tx, tenantId, late.id, "PREPARING", { userId: null, type: "owner" }));
    await expect(withTenant(tenantId, (tx) => cancelOrderByCustomer(tx, tenantId, late.id, late.accessToken))).rejects.toThrow(/préparation/);
  });

  it("ISOLATION ENTRE ENTREPRISES : une autre entreprise ne voit ni ne modifie aucune commande", async () => {
    const { order: created } = await order({});
    const foreign = await withTenant(otherTenantId, (tx) => listOrdersForTenant(tx, otherTenantId));
    expect(foreign.total).toBe(0);
    // Même en forçant l'identifiant du tenant victime, la RLS du contexte courant bloque.
    const leaked = await withTenant(otherTenantId, (tx) => getOrderDetailForTenant(tx, tenantId, created.id));
    expect(leaked).toBeNull();
    await expect(
      withTenant(otherTenantId, (tx) => advanceOrderStatus(tx, tenantId, created.id, "PREPARING", { userId: null, type: "owner" })),
    ).rejects.toThrow(/introuvable/);
    await expect(
      withTenant(otherTenantId, (tx) => createDeliveryZone(tx, tenantId, { region: "Dakar", fee: 1 })),
    ).rejects.toThrow();
  });

  it("RECHERCHE ET FILES : par numéro, par téléphone, file « preuves à vérifier »", async () => {
    const { order: created, phone } = await manualOrderWithPayment();
    await withTenant(tenantId, (tx) => submitManualPaymentProof(tx, tenantId, created.id, created.accessToken, { reference: "WAVE-QUEUE" }));
    const byNumber = await withTenant(tenantId, (tx) => listOrdersForTenant(tx, tenantId, { search: created.orderNumber }));
    expect(byNumber.orders.map((o) => o.id)).toEqual([created.id]);
    const byPhone = await withTenant(tenantId, (tx) => listOrdersForTenant(tx, tenantId, { search: phone.slice(4) }));
    expect(byPhone.orders.map((o) => o.id)).toContain(created.id);
    const proofs = await withTenant(tenantId, (tx) => listOrdersForTenant(tx, tenantId, { status: "awaiting_proof" }));
    expect(proofs.orders.map((o) => o.id)).toContain(created.id);
  });

  it("VUE D'ENSEMBLE : indicateurs calculés depuis les commandes réelles", async () => {
    const overview = await withTenant(tenantId, (tx) => getCommerceOverview(tx, tenantId));
    expect(overview.todayOrders).toBeGreaterThan(5);
    expect(overview.revenue30).toBeGreaterThan(0);
    expect(overview.series).toHaveLength(14);
    expect(overview.series.at(-1)!.orders).toBeGreaterThan(0);
  });

  it("NOTIFICATIONS : « en file » n'est jamais « envoyée » sans résultat réel du worker", async () => {
    const { order: created } = await order({});
    const log = await withTenant(tenantId, (tx) =>
      recordNotification(tx, tenantId, { orderId: created.id, event: "order_received", audience: "customer", channel: "whatsapp", recipient: "+221770000000" }),
    );
    expect(log.status).toBe("queued");
    expect(log.sentAt).toBeNull();
    await withTenant(tenantId, (tx) => markNotificationOutcome(tx, tenantId, log.id, { status: "not_sent_no_provider", error: "WhatsApp non configuré" }));
    const reloaded = await withTenant(tenantId, (tx) => tx.notificationLog.findUniqueOrThrow({ where: { id: log.id } }));
    expect(reloaded.status).toBe("not_sent_no_provider");
    expect(reloaded.sentAt).toBeNull();
    await expect(
      withTenant(tenantId, (tx) => tx.notificationLog.update({ where: { id: log.id }, data: { status: "delivered_maybe" } })),
    ).rejects.toThrow();
  });
});
