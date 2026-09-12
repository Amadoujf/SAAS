# YamaCommerce AI

Plateforme SaaS multi-entreprises et **multi-secteurs** (e-commerce, mode, restauration, immobilier, voyage, automobile, hôtellerie, services, éducation, livraison — et au-delà, voir [doc 11](docs/11-secteurs-et-modules.md)) permettant à chaque entrepreneur de choisir son secteur, ses modules, son template et de publier son site professionnel au Sénégal.

> **Statut actuel : Phase 0 (fondations) codée et vérifiée ; architecture multi-business validée en conception (docs 11 et 12), en attente de validation finale des secteurs/templates/directions artistiques avant le développement de la Phase 1.** Voir [État de la Phase 0](#état-de-la-phase-0-fondations) pour le détail de ce qui a été vérifié en code, et [09-plan-developpement.md](docs/09-plan-developpement.md) pour l'impact de l'extension multi-secteurs sur le calendrier.

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

(`db:migrate:deploy` applique les deux migrations existantes : création du schéma, puis activation de Row-Level Security + création du rôle `yamacommerce_app`. Utilise `pnpm db:migrate` — `prisma migrate dev` — uniquement en développement si tu ajoutes de nouveaux modèles au schéma.)

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

### Résultats vérifiés dans cet environnement (2026-09-12)

| Vérification                                                    | Résultat                                                                                                                                                                                            |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install` (9 workspaces)                                   | ✅ Réussi                                                                                                                                                                                           |
| `prisma validate` / `prisma generate`                           | ✅ Réussi                                                                                                                                                                                           |
| Migration initiale (`prisma migrate diff --from-empty`)         | ✅ Générée (1134 lignes SQL), non encore appliquée à une base réelle                                                                                                                                |
| Migration RLS (rôle applicatif, policies, index partiels)       | ✅ Écrite à la main, non encore appliquée à une base réelle                                                                                                                                         |
| `pnpm typecheck` (8 packages)                                   | ✅ 0 erreur                                                                                                                                                                                         |
| `pnpm lint` (8 packages, ESLint + `next lint`)                  | ✅ 0 avertissement, 0 erreur                                                                                                                                                                        |
| `pnpm test` — `@yamacommerce/auth`                              | ✅ 7/7 tests passés (permissions, guard)                                                                                                                                                            |
| `pnpm test` — `@yamacommerce/payments`                          | ✅ 4/4 tests passés (adaptateur PayDunya, mocké)                                                                                                                                                    |
| `pnpm test` — `@yamacommerce/domains`                           | ✅ 3/3 tests passés (vérification DNS, mockée)                                                                                                                                                      |
| `pnpm test` — `@yamacommerce/queue`                             | ✅ 2/2 tests passés                                                                                                                                                                                 |
| `pnpm test` — `@yamacommerce/database` (isolation multi-tenant) | ⏭️ **Ignoré** — aucun PostgreSQL disponible dans cet environnement (pas de Docker, pas de droits admin). Le test détecte l'absence de base et l'affiche clairement plutôt que de prétendre réussir. |

**Pourquoi la base n'a pas été montée ici :** cet environnement d'exécution ne dispose ni de Docker ni de droits administrateur pour installer PostgreSQL/Redis (une instance PostgreSQL 17 tourne déjà sur ce poste pour un autre usage, sans identifiants connus, et il n'a pas semblé raisonnable d'y toucher sans confirmation). C'est exactement pour ce cas de figure — pas de Docker en local — que la CI ci-dessous exécute le test réel contre un vrai PostgreSQL à chaque push.

## Intégration continue (CI)

Le workflow [.github/workflows/ci.yml](.github/workflows/ci.yml) reproduit fidèlement les commandes ci-dessus contre un vrai PostgreSQL et un vrai Redis (services GitHub Actions), à chaque push et pull request :

`pnpm install` → `pnpm db:generate` → `pnpm db:migrate:deploy` (les deux migrations, y compris l'activation de Row-Level Security) → `pnpm db:seed` → `pnpm lint` → `pnpm typecheck` → `pnpm test`.

**Le test d'isolation multi-tenant (`packages/database/tests/tenant-isolation.test.ts`) n'est jamais simulé ni désactivé en CI** : la variable `REQUIRE_DB_TESTS=true` y est positionnée, ce qui transforme une base injoignable en échec du job plutôt qu'en test ignoré silencieusement (vérifié localement : voir historique de commit — avec `REQUIRE_DB_TESTS=true` et sans PostgreSQL, le test échoue bien au lieu de passer). En local, sans cette variable, la suite reste ignorée (skip) si PostgreSQL n'est pas disponible — comportement inchangé, documenté dans le fichier de test lui-même.

Le workflow échoue automatiquement si : une migration Prisma échoue, le lint ou le typecheck échoue, un test échoue — **ou** si le test d'isolation détecte qu'un tenant peut lire/modifier/supprimer les données d'un autre, ou qu'une requête métier sans contexte tenant renvoie des données.

Pour le déclencher : pousser ce dépôt sur GitHub (`git remote add origin <url>` puis `git push -u origin main`) — aucune configuration de secret n'est nécessaire, toutes les valeurs utilisées par la CI sont des identifiants de test jetables générés dans le workflow lui-même.

## Prochaine étape

**Phase 1** en cours — voir les sections suivantes de ce document au fil de son avancement, et [docs/09-plan-developpement.md](docs/09-plan-developpement.md) pour le détail complet.
