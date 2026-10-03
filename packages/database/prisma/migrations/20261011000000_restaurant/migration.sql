-- Étape 8 — Restauration (secteur restaurant) : carte (rubriques, plats, options), tables et
-- QR codes, commandes sur place / à emporter / livraison avec cuisine, encaissements réels
-- (jamais Chariow), réservations de table avec capacité en couverts.

-- CreateTable
CREATE TABLE "MenuSection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "availableFrom" INTEGER,
    "availableTo" INTEGER,

    CONSTRAINT "MenuSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dish" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "imageDemo" BOOLEAN NOT NULL DEFAULT false,
    "badges" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "prepMinutes" INTEGER NOT NULL DEFAULT 15,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DishOptionGroup" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dishId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minChoices" INTEGER NOT NULL DEFAULT 0,
    "maxChoices" INTEGER NOT NULL DEFAULT 1,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DishOptionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DishOption" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceDelta" INTEGER NOT NULL DEFAULT 0,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DishOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiningTable" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "seats" INTEGER NOT NULL,
    "zone" TEXT,
    "qrToken" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DiningTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "tableId" TEXT,
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "requestedFor" TIMESTAMPTZ(3),
    "deliveryAddress" TEXT,
    "note" TEXT,
    "subtotal" INTEGER NOT NULL,
    "deliveryFee" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'web',
    "accessToken" TEXT NOT NULL,
    "acceptedAt" TIMESTAMPTZ(3),
    "readyAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "canceledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "listingAvailabilityId" TEXT,

    CONSTRAINT "RestaurantOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantOrderItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "dishId" TEXT NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "options" JSONB NOT NULL DEFAULT '[]',
    "note" TEXT,
    "total" INTEGER NOT NULL,

    CONSTRAINT "RestaurantOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantOrderEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "changedBy" TEXT,
    "changedByType" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RestaurantOrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantPayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "paidAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedBy" TEXT,
    "voidedAt" TIMESTAMPTZ(3),
    "voidReason" TEXT,

    CONSTRAINT "RestaurantPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantTableBooking" (
    "reservationId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "partySize" INTEGER NOT NULL,
    "tableId" TEXT,
    "occasion" TEXT,

    CONSTRAINT "RestaurantTableBooking_pkey" PRIMARY KEY ("reservationId")
);

-- CreateTable
CREATE TABLE "RestaurantSettings" (
    "tenantId" TEXT NOT NULL,
    "openingHours" JSONB NOT NULL DEFAULT '[]',
    "acceptTakeaway" BOOLEAN NOT NULL DEFAULT true,
    "acceptDelivery" BOOLEAN NOT NULL DEFAULT true,
    "acceptDineInQr" BOOLEAN NOT NULL DEFAULT true,
    "deliveryFee" INTEGER NOT NULL DEFAULT 1000,
    "minDeliveryOrder" INTEGER NOT NULL DEFAULT 5000,
    "prepMinutes" INTEGER NOT NULL DEFAULT 25,
    "acceptBookings" BOOLEAN NOT NULL DEFAULT true,
    "maxCoversPerSlot" INTEGER NOT NULL DEFAULT 30,
    "bookingSlotMinutes" INTEGER NOT NULL DEFAULT 30,
    "bookingDuration" INTEGER NOT NULL DEFAULT 90,
    "maxPartySize" INTEGER NOT NULL DEFAULT 10,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantSettings_pkey" PRIMARY KEY ("tenantId")
);

-- CreateIndex
CREATE INDEX "MenuSection_tenantId_position_idx" ON "MenuSection"("tenantId", "position");

-- CreateIndex
CREATE INDEX "Dish_tenantId_sectionId_position_idx" ON "Dish"("tenantId", "sectionId", "position");

-- CreateIndex
CREATE INDEX "DishOptionGroup_tenantId_dishId_idx" ON "DishOptionGroup"("tenantId", "dishId");

