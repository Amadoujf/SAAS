# 16 — Prévisualisation privée

Une copie **séparée** de Y-COM, accessible depuis un téléphone, pour montrer les
démonstrations sectorielles à quelques personnes invitées. Ce n'est **pas** la
production : base de démonstration dédiée (`yamacommerce_preview`), Redis et fichiers
dédiés, paiements en mode test, aucune donnée réelle de client.

## Protection

| Mesure | Détail |
|---|---|
| Code d'accès | `PREVIEW_ACCESS_CODE` défini ⇒ toute page renvoie vers `/acces-previsualisation`; toute API répond `401` sans le cookie `yc_preview`. |
| Cookie | Contient l'empreinte SHA-256 du code, jamais le code ; `HttpOnly`, `Secure`, `SameSite=Lax`, valable sur tous les sous-domaines (`PREVIEW_COOKIE_DOMAIN`). Changer le code révoque tous les accès. |
| Comparaison | À temps constant (`timingSafeEqual`), avec limitation du nombre d'essais. |
| Indexation | `X-Robots-Tag: noindex` sur chaque réponse (middleware et Caddy), `robots.txt` interdit tout. |
| Exemptions | Seulement la page du code, son API, les fichiers statiques et `/api/domains/ask` (utilisé par Caddy pour les certificats). |
| Redirection | Le paramètre `suite` n'accepte qu'un chemin interne (pas de redirection ouverte). |

Sans `PREVIEW_ACCESS_CODE`, rien ne change : le développement local et la production
ne sont pas concernés.

## Contenu

`infra/preview/init-demo-db.sh` (service `migrate`, exécuté une fois) :
`prisma migrate deploy`, mot de passe du rôle applicatif, données de base, puis les
démonstrations commerce, immobilier, voyage, salon, hôtel, restaurant, automobile,
éducation et livraison. Les scripts de démo ne recréent pas une démo déjà présente.

## Mise en place (après validation, sur un serveur choisi)

1. Serveur Linux avec Docker (2 vCPU, 4 Go de RAM recommandés : la construction de
   l'image Next.js est la phase la plus gourmande).
2. `git clone` du dépôt, branche à présenter.
3. `cp infra/preview/.env.preview.example infra/preview/.env.preview`, puis renseigner
   les valeurs **sur le serveur** (`openssl rand -hex 32` pour les secrets). Ce fichier
   est ignoré par Git.
4. Domaine : `PREVIEW_DOMAIN=<ip-avec-tirets>.sslip.io` (aucun achat), ou un
   sous-domaine à vous avec un enregistrement DNS joker vers l'IP du serveur.
5. `docker compose -f infra/preview/docker-compose.yml --env-file infra/preview/.env.preview up -d --build`
6. Ouvrir `https://<PREVIEW_DOMAIN>` sur le téléphone, saisir le code.
   Les démos sont sur `https://<slug>.<PREVIEW_DOMAIN>` (le cookie couvre les
   sous-domaines).
7. Arrêt : `docker compose ... down` (ajouter `-v` pour effacer la base de démonstration).

IA : sans `AI_PROVIDER_API_KEY`, l'assistant l'indique clairement ; aucune simulation
n'est présentée comme une génération réelle. E-mails : sans `RESEND_API_KEY`, les
notifications restent « non envoyées — aucun fournisseur configuré ».

## Ce qui a été vérifié, et ce qui ne l'a pas été

Vérifié (dans l'environnement de développement) :
- tests unitaires du module `lib/preview` (empreinte, exemptions, chemin de retour) ;
- porte d'accès dans un navigateur et avec `curl` : redirection sans cookie, `401` sur
  les API, mauvais code refusé, bon code accepté, cookie valable sur un sous-domaine
  de démo, en-tête `noindex` ;
- `init-demo-db.sh` exécuté sur une base PostgreSQL vide : migrations et les neuf
  démonstrations créées sans erreur.

**Non vérifié** : la construction de l'image Docker et le démarrage de la pile
`docker compose` (téléchargement des images de base bloqué dans l'environnement de
développement), ni l'émission des certificats par Caddy. À contrôler lors du premier
déploiement de prévisualisation.
