# 16 — Prévisualisation privée

Une copie **séparée** de Y-COM, accessible depuis un téléphone, pour montrer les
démonstrations sectorielles et tester l'assistant IA avec une vraie clé. Ce n'est
**pas** la production : base de démonstration dédiée (`yamacommerce_preview`), Redis et
fichiers dédiés, paiements en mode test, aucune donnée réelle de client.

## Protection

| Mesure | Détail |
|---|---|
| Code d'accès | `PREVIEW_ACCESS_CODE` défini ⇒ toute page renvoie vers `/acces-previsualisation` ; toute API répond `401` sans le cookie `yc_preview`. |
| Cookie | Contient l'empreinte SHA-256 du code, jamais le code ; `HttpOnly`, `Secure`, `SameSite=Lax`, valable sur tous les sous-domaines (`PREVIEW_COOKIE_DOMAIN`). Changer le code révoque tous les accès. |
| Comparaison | À temps constant (`timingSafeEqual`), 8 essais par quart d'heure et par adresse. |
| Indexation | `X-Robots-Tag: noindex` sur chaque réponse (middleware et Caddy), `robots.txt` interdit tout. |
| Comptes de démo | Leur mot de passe public (écrit dans les scripts de démo) est remplacé par `PREVIEW_DEMO_PASSWORD` à l'initialisation. |
| Exemptions | Seulement la page du code, son API, les fichiers statiques et `/api/domains/ask` (utilisé par Caddy pour les certificats). |

Sans `PREVIEW_ACCESS_CODE`, rien ne change : le développement local et la production
ne sont pas concernés.

## Contenu

`infra/preview/init-demo-db.sh` (service `migrate`, exécuté une fois) :
`prisma migrate deploy`, mot de passe du rôle applicatif, données de base, les neuf
démonstrations (commerce, mode, immobilier, voyage, salon, hôtel, restaurant, automobile,
éducation, livraison) et les entreprises de test du banc d'essai IA, puis le mot de passe de prévisualisation des comptes de démo.
Les démos sont servies sur `https://<entreprise>.<PREVIEW_DOMAIN>`.

## Clé IA et plafond de dépenses

La clé n'est **jamais** envoyée dans une conversation, un ticket ou le dépôt.

1. Console Anthropic : créer un espace de travail dédié « prévisualisation », y régler
   une **limite de dépenses mensuelle** (garde-fou définitif, appliqué par le
   fournisseur), puis créer une clé dans cet espace.
2. Sur le serveur, par SSH : l'écrire dans `infra/preview/.env.preview`
   (`AI_PROVIDER_API_KEY=…`), fichier ignoré par Git, droits `chmod 600`.
3. `AI_PLATFORM_MONTHLY_CAP_XOF` (défaut 15 000) : plafond Y-COM de toute la
   prévisualisation. Le coût maximal de chaque appel est réservé avant l'appel
   (atomique, appels simultanés compris), puis remplacé par le coût réel ; une fois
   atteint, l'assistant se met en pause jusqu'au mois suivant. Il s'ajoute aux quotas et
   plafonds de chaque formule. Modèle par défaut : `claude-sonnet-5-5` (`AI_MODEL`).
   Étapes détaillées, limites fournisseur et banc d'essai : docs/18.
4. `docker compose ... up -d` pour prendre la clé en compte ; « État des services »
   (`/dashboard/services`) affiche le modèle et le plafond, jamais la clé.

Chaque génération enregistre les jetons réellement facturés et son coût estimé : les
premiers essais donnent le coût réel, à comparer aux estimations de docs/17.

## Mise en place (après validation, sur un serveur choisi)

1. Serveur Linux x86_64 (Intel/AMD) avec Docker Engine et le plugin Compose ; ports 80
   et 443 ouverts. Architecture ARM non testée.
2. `git clone` du dépôt, branche à présenter.
3. `cp infra/preview/.env.preview.example infra/preview/.env.preview`, puis renseigner
   les valeurs **sur le serveur** (`openssl rand -hex 32` pour les secrets).
4. Domaine : `PREVIEW_DOMAIN=<ip-avec-tirets>.sslip.io` (aucun achat), ou un
   sous-domaine à vous avec un enregistrement DNS joker vers l'IP du serveur.
5. `docker compose -f infra/preview/docker-compose.yml --env-file infra/preview/.env.preview up -d --build`
6. `sh infra/preview/verify.sh infra/preview/.env.preview` : services, HTTPS, porte
   d'accès, noindex, API fermées, chaque démonstration.
7. Sur le téléphone : `https://<PREVIEW_DOMAIN>`, saisir le code, se connecter avec un
   compte de démo et `PREVIEW_DEMO_PASSWORD`, puis parcours IA : description →
   propositions → brouillon → modification par conversation → publication.
8. Arrêt : `docker compose ... down` (ajouter `-v` pour effacer la base de démonstration).

## Ce qui a été vérifié, et ce qui ne l'a pas été

Vérifié dans l'environnement de développement, avec la pile `docker compose` complète :
- construction de l'image avec le `Dockerfile` du dépôt. Seule exception : l'étape
  `apt-get` (openssl, ca-certificates), car `deb.debian.org` est bloqué dans cet
  environnement ; les mêmes paquets Debian bookworm ont été fournis par l'image
  officielle `node:20-bookworm` ;
- démarrage de tous les services (db, redis, migrate terminé à 0, web, worker, caddy)
  sur des volumes vides, les neuf démos et le remplacement des mots de passe ;
- `verify.sh` entièrement au vert : HTTPS par Caddy (autorité interne de Caddy à la
  place de Let's Encrypt), porte d'accès, noindex, API fermées, onze sites de démo ;
- navigateur à 390 px : porte d'accès → boutique de démo → connexion (ancien mot de
  passe public refusé) → « Mon site » avec l'assistant.

Corrigé grâce à ces essais :
- pnpm était retéléchargé à chaque démarrage de conteneur (désormais inclus dans l'image) ;
- le domaine de la plateforme n'obtenait pas de certificat (Caddy : certificat classique
  pour le domaine principal, à la demande pour les sous-domaines) ;
- les démos de base gardaient `*.yamacommerce.ai` au lieu du domaine de prévisualisation ;
- le script de démo du restaurant échouait le soir (créneaux déjà passés) ;
- deux premières générations IA simultanées d'un mois pouvaient échouer (ligne d'usage).

**Non vérifié ici** : certificats Let's Encrypt réels (exigent un serveur joignable
depuis Internet) et parcours avec une vraie clé IA. Les deux se vérifient sur le
serveur, étapes 6 et 7.
