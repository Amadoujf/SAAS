-- Entreprises de démonstration créées par le seed de base (tests d'isolation) avant
-- l'existence de la colonne `isDemo` : reconnues par leur compte propriétaire de
-- démonstration (jamais par le seul sous-domaine, qu'une vraie entreprise pourrait
-- porter). Contexte plateforme requis par le déclencheur `tenant_demo_guard`.
SELECT set_config('app.is_super_admin', 'true', true);

UPDATE "Tenant" t SET "isDemo" = true
WHERE t."slug" IN ('boutique-aida', 'teranga-auto')
  AND EXISTS (
    SELECT 1 FROM "TenantUser" tu JOIN "User" u ON u."id" = tu."userId"
    WHERE tu."tenantId" = t."id" AND u."email" IN ('aida@boutique-aida.sn', 'contact@teranga-auto.sn')
  );
