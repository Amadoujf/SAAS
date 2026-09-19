-- ============================================================================
-- Catalogue réel — première tranche métier (revue du 18 septembre 2026, « produits
-- réels par entreprise : catégories, images de la médiathèque »). Cette migration
-- pose UNIQUEMENT le lien ProductImage -> MediaAsset : Category/Product/ProductVariant/
-- InventoryItem/StockMovement existent déjà depuis l'init (aucune colonne à ajouter),
-- seule ProductImage stockait une simple URL sans référence formelle à la médiathèque.
--
-- Écrite à la main (pas de shadow database disponible), même méthode que les
-- migrations précédentes de ce projet.
-- ============================================================================

ALTER TABLE "ProductImage" ADD COLUMN "mediaAssetId" TEXT;

CREATE INDEX "ProductImage_mediaAssetId_idx" ON "ProductImage"("mediaAssetId");

ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_mediaAssetId_fkey"
  FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
