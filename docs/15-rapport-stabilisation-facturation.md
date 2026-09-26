# 15 — Rapport de stabilisation : facturation SaaS (abonnements via Chariow)

Validation réelle avant toute nouvelle fonctionnalité : commandes exécutées, résultats réels, bogues trouvés et corrigés, preuves en navigateur.

- **Période :** 24–26 septembre 2026
- **Commits de stabilisation :** 8 (`fb7cee7` → `4645347`)
- **Poste :** `C:\yamacommerce-saas` (hors OneDrive)
- **CI GitHub :** passe intégralement sur `4645347`

| Indicateur                   | Valeur                   |
| ---------------------------- | ------------------------ |
| Tests réels                  | **791**, 0 échec, 0 skip |
| Packages verts               | 11 / 11                  |
| Bogues réels corrigés        | 8                        |
| Build production             | ✅                       |
| Point en attente (bloquant)  | 1 (Chariow réel)         |

## 1. Ce qui a changé

Avant cette validation, la suite de tests n'avait jamais tourné jusqu'au bout dans un environnement propre : installation bloquée indéfiniment sous OneDrive, tests réels PostgreSQL de deux packages ignorés silencieusement en CI, page de connexion cassée pour tout utilisateur réel.

```bash
# déplacement hors OneDrive — cause racine du blocage pnpm/Prisma
git clone "OneDrive.../SAAS" C:\yamacommerce-saas
pnpm install --frozen-lockfile         # 2 min 34 s (avant : blocage infini)
pnpm --filter @yamacommerce/database db:migrate:deploy
pnpm --filter @yamacommerce/database db:seed
pnpm lint                              # 0 erreur (3 corrigées)
pnpm typecheck
pnpm test
pnpm build                             # apps/web + apps/worker
```

### Résultats du dernier passage complet

| Package                       | Tests   | Statut           |
| ----------------------------- | ------- | ---------------- |
| `@yamacommerce/database`      | 183     | ✅               |
| `@yamacommerce/web`           | 312     | ✅               |
| `@yamacommerce/domains`       | 81      | ✅               |
| `@yamacommerce/storage`       | 85      | ✅               |
| `@yamacommerce/publishing`    | 39      | ✅               |
| `@yamacommerce/templates`     | 32      | ✅               |
| `@yamacommerce/queue`         | 21      | ✅               |
| `@yamacommerce/billing`       | 15      | ✅               |
| `@yamacommerce/payments`      | 8       | ✅               |
| `@yamacommerce/auth`          | 8       | ✅               |
| `@yamacommerce/design-tokens` | 7       | ✅               |
| **Total**                     | **791** | 0 échec, 0 skip  |

## 2. Trois bogues réels trouvés en local, en exécutant

Chacun a été confirmé en échec avant correction, puis vérifié en succès répété après.

### Connexion cassée pour tout utilisateur réel — `fb7cee7`

- **Trouvé par :** connexion réelle en navigateur (Playwright).
- **Cause :** la politique RLS de `Tenant` n'autorisait que le Super Admin ou le tenant courant, jamais « ce tenant a une ligne `TenantUser` pour l'utilisateur connecté ». Le dashboard lisait une relation vide et Prisma rejetait la requête.
- **Correction :** clause RLS fondée sur l'appartenance réelle (migration `20260930000000_tenant_visible_to_members`).
- **Vérifié :** connexion réelle, dashboard rendu, aucune nouvelle erreur serveur.

### Suspension automatique pouvant écraser un paiement concurrent — `eefa8ba`

