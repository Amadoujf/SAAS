-- Séparation nette des DONNÉES DE DÉMONSTRATION et des entreprises réelles (27 septembre
-- 2026). Jusqu'ici, une entreprise de démonstration était signalée par une clé libre
-- dans `branding` (JSON modifiable par la personnalisation). Désormais :
--   * une vraie colonne `isDemo`, lue par l'application (bandeaux « Démonstration »,
--     exclusion des indicateurs de la plateforme, garde des scripts de démonstration) ;
--   * modifiable UNIQUEMENT en contexte Super Admin (scripts de démonstration, console
--     plateforme) : une entreprise ne peut ni se déclarer démo, ni s'en retirer.
ALTER TABLE "Tenant" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Tenant" SET "isDemo" = true WHERE "branding"->>'demoData' = 'true';
UPDATE "Tenant" SET "branding" = "branding" - 'demoData' WHERE "branding" ? 'demoData';

CREATE OR REPLACE FUNCTION yamacommerce_tenant_demo_guard() RETURNS trigger AS $$
BEGIN
  IF NEW."isDemo" IS DISTINCT FROM (CASE WHEN TG_OP = 'INSERT' THEN false ELSE OLD."isDemo" END)
     AND coalesce(current_setting('app.is_super_admin', true), 'false') <> 'true' THEN
    RAISE EXCEPTION 'Le statut « démonstration » d''une entreprise ne peut être modifié que par la plateforme.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenant_demo_guard
  BEFORE INSERT OR UPDATE OF "isDemo" ON "Tenant"
  FOR EACH ROW EXECUTE FUNCTION yamacommerce_tenant_demo_guard();
