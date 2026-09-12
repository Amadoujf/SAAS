-- ============================================================================
-- Isolation multi-tenant — Row-Level Security (RLS)
-- Voir docs/03-architecture-technique.md §3.2 et docs/04-schema-base-de-donnees.md §4.4.
--
-- Cette migration doit être appliquée avec une connexion PROPRIÉTAIRE des tables
-- (MIGRATE_DATABASE_URL, ex. rôle superutilisateur ou propriétaire du schéma), jamais
-- avec la connexion applicative restreinte (DATABASE_URL).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Rôle applicatif restreint
-- ----------------------------------------------------------------------------
-- C'est CE rôle que l'application (Prisma Client à l'exécution) utilise. Il n'a ni
-- SUPERUSER ni BYPASSRLS : les policies ci-dessous s'appliquent donc réellement à lui,
-- y compris s'il est involontairement utilisé pour une requête sans contexte tenant.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'yamacommerce_app') THEN
    CREATE ROLE yamacommerce_app LOGIN PASSWORD 'change-me-in-production'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO yamacommerce_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO yamacommerce_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO yamacommerce_app;

-- S'applique aux tables créées par de FUTURES migrations exécutées par le rôle
-- propriétaire courant, pour ne pas oublier de GRANT à chaque nouvelle table.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO yamacommerce_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO yamacommerce_app;

-- ----------------------------------------------------------------------------
-- 2. Correctifs d'unicité pour les colonnes tenantId NULLABLES
-- ----------------------------------------------------------------------------
-- PostgreSQL traite chaque NULL comme distinct dans un index unique standard :
-- `@@unique([tenantId, name])` avec tenantId nullable ne bloque donc PAS deux rôles
-- globaux "OWNER" (tenantId = NULL). Un index unique partiel corrige ce trou.
CREATE UNIQUE INDEX IF NOT EXISTS "Role_global_name_unique"
  ON "Role" ("name") WHERE "tenantId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "NotificationTemplate_global_unique"
  ON "NotificationTemplate" ("type", "channel", "locale") WHERE "tenantId" IS NULL;

-- ----------------------------------------------------------------------------
-- 3. Fonction utilitaire : la policy "Pattern A" est répétée sur de nombreuses
--    tables ; on factorise sa condition dans une fonction pour lisibilité et
--    cohérence (une seule définition à auditer).
-- ----------------------------------------------------------------------------
-- Les identifiants Prisma (`@id @default(uuid())`) sont stockés en colonnes `text`
-- (Prisma génère l'UUID côté application, il n'utilise PAS le type natif `uuid` de
-- PostgreSQL par défaut) : la comparaison se fait donc en texte, sans cast `::uuid`.
CREATE OR REPLACE FUNCTION yamacommerce_tenant_isolation_check(row_tenant_id text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    current_setting('app.is_super_admin', true) = 'true'
    OR row_tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '');
$$;

-- ----------------------------------------------------------------------------
-- 4a. Pattern A' — Tenant lui-même n'a pas de colonne tenantId (son "id" EST
--     l'identifiant du tenant) : politique dédiée sur cette colonne. Un tenant peut
--     lire/modifier SA PROPRE ligne (ex. mettre à jour son branding) une fois placé
--     dans son propre contexte (`withTenant(tenant.id, ...)`) ; la CRÉATION d'un tenant
--     exige en revanche systématiquement un accès Super Admin (`withSuperAdminAccess`),
--     conformément à docs/02-architecture-fonctionnelle.md §2.3 — aucun tenant ne peut
--     se créer lui-même.
-- ----------------------------------------------------------------------------
ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tenant" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Tenant"
  USING (yamacommerce_tenant_isolation_check("id"));

-- ----------------------------------------------------------------------------
-- 4. Pattern A — tables avec tenantId NON NULL : isolation stricte.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'Domain', 'Shop', 'Category', 'Product', 'Customer', 'Order',
    'PaymentProviderConfig', 'Payment', 'Counter', 'Invoice', 'Quote',
    'DeliveryZone', 'Deliverer', 'AIGenerationJob', 'AIUsageRecord', 'ImportJob',
    'WhatsAppConfig', 'TenantSite', 'Subscription', 'PromoCode', 'GiftCard',
    'Supplier', 'Expense', 'Commission', 'ImpersonationSession'
  ];
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
-- 5. Pattern D — TenantUser : isolation par tenant, MAIS un utilisateur peut aussi
--    voir ses PROPRES lignes d'appartenance (nécessaire pour "à quelles entreprises
--    est-ce que j'appartiens ?" — voir packages/database/src/tenant-context.ts,
--    fonction `withUser`). Cela n'expose jamais les données d'un autre utilisateur.
-- ----------------------------------------------------------------------------
ALTER TABLE "TenantUser" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantUser" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "TenantUser"
  USING (
    yamacommerce_tenant_isolation_check("tenantId")
    OR "userId" = NULLIF(current_setting('app.current_user_id', true), '')
  );

-- ----------------------------------------------------------------------------
-- 6. Pattern B — tenantId NULLABLE, une valeur NULL = gabarit plateforme visible par
--    tous les tenants (rôles système, modèles de notification par défaut).
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY['Role', 'NotificationTemplate'];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', tbl);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING ("tenantId" IS NULL OR yamacommerce_tenant_isolation_check("tenantId"));',
      tbl
    );
  END LOOP;
END
$$;

-- ----------------------------------------------------------------------------
-- 7. Pattern C — tenantId NULLABLE, une valeur NULL = donnée strictement PLATEFORME
--    (jamais lisible par un tenant, même le sien).
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY['AuditLog', 'ErrorLog'];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', tbl);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING ("tenantId" IS NOT NULL AND yamacommerce_tenant_isolation_check("tenantId"));',
      tbl
    );
  END LOOP;
END
$$;

-- ----------------------------------------------------------------------------
-- 8. Limitation documentée (Phase 0)
-- ----------------------------------------------------------------------------
-- Les tables enfants suivantes n'ont pas de colonne tenantId propre et ne portent donc
-- PAS de policy RLS directe : ProductImage, ProductVariant, InventoryItem,
-- StockMovement, OrderItem, OrderStatusHistory, CreditNote, InstallmentPlan,
-- Installment, DeliveryNote, Refund, DelivererRemittance, Page, CustomerAddress,
-- Wishlist, Review. Leur protection repose en Phase 0 sur le fait que l'application ne
-- les accède JAMAIS par identifiant brut sans être passée par leur parent protégé par
-- RLS (Product, Order, Customer, TenantSite). Piste de durcissement (Phase 4, voir
-- docs/09-plan-developpement.md) : dénormaliser une colonne tenantId sur chacune de ces
-- tables pour leur appliquer directement le Pattern A.
--
-- La table "User" (identité globale, peut appartenir à plusieurs tenants) n'a elle non
-- plus aucune policy RLS : l'accès au profil d'un autre utilisateur (nom, email) doit
-- être arbitré par la couche applicative via `TenantUser` (ne jamais exposer un `User`
-- par identifiant brut sans vérifier au préalable une appartenance commune à un tenant).
