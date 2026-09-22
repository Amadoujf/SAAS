-- ============================================================================
-- Étape 2 : clients, panier, commandes, livraison — fondations.
--
-- 1. Cart/CartItem : nouvelles tables, RLS Pattern A dès la création (contrairement à
--    ProductVariant/InventoryItem/StockMovement à leur création initiale) + index
--    unique partiel "au plus un panier actif par visiteur".
-- 2. Renommage InventoryItem.quantity -> availableQuantity (accueille la réservation
--    atomique de commande — voir packages/database/src/order-registry.ts).
-- 3. Durcissement RLS des tables enfants déjà existantes et concernées par cette
--    étape (même précédent que 20260925000000_catalog_security_hardening) :
--    OrderItem, OrderStatusHistory (+ REVOKE UPDATE/DELETE, immuable), Delivery,
--    CustomerAddress, PaymentWebhookEvent (celle-ci sans backfill : table prouvée
--    vide, aucune route HTTP ne l'atteignait avant cette étape).
-- 4. Nouveaux champs : Customer.internalNotes, Order.{deliveryMethod,
--    reservationExpiresAt,accessToken}, Product.{isDeliverable,isBulky},
--    DeliveryZone.bulkySurcharge.
--
-- Écrite à la main (pas de shadow database disponible), même méthode que les
-- migrations précédentes de ce projet.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1a. Cart / CartItem
-- ----------------------------------------------------------------------------
CREATE TABLE "Cart" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "customerId" TEXT,
  "visitorToken" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "currency" TEXT NOT NULL DEFAULT 'XOF',
  "convertedOrderId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Cart_convertedOrderId_key" ON "Cart"("convertedOrderId");
CREATE INDEX "Cart_tenantId_idx" ON "Cart"("tenantId");
CREATE INDEX "Cart_tenantId_customerId_idx" ON "Cart"("tenantId", "customerId");
CREATE INDEX "Cart_tenantId_visitorToken_idx" ON "Cart"("tenantId", "visitorToken");

-- Au plus un panier ACTIF par (tenant, visiteur) — un visiteur accumule légitimement
-- plusieurs paniers historiques au fil de ses sessions, seul "active" doit être
-- exclusif. Non déclarable via `@@unique` côté Prisma (index partiel) : la création de
-- panier passe donc par `create()` + capture de l'erreur P2002 + `findFirst`, jamais un
-- `upsert` typé — voir cart-registry.ts.
CREATE UNIQUE INDEX "Cart_tenant_visitor_active_unique"
  ON "Cart"("tenantId", "visitorToken") WHERE "status" = 'active' AND "visitorToken" IS NOT NULL;

ALTER TABLE "Cart" ADD CONSTRAINT "Cart_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CartItem" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "cartId" TEXT NOT NULL,
  "productVariantId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CartItem_cartId_productVariantId_key" ON "CartItem"("cartId", "productVariantId");
CREATE INDEX "CartItem_tenantId_idx" ON "CartItem"("tenantId");

ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey"
  FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productVariantId_fkey"
  FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY['Cart', 'CartItem'];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', tbl);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (yamacommerce_tenant_isolation_check("tenantId"));',
      tbl
    );
  END LOOP;
END
$$;

-- ----------------------------------------------------------------------------
-- 1b. Renommage InventoryItem.quantity -> availableQuantity (+ CHECK renommé).
-- ----------------------------------------------------------------------------
ALTER TABLE "InventoryItem" RENAME COLUMN "quantity" TO "availableQuantity";
ALTER TABLE "InventoryItem" RENAME CONSTRAINT "InventoryItem_quantity_non_negative" TO "InventoryItem_availableQuantity_non_negative";

-- ----------------------------------------------------------------------------
-- 2. Nouveaux champs simples.
-- ----------------------------------------------------------------------------
ALTER TABLE "Customer" ADD COLUMN "internalNotes" TEXT;

