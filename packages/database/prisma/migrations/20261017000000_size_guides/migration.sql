-- Guides des tailles modifiables (secteur Mode et vêtements, utilisable par tout commerce).

CREATE TABLE "SizeGuide" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "columns" TEXT[],
    "rows" JSONB NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SizeGuide_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SizeGuide_shape_check" CHECK (
      cardinality("columns") BETWEEN 2 AND 6
      AND jsonb_typeof("rows") = 'array'
      AND jsonb_array_length("rows") BETWEEN 1 AND 30
      AND char_length("name") BETWEEN 1 AND 80
    )
);
CREATE UNIQUE INDEX "SizeGuide_id_tenantId_key" ON "SizeGuide"("id", "tenantId");
CREATE UNIQUE INDEX "SizeGuide_tenantId_name_key" ON "SizeGuide"("tenantId", "name");
ALTER TABLE "SizeGuide" ADD CONSTRAINT "SizeGuide_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Category" ADD COLUMN "sizeGuideId" TEXT;
ALTER TABLE "Product" ADD COLUMN "sizeGuideId" TEXT;

-- Un guide ne peut être rattaché qu'à une catégorie ou un produit de la MÊME entreprise.
-- Suppression d'un guide utilisé refusée : l'application détache d'abord ses usages.
ALTER TABLE "Category" ADD CONSTRAINT "Category_size_guide_same_tenant_fkey"
  FOREIGN KEY ("sizeGuideId", "tenantId") REFERENCES "SizeGuide"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_size_guide_same_tenant_fkey"
  FOREIGN KEY ("sizeGuideId", "tenantId") REFERENCES "SizeGuide"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Category_sizeGuideId_idx" ON "Category"("sizeGuideId");
CREATE INDEX "Product_sizeGuideId_idx" ON "Product"("sizeGuideId");

ALTER TABLE "SizeGuide" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SizeGuide" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "SizeGuide" USING (yamacommerce_tenant_isolation_check("tenantId"));
