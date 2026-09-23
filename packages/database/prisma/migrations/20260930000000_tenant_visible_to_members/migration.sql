-- Correction de stabilisation (22 septembre 2026) — bogue RLS réel trouvé en
-- connectant pour de vrai un utilisateur tenant dans un navigateur (voir la demande de
-- stabilisation) : `getCurrentTenantMembership()` (apps/web/lib/current-tenant.ts)
-- utilise `withUser(userId, ...)` (voir tenant-context.ts) pour trouver à quelles
-- entreprises un utilisateur appartient, avec `include: { tenant: true }`.
--
-- `TenantUser` autorise déjà correctement `userId = app.current_user_id` (Pattern D,
-- migration 20260912000001) — la ligne `TenantUser` elle-même est donc visible. Mais
-- `Tenant` (Pattern A', même migration) n'autorisait QUE `app.is_super_admin = true`
-- OU `id = app.current_tenant_id` — jamais "ce tenant a une ligne TenantUser pour
-- l'utilisateur courant". Sous `withUser()`, `app.current_tenant_id` n'est JAMAIS
-- positionné : la relation `tenant` du JOIN était donc TOUJOURS filtrée par RLS malgré
-- une ligne `TenantUser` visible, et Prisma refuse une relation requise valant `null`
-- ("Inconsistent query result") — cassant purement et simplement le dashboard pour
-- TOUT utilisateur tenant réel, jamais détecté avant l'exécution réelle en navigateur.
--
-- Sûr par construction : un utilisateur ne voit jamais qu'un tenant dont il est
-- RÉELLEMENT membre (via une ligne TenantUser existante), jamais un tenant arbitraire.
DROP POLICY IF EXISTS tenant_isolation ON "Tenant";
CREATE POLICY tenant_isolation ON "Tenant"
  USING (
    yamacommerce_tenant_isolation_check("id")
    OR EXISTS (
      SELECT 1 FROM "TenantUser" tu
      WHERE tu."tenantId" = "Tenant"."id"
        AND tu."userId" = NULLIF(current_setting('app.current_user_id', true), '')
    )
  );