ALTER TABLE "Order" ADD COLUMN "deliveryMethod" TEXT NOT NULL DEFAULT 'delivery';
ALTER TABLE "Order" ADD COLUMN "reservationExpiresAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "accessToken" TEXT;
UPDATE "Order" SET "accessToken" = gen_random_uuid()::text WHERE "accessToken" IS NULL;
ALTER TABLE "Order" ALTER COLUMN "accessToken" SET NOT NULL;
CREATE UNIQUE INDEX "Order_accessToken_key" ON "Order"("accessToken");

ALTER TABLE "Product" ADD COLUMN "isDeliverable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Product" ADD COLUMN "isBulky" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "DeliveryZone" ADD COLUMN "bulkySurcharge" INTEGER NOT NULL DEFAULT 0;

-- ----------------------------------------------------------------------------
-- 3. Durcissement RLS des tables enfants existantes concernées par cette étape —
--    dénormaliser tenantId depuis le parent, backfill, FK+index, policy Pattern A.
--    Le filtrage applicatif explicite déjà en place reste EN PLUS (défense en
--    profondeur), jamais retiré.
-- ----------------------------------------------------------------------------
ALTER TABLE "OrderItem" ADD COLUMN "tenantId" TEXT;
UPDATE "OrderItem" AS oi SET "tenantId" = o."tenantId" FROM "Order" AS o WHERE o."id" = oi."orderId";
ALTER TABLE "OrderItem" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "OrderStatusHistory" ADD COLUMN "tenantId" TEXT;
UPDATE "OrderStatusHistory" AS h SET "tenantId" = o."tenantId" FROM "Order" AS o WHERE o."id" = h."orderId";
ALTER TABLE "OrderStatusHistory" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "Delivery" ADD COLUMN "tenantId" TEXT;
UPDATE "Delivery" AS d SET "tenantId" = o."tenantId" FROM "Order" AS o WHERE o."id" = d."orderId";
ALTER TABLE "Delivery" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "CustomerAddress" ADD COLUMN "tenantId" TEXT;
UPDATE "CustomerAddress" AS a SET "tenantId" = c."tenantId" FROM "Customer" AS c WHERE c."id" = a."customerId";
ALTER TABLE "CustomerAddress" ALTER COLUMN "tenantId" SET NOT NULL;

-- PaymentWebhookEvent : aucune route HTTP ne l'atteignait avant cette étape (voir
-- webhook-processor.ts, jamais invoqué depuis apps/web) — la table est prouvée vide,
-- NOT NULL direct sans backfill.
ALTER TABLE "PaymentWebhookEvent" ADD COLUMN "tenantId" TEXT NOT NULL;

ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentWebhookEvent" ADD CONSTRAINT "PaymentWebhookEvent_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "OrderItem_tenantId_idx" ON "OrderItem"("tenantId");
CREATE INDEX "OrderStatusHistory_tenantId_idx" ON "OrderStatusHistory"("tenantId");
CREATE INDEX "Delivery_tenantId_idx" ON "Delivery"("tenantId");
CREATE INDEX "CustomerAddress_tenantId_idx" ON "CustomerAddress"("tenantId");
CREATE INDEX "PaymentWebhookEvent_tenantId_idx" ON "PaymentWebhookEvent"("tenantId");

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY['OrderItem', 'OrderStatusHistory', 'Delivery', 'CustomerAddress', 'PaymentWebhookEvent'];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', tbl);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (yamacommerce_tenant_isolation_check("tenantId"));',
      tbl
    );
  END LOOP;
END
$$;

-- ----------------------------------------------------------------------------
-- 4. Immutabilité de l'historique des transitions de commande — aucun code de ce
--    projet ne modifie ni ne supprime jamais une ligne OrderStatusHistory (voir
--    order-status.ts, `transitionOrderStatus` : seulement des `create`). Même
--    garantie et même justification que StockMovement.
-- ----------------------------------------------------------------------------
REVOKE UPDATE, DELETE ON "OrderStatusHistory" FROM yamacommerce_app;
