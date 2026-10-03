# Y-COM

> Nom commercial : **Y-COM** (anciennement YamaCommerce AI). Les noms techniques — paquets `@yamacommerce/*`, domaine `yamacommerce.ai`, rôles PostgreSQL — restent inchangés pour ne casser ni les déploiements ni les adresses existantes.

Plateforme SaaS multi-entreprises et **multi-secteurs** (e-commerce, mode, restauration, immobilier, voyage, automobile, hôtellerie, services, éducation, livraison — et au-delà, voir [doc 11](docs/11-secteurs-et-modules.md)) permettant à chaque entrepreneur de choisir son secteur, ses modules, son template et de publier son site professionnel au Sénégal.

> **Statut actuel : Phase 0 (fondations) livrée ; Phase 1 en cours** — architecture multi-business validée (docs 11 et 12), registre secteurs/modules et extension du domaine personnalisé codés et testés (schéma + logique), CI GitHub Actions en place pour vérifier tout cela contre un vrai PostgreSQL. Voir [État de la Phase 0](#état-de-la-phase-0-fondations) et [Phase 1 — avancement](#phase-1--avancement) plus bas, et [09-plan-developpement.md](docs/09-plan-developpement.md) pour le détail complet.

## Documentation de conception

| #   | Document                                                                                                     | Contenu                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| 1   | [docs/01-cahier-des-charges.md](docs/01-cahier-des-charges.md)                                               | Contexte, objectifs, périmètre, exigences fonctionnelles et non fonctionnelles       |
| 2   | [docs/02-architecture-fonctionnelle.md](docs/02-architecture-fonctionnelle.md)                               | Modules, acteurs, flux entre modules, architecture multi-business                    |
| 3   | [docs/03-architecture-technique.md](docs/03-architecture-technique.md)                                       | Stack technique, justifications, multi-tenant, sécurité, déploiement                 |
| 4   | [docs/04-schema-base-de-donnees.md](docs/04-schema-base-de-donnees.md)                                       | ERD, schéma Prisma complet (noyau + extension multi-secteurs), isolation des données |
| 5   | [docs/05-roles-permissions.md](docs/05-roles-permissions.md)                                                 | Rôles, catalogue de permissions, matrice, impersonation                              |
| 6   | [docs/06-parcours-commande.md](docs/06-parcours-commande.md)                                                 | Cycle de vie complet d'une commande                                                  |
| 7   | [docs/07-parcours-paiement-facture.md](docs/07-parcours-paiement-facture.md)                                 | Du paiement à la facture, idempotence, tranches                                      |
| 8   | [docs/08-liste-pages.md](docs/08-liste-pages.md)                                                             | Toutes les pages (site public, dashboard, super admin)                               |
| 9   | [docs/09-plan-developpement.md](docs/09-plan-developpement.md)                                               | Phases 0 à 5, impact de l'architecture multi-business sur le calendrier              |
| 10  | [docs/10-structure-dossiers.md](docs/10-structure-dossiers.md)                                               | Arborescence du monorepo                                                             |
| 11  | [docs/11-secteurs-et-modules.md](docs/11-secteurs-et-modules.md)                                             | Registre des 10 secteurs, modules communs et sectoriels, gouvernance d'activation    |
| 12  | [docs/12-systeme-templates-et-direction-artistique.md](docs/12-systeme-templates-et-direction-artistique.md) | Système de templates, éditeur visuel, animations, direction artistique par secteur   |

## État de la Phase 0 (fondations)

**Statut : fondations codées et vérifiées (lint + typecheck + tests unitaires), migration DB écrite mais pas encore appliquée sur ce poste** — aucun serveur PostgreSQL/Redis dédié au projet n'est disponible dans cet environnement d'exécution (pas de Docker, pas de droits d'administration pour en installer un). Tout ce qui ne nécessite pas de base de données a été exécuté réellement ; voir la section "Résultats vérifiés" ci-dessous pour le détail exact, honnête, de ce qui a tourné et de ce qui reste à faire sur ta machine.

### Prérequis

- Node.js ≥ 20 (présent : v20.20.0)
- pnpm ≥ 9 (`npm install -g pnpm`, déjà fait dans cet environnement)
- PostgreSQL 16+ et Redis 7+ — via **Docker** (recommandé, voir `infra/docker-compose.yml`) ou installés nativement

### 1. Installer les dépendances

```bash
pnpm install
```

### 2. Configurer l'environnement

```bash
cp .env.example .env
```

Renseigne au minimum : `DATABASE_URL`, `MIGRATE_DATABASE_URL` (voir explication des deux rôles Postgres ci-dessous), `ENCRYPTION_KEY` (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`), `AUTH_SECRET` (`npx auth secret`).

### 3. Démarrer PostgreSQL et Redis (Docker)

```bash
docker compose -f infra/docker-compose.yml up -d
```

Crée une base `yamacommerce` avec un rôle `yamacommerce_owner` (propriétaire des tables — utilisé par `MIGRATE_DATABASE_URL`). Le rôle applicatif restreint `yamacommerce_app` (utilisé par `DATABASE_URL`, celui réellement soumis à Row-Level Security) est créé par la migration `20260912000001_enable_row_level_security` — pense à changer son mot de passe (`ALTER ROLE yamacommerce_app WITH PASSWORD '...'`) et à le refléter dans `DATABASE_URL` avant tout déploiement réel.

Sans Docker : installe PostgreSQL et Redis nativement, crée la base et le rôle propriétaire toi-même, puis adapte `.env`.

### 4. Appliquer les migrations et générer le client Prisma

```bash
pnpm db:generate
pnpm db:migrate:deploy
```

(`db:migrate:deploy` applique les quatre migrations existantes, dans l'ordre : création du schéma, activation de Row-Level Security + création du rôle `yamacommerce_app`, registre secteurs/modules + extension du domaine personnalisé, puis registre de templates. Utilise `pnpm db:migrate` — `prisma migrate dev` — uniquement en développement si tu ajoutes de nouveaux modèles au schéma.)

### 5. Charger les données de démonstration

```bash
pnpm db:seed
```

Crée : 4 formules d'abonnement, les 7 rôles système, un Super Admin (`SUPERADMIN_SEED_EMAIL` / `SUPERADMIN_SEED_PASSWORD` dans `.env`), et **deux entreprises de démonstration distinctes** (Boutique Aïda — e-commerce, Teranga Auto — automobile), chacune avec un propriétaire (mot de passe `Demo!2026`), un produit, un client et une commande livrée/facturée en FCFA — utile pour vérifier manuellement l'isolation multi-tenant en te connectant successivement aux deux comptes.

### 6. Lancer l'application

```bash
pnpm dev            # démarre apps/web ET apps/worker en parallèle (Turborepo)
pnpm dev:web        # démarre uniquement Next.js (http://localhost:3000)
pnpm dev:worker     # démarre uniquement le worker BullMQ
```

### 7. Vérifications

```bash
pnpm lint           # ESLint sur tous les packages
pnpm typecheck      # tsc --noEmit sur tous les packages
pnpm test           # Vitest sur tous les packages (les tests DB sont ignorés si PostgreSQL est injoignable)
pnpm format         # Prettier — réécrit les fichiers
pnpm format:check   # Prettier — vérifie sans écrire
```

### Autres commandes utiles

```bash
pnpm db:studio      # Prisma Studio (explorateur de données)
pnpm --filter @yamacommerce/database run validate   # valide prisma/schema.prisma
```

### Résultats vérifiés dans cet environnement (2026-09-13)

| Vérification                                                                             | Résultat                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install` (11 workspaces)                                                           | ✅ Réussi                                                                                                                                                                                                                                                             |
| `prisma validate` / `prisma generate`                                                    | ✅ Réussi (registre secteurs/modules, extension Domain, registre de templates)                                                                                                                                                                                        |
| 4 migrations (init, RLS, registre secteurs/modules + Domain, registre de templates)      | ✅ Écrites/générées, non encore appliquées à une base réelle dans cet environnement                                                                                                                                                                                   |
| `pnpm typecheck` (9 packages)                                                            | ✅ 0 erreur                                                                                                                                                                                                                                                           |
| `pnpm lint` (9 packages, ESLint + `next lint`)                                           | ✅ 0 avertissement, 0 erreur                                                                                                                                                                                                                                          |
| `pnpm test` — `@yamacommerce/auth`                                                       | ✅ 7/7                                                                                                                                                                                                                                                                |
| `pnpm test` — `@yamacommerce/payments`                                                   | ✅ 4/4                                                                                                                                                                                                                                                                |
| `pnpm test` — `@yamacommerce/domains`                                                    | ✅ 6/6                                                                                                                                                                                                                                                                |
| `pnpm test` — `@yamacommerce/queue`                                                      | ✅ 2/2                                                                                                                                                                                                                                                                |
| `pnpm test` — `@yamacommerce/design-tokens`                                              | ✅ 6/6                                                                                                                                                                                                                                                                |
| `pnpm test` — `@yamacommerce/templates`                                                  | ✅ 13/13                                                                                                                                                                                                                                                              |
| `pnpm test` — `@yamacommerce/database` (isolation, registre modules, registre templates) | ⏭️ **Ignorés** en local — aucun PostgreSQL disponible dans cet environnement. Vérifié séparément que `REQUIRE_DB_TESTS=true` sans base fait échouer ces tests plutôt que de les laisser passer. **Ces 3 suites s'exécutent réellement dans la CI** (voir ci-dessous). |

**Pourquoi la base n'a pas été montée ici :** cet environnement d'exécution ne dispose ni de Docker ni de droits administrateur pour installer PostgreSQL/Redis (une instance PostgreSQL 17 tourne déjà sur ce poste pour un autre usage, sans identifiants connus, et il n'a pas semblé raisonnable d'y toucher sans confirmation). C'est exactement pour ce cas de figure — pas de Docker en local — que la CI ci-dessous exécute le test réel contre un vrai PostgreSQL à chaque push.

## Intégration continue (CI)

Le workflow [.github/workflows/ci.yml](.github/workflows/ci.yml) reproduit fidèlement les commandes ci-dessus contre un vrai PostgreSQL et un vrai Redis (services GitHub Actions), à chaque push et pull request :

`pnpm install` → `pnpm db:generate` → `pnpm db:migrate:deploy` (les deux migrations, y compris l'activation de Row-Level Security) → `pnpm db:seed` → `pnpm lint` → `pnpm typecheck` → `pnpm test`.

**Le test d'isolation multi-tenant (`packages/database/tests/tenant-isolation.test.ts`) n'est jamais simulé ni désactivé en CI** : la variable `REQUIRE_DB_TESTS=true` y est positionnée, ce qui transforme une base injoignable en échec du job plutôt qu'en test ignoré silencieusement (vérifié localement : voir historique de commit — avec `REQUIRE_DB_TESTS=true` et sans PostgreSQL, le test échoue bien au lieu de passer). En local, sans cette variable, la suite reste ignorée (skip) si PostgreSQL n'est pas disponible — comportement inchangé, documenté dans le fichier de test lui-même.

Le workflow échoue automatiquement si : une migration Prisma échoue, le lint ou le typecheck échoue, un test échoue — **ou** si le test d'isolation détecte qu'un tenant peut lire/modifier/supprimer les données d'un autre, ou qu'une requête métier sans contexte tenant renvoie des données.

Pour le déclencher : pousser ce dépôt sur GitHub (`git remote add origin <url>` puis `git push -u origin main`) — aucune configuration de secret n'est nécessaire, toutes les valeurs utilisées par la CI sont des identifiants de test jetables générés dans le workflow lui-même.

## Phase 1 — avancement

**Étape livrée (13 septembre 2026) : registre secteurs/modules + extension du domaine personnalisé (schéma et logique backend).**

- Migration `packages/database/prisma/migrations/20260913000000_sector_module_registry_and_domain_extension` : modèles `Sector`, `Module`, `TenantModule`, `Tenant.sectorKey`, et extension de `Domain` (statut de vérification, enregistrements DNS attendus/détectés, rappel, redirection sous-domaine, achat plateforme, renouvellement).
- `packages/database/src/modules-registry.ts` : `activateSectorDefaults`, `setModuleEnabled`, `isModuleEnabled` (refuse de désactiver un module core), avec RLS appliquée à `TenantModule`.
- `packages/database/src/seed.ts` : seed des 10 secteurs + « Autre activité » et du catalogue complet de modules (docs/11).
- `packages/domains/src/dns-instructions.ts` : calcul des enregistrements DNS attendus (A pour un apex, CNAME pour un sous-domaine, TXT de vérification) ; `isDomainAvailable()` pour la vérification de disponibilité côté interface.
- Nouveaux tests : `packages/database/tests/module-registry.test.ts` (activation, idempotence, protection des modules core, isolation RLS — exécuté réellement en CI) et `packages/domains/src/dns-instructions.test.ts` (3/3 passés localement).

**Étape livrée (13 septembre 2026, suite) : design tokens + registre de templates.**

- `packages/design-tokens` : schéma Zod complet (couleurs, typographie, espacement, bordures, rayons, ombres, largeur de contenu, styles bouton/carte/en-tête/pied de page/formulaire, niveau et durées/courbes d'animation) + `mergeDesignTokens()` — la surcharge d'une entreprise ne modifie jamais le template original (testé : immutabilité + fusion partielle).
- `packages/templates` : catalogue des 16 sections demandées (Hero, Catégories, Produits en vedette, Nouveautés, Promotions, Avantages, Témoignages, Marques, Galerie, Vidéo, Newsletter, FAQ, Appel à l'action, Contact, WhatsApp, Contenu personnalisé), chacune avec son schéma de paramètres et ses variantes visuelles ; validation de manifeste de pages complète.
- Modèles `SiteTemplate`/`TenantSite` migrés (`prisma/migrations/20260913010000_template_registry`, remplace proprement les tables placeholder de la Phase 0 — jamais appliquées à une base réelle, aucune perte de données possible) ; `packages/database/src/templates-registry.ts` (créer/publier/archiver un template, attribuer un template à une entreprise, résoudre les tokens effectifs).
- Nouveaux tests : `packages/design-tokens` (6/6 ✅), `packages/templates` (13/13 ✅), `packages/database/tests/templates-registry.test.ts` (6 tests, dont la preuve qu'un changement de template ne supprime jamais une donnée métier — exécuté réellement en CI).

**Reste à construire pour compléter la Phase 1** (voir [docs/09-plan-developpement.md](docs/09-plan-developpement.md)) : le moteur de rendu (composants React par section/variante), l'éditeur visuel par sections, la prévisualisation responsive, les templates e-commerce complets, l'assistant de domaine dans le dashboard et les pages Super Admin de gestion des domaines.

## Prochaine étape

Valider ce socle (registre + domaine) une fois la CI verte sur GitHub, puis enchaîner sur le prochain élément de la Phase 1 — voir [docs/09-plan-developpement.md](docs/09-plan-developpement.md).
