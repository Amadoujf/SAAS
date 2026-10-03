-- Budget IA de toute la plateforme (prévisualisation : plafond global mensuel).
-- Réservation atomique du coût maximal AVANT chaque appel au fournisseur, imputation du
-- coût réel (ou du maximum si le coût est inconnu) APRÈS : le plafond ne peut pas être
-- dépassé, même par des appels simultanés de plusieurs entreprises.

CREATE TABLE "AIPlatformBudget" (
    "periodMonth" TEXT NOT NULL,
    "spentXOF" INTEGER NOT NULL DEFAULT 0,
    "reservedXOF" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AIPlatformBudget_pkey" PRIMARY KEY ("periodMonth"),
    CONSTRAINT "AIPlatformBudget_amounts_check" CHECK ("spentXOF" >= 0 AND "reservedXOF" >= 0)
);

ALTER TABLE "AIGenerationJob" ADD COLUMN "reservedXOF" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AIGenerationJob" ADD COLUMN "budgetPeriod" TEXT;
ALTER TABLE "AIGenerationJob" ADD CONSTRAINT "AIGenerationJob_reservedXOF_check" CHECK ("reservedXOF" >= 0);

-- Table de la plateforme, sans entreprise : lisible et modifiable seulement en Super
-- Admin (jamais depuis le contexte d'une entreprise) ; aucune suppression.
ALTER TABLE "AIPlatformBudget" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AIPlatformBudget" FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_super_admin_only ON "AIPlatformBudget"
  USING (current_setting('app.is_super_admin', true) = 'true')
  WITH CHECK (current_setting('app.is_super_admin', true) = 'true');
REVOKE DELETE ON "AIPlatformBudget" FROM yamacommerce_app;
