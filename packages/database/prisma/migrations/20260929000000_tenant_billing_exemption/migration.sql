-- Correction de stabilisation (22 septembre 2026) — voir docs/14-facturation-saas-
-- abonnements.md : « aucune souscription = accès illimité » ne doit plus jamais être
-- le comportement par défaut. Cette colonne permet UNIQUEMENT une dérogation
-- Super Admin explicite pour un tenant antérieur à la facturation SaaS ; `NULL`
-- (nouveau tenant standard) tombe désormais sous le blocage par défaut appliqué par
-- `resolveEffectiveLimit`/`resolve-public-site.ts`, jamais un accès illimité implicite.
ALTER TABLE "Tenant" ADD COLUMN "billingExemptedAt" TIMESTAMP(3);
