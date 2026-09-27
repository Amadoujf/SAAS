-- Création et modification de site assistées par IA (27 septembre 2026) : suivi précis
-- de chaque appel (jetons, coût, échec, génération simulée en développement) et
-- garantie en base qu'une entreprise n'a jamais deux générations de site simultanées
-- (deux onglets, double clic) — la seconde est refusée, le brouillon n'est jamais
-- écrit par deux générations concurrentes.
ALTER TABLE "AIGenerationJob"
  ADD COLUMN "inputTokens" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "outputTokens" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "simulated" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "errorMessage" TEXT,
  ADD COLUMN "finishedAt" TIMESTAMP(3);

CREATE INDEX "AIGenerationJob_tenantId_type_createdAt_idx" ON "AIGenerationJob"("tenantId", "type", "createdAt");

CREATE UNIQUE INDEX "AIGenerationJob_one_site_job_in_progress"
  ON "AIGenerationJob"("tenantId")
  WHERE "status" = 'processing' AND "type" LIKE 'site\_%';
