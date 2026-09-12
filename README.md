# YamaCommerce AI

Plateforme SaaS multi-entreprises permettant de créer, configurer et vendre des sites web professionnels à différents types d'entreprises au Sénégal (e-commerce, restaurants, immobilier, automobile, salons, hôtels, écoles, services, livraison, grossistes).

> **Statut actuel : Phase 0 (fondations) codée et vérifiée.** Le cahier des charges, l'architecture et le schéma de base de données ci-dessous ont été validés, et le socle technique (monorepo, authentification, multi-tenant, permissions, files d'attente, interface de paiement) est en place — voir [État de la Phase 0](#état-de-la-phase-0-fondations) pour le détail exact de ce qui a été vérifié. La Phase 1 (MVP fonctionnel) n'a pas encore démarré.

## Documentation de conception

| #   | Document                                                                       | Contenu                                                                        |
| --- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| 1   | [docs/01-cahier-des-charges.md](docs/01-cahier-des-charges.md)                 | Contexte, objectifs, périmètre, exigences fonctionnelles et non fonctionnelles |
| 2   | [docs/02-architecture-fonctionnelle.md](docs/02-architecture-fonctionnelle.md) | Modules, acteurs, flux entre modules                                           |
| 3   | [docs/03-architecture-technique.md](docs/03-architecture-technique.md)         | Stack technique, justifications, multi-tenant, sécurité, déploiement           |
| 4   | [docs/04-schema-base-de-donnees.md](docs/04-schema-base-de-donnees.md)         | ERD, schéma Prisma complet, stratégie d'isolation des données                  |
| 5   | [docs/05-roles-permissions.md](docs/05-roles-permissions.md)                   | Rôles, catalogue de permissions, matrice, impersonation                        |
| 6   | [docs/06-parcours-commande.md](docs/06-parcours-commande.md)                   | Cycle de vie complet d'une commande                                            |
| 7   | [docs/07-parcours-paiement-facture.md](docs/07-parcours-paiement-facture.md)   | Du paiement à la facture, idempotence, tranches                                |
| 8   | [docs/08-liste-pages.md](docs/08-liste-pages.md)                               | Toutes les pages (site public, dashboard, super admin)                         |
| 9   | [docs/09-plan-developpement.md](docs/09-plan-developpement.md)                 | Phases 0 à 4, MVP détaillé                                                     |
| 10  | [docs/10-structure-dossiers.md](docs/10-structure-dossiers.md)                 | Arborescence du monorepo                                                       |

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

**Pourquoi la base n'a pas été montée ici :** cet environnement d'exécution ne dispose ni de Docker ni de droits administrateur pour installer PostgreSQL/Redis (une instance PostgreSQL 17 tourne déjà sur ce poste pour un autre usage, sans identifiants connus, et il n'a pas semblé raisonnable d'y toucher sans confirmation). **Sur ta machine**, avec Docker installé, les étapes 3 à 5 ci-dessus mettront tout en route en quelques minutes — exécute ensuite `pnpm test` pour lancer réellement `tests/tenant-isolation.test.ts` (isolation tenant A / tenant B) et confirme-moi le résultat, ou dis-le moi si une erreur apparaît.

## Prochaine étape

Une fois la base de données montée et les tests d'isolation confirmés de ton côté (ou si tu préfères que je configure Docker autrement), on démarre la **Phase 1 (MVP)** — produits, commandes, paiements PayDunya réels, factures — fichier par fichier, phase validée avant la suivante.