-- CreateIndex
CREATE INDEX "DishOption_tenantId_groupId_idx" ON "DishOption"("tenantId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "DiningTable_qrToken_key" ON "DiningTable"("qrToken");

-- CreateIndex
CREATE UNIQUE INDEX "DiningTable_tenantId_label_key" ON "DiningTable"("tenantId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantOrder_accessToken_key" ON "RestaurantOrder"("accessToken");

-- CreateIndex
CREATE INDEX "RestaurantOrder_tenantId_status_createdAt_idx" ON "RestaurantOrder"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantOrder_tenantId_number_key" ON "RestaurantOrder"("tenantId", "number");

-- CreateIndex
CREATE INDEX "RestaurantOrderItem_tenantId_orderId_idx" ON "RestaurantOrderItem"("tenantId", "orderId");

-- CreateIndex
CREATE INDEX "RestaurantOrderEvent_tenantId_orderId_idx" ON "RestaurantOrderEvent"("tenantId", "orderId");

-- CreateIndex
CREATE INDEX "RestaurantPayment_tenantId_orderId_idx" ON "RestaurantPayment"("tenantId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantPayment_tenantId_receiptNumber_key" ON "RestaurantPayment"("tenantId", "receiptNumber");

-- CreateIndex
CREATE INDEX "RestaurantTableBooking_tenantId_idx" ON "RestaurantTableBooking"("tenantId");

-- AddForeignKey
ALTER TABLE "MenuSection" ADD CONSTRAINT "MenuSection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dish" ADD CONSTRAINT "Dish_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dish" ADD CONSTRAINT "Dish_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "MenuSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DishOptionGroup" ADD CONSTRAINT "DishOptionGroup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DishOptionGroup" ADD CONSTRAINT "DishOptionGroup_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DishOption" ADD CONSTRAINT "DishOption_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DishOption" ADD CONSTRAINT "DishOption_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "DishOptionGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiningTable" ADD CONSTRAINT "DiningTable_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantOrder" ADD CONSTRAINT "RestaurantOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantOrder" ADD CONSTRAINT "RestaurantOrder_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "DiningTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantOrder" ADD CONSTRAINT "RestaurantOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantOrder" ADD CONSTRAINT "RestaurantOrder_listingAvailabilityId_fkey" FOREIGN KEY ("listingAvailabilityId") REFERENCES "ListingAvailability"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantOrderItem" ADD CONSTRAINT "RestaurantOrderItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantOrderItem" ADD CONSTRAINT "RestaurantOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "RestaurantOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantOrderItem" ADD CONSTRAINT "RestaurantOrderItem_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantOrderEvent" ADD CONSTRAINT "RestaurantOrderEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantOrderEvent" ADD CONSTRAINT "RestaurantOrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "RestaurantOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantPayment" ADD CONSTRAINT "RestaurantPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantPayment" ADD CONSTRAINT "RestaurantPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "RestaurantOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantTableBooking" ADD CONSTRAINT "RestaurantTableBooking_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantTableBooking" ADD CONSTRAINT "RestaurantTableBooking_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantTableBooking" ADD CONSTRAINT "RestaurantTableBooking_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "DiningTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantSettings" ADD CONSTRAINT "RestaurantSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Intégrité métier
-- ---------------------------------------------------------------------------
ALTER TABLE "MenuSection" ADD CONSTRAINT "MenuSection_check" CHECK (
  length(trim("name")) BETWEEN 1 AND 80
  AND ("availableFrom" IS NULL) = ("availableTo" IS NULL)
  AND ("availableFrom" IS NULL OR ("availableFrom" BETWEEN 0 AND 1439 AND "availableTo" BETWEEN 1 AND 1440 AND "availableFrom" < "availableTo")));
ALTER TABLE "Dish" ADD CONSTRAINT "Dish_check" CHECK (
  length(trim("name")) BETWEEN 1 AND 120 AND "price" BETWEEN 0 AND 10000000 AND "prepMinutes" BETWEEN 0 AND 240
  AND "badges" <@ ARRAY['signature', 'spicy', 'vegetarian', 'new']::TEXT[]);
ALTER TABLE "DishOptionGroup" ADD CONSTRAINT "DishOptionGroup_check" CHECK (
  length(trim("name")) BETWEEN 1 AND 80 AND "minChoices" BETWEEN 0 AND 20 AND "maxChoices" BETWEEN 1 AND 20 AND "minChoices" <= "maxChoices");
ALTER TABLE "DishOption" ADD CONSTRAINT "DishOption_check" CHECK (
  length(trim("name")) BETWEEN 1 AND 80 AND "priceDelta" BETWEEN 0 AND 1000000);
ALTER TABLE "DiningTable" ADD CONSTRAINT "DiningTable_check" CHECK (
  length(trim("label")) BETWEEN 1 AND 20 AND "seats" BETWEEN 1 AND 40);
ALTER TABLE "RestaurantOrder" ADD CONSTRAINT "RestaurantOrder_mode_check" CHECK (
  ("mode" = 'dine_in' AND "tableId" IS NOT NULL AND "deliveryFee" = 0)
  OR ("mode" = 'takeaway' AND "tableId" IS NULL AND "deliveryFee" = 0)
  OR ("mode" = 'delivery' AND "tableId" IS NULL AND "deliveryAddress" IS NOT NULL AND length(trim("deliveryAddress")) > 0));
ALTER TABLE "RestaurantOrder" ADD CONSTRAINT "RestaurantOrder_status_check" CHECK (
  "status" IN ('new', 'accepted', 'preparing', 'ready', 'completed', 'canceled'));
ALTER TABLE "RestaurantOrder" ADD CONSTRAINT "RestaurantOrder_amounts_check" CHECK (
  "subtotal" >= 0 AND "deliveryFee" >= 0 AND "total" = "subtotal" + "deliveryFee");
ALTER TABLE "RestaurantOrderItem" ADD CONSTRAINT "RestaurantOrderItem_check" CHECK (
  "quantity" BETWEEN 1 AND 50 AND "unitPrice" >= 0 AND "total" = "unitPrice" * "quantity");
ALTER TABLE "RestaurantPayment" ADD CONSTRAINT "RestaurantPayment_check" CHECK (
  "amount" > 0 AND "method" IN ('cash', 'wave', 'orange_money', 'free_money', 'card', 'bank_transfer', 'other')
  AND ("voidedAt" IS NULL) = ("voidReason" IS NULL));
ALTER TABLE "RestaurantTableBooking" ADD CONSTRAINT "RestaurantTableBooking_check" CHECK ("partySize" BETWEEN 1 AND 60);
ALTER TABLE "RestaurantSettings" ADD CONSTRAINT "RestaurantSettings_check" CHECK (
  "deliveryFee" BETWEEN 0 AND 100000 AND "minDeliveryOrder" BETWEEN 0 AND 10000000 AND "prepMinutes" BETWEEN 5 AND 240
  AND "maxCoversPerSlot" BETWEEN 1 AND 1000 AND "bookingSlotMinutes" IN (15, 30, 60)
  AND "bookingDuration" BETWEEN 30 AND 360 AND "maxPartySize" BETWEEN 1 AND 60);

-- Même entreprise partout (clés composites, en plus de la RLS).
CREATE UNIQUE INDEX "MenuSection_tenantId_id_key" ON "MenuSection"("tenantId", "id");
CREATE UNIQUE INDEX "Dish_tenantId_id_key" ON "Dish"("tenantId", "id");
CREATE UNIQUE INDEX "DishOptionGroup_tenantId_id_key" ON "DishOptionGroup"("tenantId", "id");
CREATE UNIQUE INDEX "DiningTable_tenantId_id_key" ON "DiningTable"("tenantId", "id");
CREATE UNIQUE INDEX "RestaurantOrder_tenantId_id_key" ON "RestaurantOrder"("tenantId", "id");
ALTER TABLE "Dish" ADD CONSTRAINT "Dish_section_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "sectionId") REFERENCES "MenuSection"("tenantId", "id");
ALTER TABLE "DishOptionGroup" ADD CONSTRAINT "DishOptionGroup_dish_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "dishId") REFERENCES "Dish"("tenantId", "id");
ALTER TABLE "DishOption" ADD CONSTRAINT "DishOption_group_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "groupId") REFERENCES "DishOptionGroup"("tenantId", "id");
ALTER TABLE "RestaurantOrder" ADD CONSTRAINT "RestaurantOrder_table_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "tableId") REFERENCES "DiningTable"("tenantId", "id");
ALTER TABLE "RestaurantOrder" ADD CONSTRAINT "RestaurantOrder_customer_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "customerId") REFERENCES "Customer"("tenantId", "id");
ALTER TABLE "RestaurantOrderItem" ADD CONSTRAINT "RestaurantOrderItem_order_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "orderId") REFERENCES "RestaurantOrder"("tenantId", "id");
ALTER TABLE "RestaurantOrderItem" ADD CONSTRAINT "RestaurantOrderItem_dish_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "dishId") REFERENCES "Dish"("tenantId", "id");
ALTER TABLE "RestaurantOrderEvent" ADD CONSTRAINT "RestaurantOrderEvent_order_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "orderId") REFERENCES "RestaurantOrder"("tenantId", "id");
ALTER TABLE "RestaurantPayment" ADD CONSTRAINT "RestaurantPayment_order_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "orderId") REFERENCES "RestaurantOrder"("tenantId", "id");
ALTER TABLE "RestaurantTableBooking" ADD CONSTRAINT "RestaurantTableBooking_reservation_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "reservationId") REFERENCES "Reservation"("tenantId", "id");
ALTER TABLE "RestaurantTableBooking" ADD CONSTRAINT "RestaurantTableBooking_table_same_tenant_fkey"
  FOREIGN KEY ("tenantId", "tableId") REFERENCES "DiningTable"("tenantId", "id");

-- ---------------------------------------------------------------------------
-- Row-Level Security dès la création
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['MenuSection', 'Dish', 'DishOptionGroup', 'DishOption', 'DiningTable', 'RestaurantOrder',
                           'RestaurantOrderItem', 'RestaurantOrderEvent', 'RestaurantPayment', 'RestaurantTableBooking', 'RestaurantSettings'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (yamacommerce_tenant_isolation_check("tenantId"));', t);
  END LOOP;
END $$;

-- Historique des commandes : immuable. Lignes de commande : figées une fois créées.
REVOKE UPDATE, DELETE ON "RestaurantOrderEvent" FROM yamacommerce_app;
REVOKE UPDATE, DELETE ON "RestaurantOrderItem" FROM yamacommerce_app;
-- Encaissements : jamais supprimés ; seule l'annulation motivée est modifiable.
REVOKE UPDATE, DELETE ON "RestaurantPayment" FROM yamacommerce_app;
GRANT UPDATE ("voidedAt", "voidReason") ON "RestaurantPayment" TO yamacommerce_app;

-- La restauration a sa propre carte : plus de module « catalogue » par défaut.
UPDATE "Sector" SET "isAvailable" = true, "defaultModuleKeys" = ARRAY['table_reservations', 'qr_ordering', 'delivery_zones']::TEXT[]
 WHERE "key" = 'restaurant';
