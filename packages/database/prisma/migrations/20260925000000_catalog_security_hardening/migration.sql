-- ============================================================================
-- Corrections de sécurité du catalogue (revue du 18 septembre 2026, « le filtrage
-- applicatif ne doit pas être l'unique protection »).
--
-- 1. Dénormalise "tenantId" sur ProductVariant/InventoryItem/StockMovement (la piste
--    de durcissement déjà documentée dans la migration RLS initiale, lignes 158-176 :
--    "dénormaliser une colonne tenantId... pour leur appliquer directement le
--    Pattern A") et pose une VRAIE policy RLS dessus — le filtrage applicatif
--    explicite déjà en place dans catalog-registry.ts (jointures vers Product/Shop)
--    reste EN PLUS, jamais retiré : défense en profondeur, pas une substitution.
-- 2. Unicité du SKU par tenant (Product ET ProductVariant) — NULL reste autorisé
--    plusieurs fois (comportement natif d'un index unique Postgres), seul un SKU
--    réellement renseigné doit être unique.
-- 3. CHECK (quantity >= 0) sur InventoryItem — le stock négatif doit être
--    structurellement impossible, pas seulement empêché par `adjustStock`.
-- 4. StockMovement rendue IMMUABLE au niveau base : le rôle applicatif perd les
--    droits UPDATE/DELETE sur cette table (aucun code de ce projet n'en a jamais eu
--    besoin — l'historique des mouvements ne doit jamais pouvoir être réécrit).
--
-- Écrite à la main (pas de shadow database disponible), même méthode que les
-- migrations précédentes de ce projet.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1a. Colonnes tenantId (nullable pour permettre le backfill), puis backfill
--     depuis le parent tenant-scopé, puis NOT NULL.
-- ----------------------------------------------------------------------------
ALTER TABLE "ProductVariant" ADD COLUMN "tenantId" TEXT;
UPDATE "ProductVariant" AS pv SET "tenantId" = p."tenantId" FROM "Product" AS p WHERE p."id" = pv."productId";
ALTER TABLE "ProductVariant" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "InventoryItem" ADD COLUMN "tenantId" TEXT;
UPDATE "InventoryItem" AS ii SET "tenantId" = pv."tenantId" FROM "ProductVariant" AS pv WHERE pv."id" = ii."productVariantId";
ALTER TABLE "InventoryItem" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "StockMovement" ADD COLUMN "tenantId" TEXT;
UPDATE "StockMovement" AS sm SET "tenantId" = ii."tenantId" FROM "InventoryItem" AS ii WHERE ii."id" = sm."inventoryItemId";
ALTER TABLE "StockMovement" ALTER COLUMN "tenantId" SET NOT NULL;

-- ----------------------------------------------------------------------------
-- 1b. Contraintes de clé étrangère + index (même convention que le reste du schéma).
-- ----------------------------------------------------------------------------
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "ProductVariant_tenantId_idx" ON "ProductVariant"("tenantId");
CREATE INDEX "InventoryItem_tenantId_idx" ON "InventoryItem"("tenantId");
CREATE INDEX "StockMovement_tenantId_idx" ON "StockMovement"("tenantId");

-- ----------------------------------------------------------------------------
-- 2. Unicité du SKU par tenant.
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX "Product_tenantId_sku_key" ON "Product"("tenantId", "sku");
CREATE UNIQUE INDEX "ProductVariant_tenantId_sku_key" ON "ProductVariant"("tenantId", "sku");

-- ----------------------------------------------------------------------------
-- 3. Stock jamais négatif, structurellement.
-- ----------------------------------------------------------------------------
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_quantity_non_negative" CHECK ("quantity" >= 0);

-- ----------------------------------------------------------------------------
-- 4. Row-Level Security (Pattern A) sur les trois tables — voir
--    yamacommerce_tenant_isolation_check, définie par
--    20260912000001_enable_row_level_security/migration.sql.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY['ProductVariant', 'InventoryItem', 'StockMovement'];
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
-- 5. Immutabilité de l'historique des mouvements de stock — aucun code de ce projet
--    ne modifie ni ne supprime jamais une ligne StockMovement (voir catalog-
--    registry.ts, `adjustStock` : seulement des `create`). Retirer les droits au
--    niveau du rôle applicatif rend cette garantie robuste à un futur bug, pas
--    seulement à la discipline actuelle du code.
-- ----------------------------------------------------------------------------
REVOKE UPDATE, DELETE ON "StockMovement" FROM yamacommerce_app;