- **Trouvé par :** premier vrai passage du test « renouvellements simultanés » contre PostgreSQL (100 % d'échec).
- **Cause :** le balayage de fin de grâce et la confirmation de paiement modifiaient la même ligne dans deux transactions non coordonnées ; un événement d'audit « suspendu » parasite pouvait rester sur un abonnement payé et actif.
- **Correction :** le balayage prend `FOR UPDATE NOWAIT` et cède s'il croise une confirmation en cours ; le paiement attend normalement son tour.
- **Vérifié :** 10/10 exécutions répétées + un test déterministe du mécanisme.

### Quota dépassable sous requêtes simultanées — `cfee5ea`

- **Trouvé par :** premier test de concurrence sur les quotas — 5 créations simultanées contre une limite de 2 : 3 passées.
- **Cause :** `COUNT(*)` puis comparaison, sans ligne à verrouiller.
- **Correction :** `pg_advisory_xact_lock` par (tenant, ressource) avant tout comptage — sérialise un même tenant, jamais des tenants différents.
- **Vérifié :** 8/8 exécutions répétées ; garantie stricte (le verrou bloque).

> Le commit `ef6e4d4` ne corrige pas de bogue : il ajoute les tests de couverture demandés (voir §7).

## 3. Cinq bogues réels trouvés uniquement par la CI GitHub

Invisibles en local (Windows, embedded-postgres) mais reproduits sur la CI (Linux, `postgres:17-alpine`). Six passages de CI ont été nécessaires : les cinq premiers ont chacun révélé un bogue, le sixième est passé intégralement.

| Bogue                                                 | Commit    | Cause                                                                                                                                                                                                 | Correction                                                                                                                     | Vérifié           |
| ----------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| Double libération de stock à l'annulation             | `9950bad` | `transitionOrderStatus` est un no-op si la commande est déjà dans l'état visé ; `cancelOrder` relâchait le stock dans les deux cas (5 annulations simultanées → stock libéré 3 fois).                | Compte les lignes d'historique avant/après pour savoir si cet appel a réellement agi.                                          | 12/12             |
| Rejet non géré : paiement vs expiration               | `9950bad` | Seul l'un des deux types d'erreur (conflit) était rattrapé ; une commande déjà annulée rend la cible invalide.                                                                                        | Rattrape aussi le second type d'erreur avec le mécanisme de nouvelle tentative existant.                                       | 12/12             |
| `upsert` non atomique pour le dédoublonnage client    | `32e4cef` | `upsert` présumé atomique sur l'index unique — faux sous vraie concurrence (5 checkouts simultanés, même téléphone).                                                                                   | Motif « créer puis rattraper ».                                                                                                | voir `4645347`    |
| Interblocage introduit par le correctif `eefa8ba`     | `26078f6` | Créer un paiement prend un verrou de partage implicite (clé étrangère) sur l'abonnement ; le verrou exclusif pris ensuite formait un cycle entre deux ventes concurrentes.                             | Verrou exclusif pris avant toute écriture, dès le début de la confirmation.                                                    | 15/15             |
| « Créer puis rattraper » cassé sous PostgreSQL réel   | `4645347` | PostgreSQL abandonne toute la transaction dès qu'une instruction échoue : relire dans le `catch` échoue aussi. Même motif présent dans le panier et l'abonnement.                                       | Fonction partagée `packages/database/src/concurrency.ts` : `SAVEPOINT` / `ROLLBACK TO SAVEPOINT`, appliquée aux 3 endroits.    | 12/12 par fonction |

## 4. Règle de facturation : plus d'accès illimité par défaut

« Aucun abonnement = accès illimité » était un contournement de facturation. Désormais :

- Sans abonnement : quotas à zéro, site public remplacé par une page de suspension dédiée.
- Seule exception : `Tenant.billingExemptedAt`, dérogation Super Admin explicite, justifiée et tracée dans le journal d'audit, gérée depuis `/admin`.
- Pendant la grâce : site public inchangé. Pendant suspension/expiration : page dédiée, aucune suppression de données, dashboard et Facturation toujours accessibles.
- Mention affichée : « Votre abonnement n'est pas débité automatiquement… » — `renewalMode = AUTOMATIC` reste désactivé tant qu'aucun prestataire n'offre un vrai mandat de prélèvement.

## 5. Vérification en navigateur (Playwright, desktop + mobile)

Parcours rejoué avec de vrais identifiants, un vrai worker BullMQ et `ManualBillingAdapter` (substitut d'un appel Chariow réel, voir §8) :

1. Dashboard Facturation — essai, quotas, bascule mensuel/annuel.
2. Checkout → page de retour avant webhook (en attente) → après webhook traité par le worker (confirmé) → renouvellement appliqué.
3. Grâce, suspension, site public bloqué, données clients toujours accessibles.
4. Super Admin — formules, abonnements, détail avec journal d'audit.

## 6. Notifications d'échéance

J-7, J-3, J-1, jour J, début de grâce, suspension, renouvellement : chaque palier n'est déclenché qu'une fois par abonnement (testé, y compris une échéance déjà passée). **L'envoi réel (e-mail/WhatsApp) n'existe pas encore** : seule la mise en file est réelle et testée, ce qui est affiché dans l'interface Super Admin.

## 7. Audit de couverture (`ef6e4d4`)

Scénarios nommés dans le plan et jusque-là non prouvés (le code était correct, la preuve manquait) :

- Devise erronée avec montant correct.
- Produit erroné (`product_mismatch`).
- Prolongation manuelle Super Admin via `confirmSubscriptionPaymentSuccess` (acteur `super_admin` + justification journalisés).
- Rétention des données après suspension (produit et cliente intacts et accessibles).

## 8. Seul point bloqué

**Bac à sable Chariow réel** — `packages/billing/src/adapters/chariow.adapter.ts` n'a jamais été vérifié contre leur vraie API (endpoint, en-tête de signature, algorithme). Requis : `CHARIOW_SECRET_KEY` et `CHARIOW_WEBHOOK_SECRET` (sandbox ou montant symbolique).

## 9. Limites assumées

- Quota « employés » présent dans le registre, mais aucun pipeline d'invitation employé n'existe encore.
- Interface volontairement minimale (Tailwind fonctionnel, sans charte graphique).
- Barre latérale du dashboard mobile non repliable en menu.
- Erreurs 401 du worker sur `domain-dns-check` en local : `INTERNAL_WORKER_SECRET` absent du `.env` de test, pas une régression.
- Pas de proration au changement de formule ni de téléchargement de reçu (hors périmètre).

## 10. Commits

| Commit    | Contenu                                                                                   |
| --------- | ----------------------------------------------------------------------------------------- |
| `fb7cee7` | Environnement (OneDrive, encodage, dotenv, worker) + RLS connexion + blocage par défaut  |
| `eefa8ba` | Course critique suspension automatique / paiement concurrent                              |
| `cfee5ea` | Dépassement de quota sous requêtes simultanées                                            |
| `ef6e4d4` | Couverture : devise, produit, prolongation admin, rétention (tests uniquement)            |
| `9950bad` | Double libération de stock + rejet non géré à l'annulation (CI)                           |
| `32e4cef` | `upsert` non atomique pour le dédoublonnage client (CI)                                   |
| `26078f6` | Interblocage auto-infligé par un correctif précédent (CI)                                 |
| `4645347` | « Créer puis rattraper » corrigé par `SAVEPOINT`, appliqué à 3 endroits (CI)              |

`C:\yamacommerce-saas`, le dépôt OneDrive d'origine et GitHub (`master` et `main`) sont synchronisés sur `4645347`.
