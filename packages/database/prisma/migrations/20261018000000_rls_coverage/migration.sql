-- Couverture RLS complète (audit de sécurité avant prévisualisation).
--
-- 1. `Refund` portait un tenantId sans RLS : isolation standard.
-- 2. Tables filles SANS tenantId : isolées par leur parent (la sous-requête est
--    elle-même soumise à la RLS du parent — une ligne n'est visible, insérable ou
--    modifiable que si son parent appartient à l'entreprise courante).
-- 3. Référentiels globaux (formules, modules, secteurs, modèles) : lecture pour tous,
--    écriture réservée à l'accès super-administrateur (app.is_super_admin).
-- `User` reste hors RLS : la connexion lit l'utilisateur avant tout contexte
-- d'entreprise (voir docs/19-securite-previsualisation.md).

-- 1. Refund
ALTER TABLE "Refund" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Refund" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Refund" USING (yamacommerce_tenant_isolation_check("tenantId")) WITH CHECK (yamacommerce_tenant_isolation_check("tenantId"));

-- 2. Tables filles
ALTER TABLE "ProductImage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductImage" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ProductImage"
  USING (EXISTS (SELECT 1 FROM "Product" p WHERE p.id = "ProductImage"."productId"))
  WITH CHECK (EXISTS (SELECT 1 FROM "Product" p WHERE p.id = "ProductImage"."productId"));

ALTER TABLE "Review" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Review" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Review"
  USING (EXISTS (SELECT 1 FROM "Product" p WHERE p.id = "Review"."productId"))
  WITH CHECK (EXISTS (SELECT 1 FROM "Product" p WHERE p.id = "Review"."productId"));

ALTER TABLE "Wishlist" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Wishlist" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Wishlist"
  USING (EXISTS (SELECT 1 FROM "Product" p WHERE p.id = "Wishlist"."productId"))
  WITH CHECK (EXISTS (SELECT 1 FROM "Product" p WHERE p.id = "Wishlist"."productId"));

ALTER TABLE "CreditNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CreditNote" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "CreditNote"
  USING (EXISTS (SELECT 1 FROM "Invoice" i WHERE i.id = "CreditNote"."invoiceId"))
  WITH CHECK (EXISTS (SELECT 1 FROM "Invoice" i WHERE i.id = "CreditNote"."invoiceId"));

ALTER TABLE "DeliveryNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeliveryNote" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "DeliveryNote"
  USING (EXISTS (SELECT 1 FROM "Order" o WHERE o.id = "DeliveryNote"."orderId"))
  WITH CHECK (EXISTS (SELECT 1 FROM "Order" o WHERE o.id = "DeliveryNote"."orderId"));

ALTER TABLE "InstallmentPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InstallmentPlan" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "InstallmentPlan"
  USING (EXISTS (SELECT 1 FROM "Order" o WHERE o.id = "InstallmentPlan"."orderId"))
  WITH CHECK (EXISTS (SELECT 1 FROM "Order" o WHERE o.id = "InstallmentPlan"."orderId"));

ALTER TABLE "Installment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Installment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Installment"
  USING (EXISTS (SELECT 1 FROM "InstallmentPlan" ip WHERE ip.id = "Installment"."installmentPlanId"))
  WITH CHECK (EXISTS (SELECT 1 FROM "InstallmentPlan" ip WHERE ip.id = "Installment"."installmentPlanId"));

ALTER TABLE "DelivererRemittance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DelivererRemittance" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "DelivererRemittance"
  USING (EXISTS (SELECT 1 FROM "Deliverer" d WHERE d.id = "DelivererRemittance"."delivererId"))
  WITH CHECK (EXISTS (SELECT 1 FROM "Deliverer" d WHERE d.id = "DelivererRemittance"."delivererId"));

-- 3. Référentiels globaux
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['SubscriptionPlan', 'Module', 'Sector', 'SiteTemplate'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY global_read ON %I FOR SELECT USING (true)', t);
    EXECUTE format($p$CREATE POLICY super_admin_insert ON %I FOR INSERT WITH CHECK (current_setting('app.is_super_admin', true) = 'true')$p$, t);
    EXECUTE format($p$CREATE POLICY super_admin_update ON %I FOR UPDATE USING (current_setting('app.is_super_admin', true) = 'true') WITH CHECK (current_setting('app.is_super_admin', true) = 'true')$p$, t);
    EXECUTE format($p$CREATE POLICY super_admin_delete ON %I FOR DELETE USING (current_setting('app.is_super_admin', true) = 'true')$p$, t);
  END LOOP;
END $$;
