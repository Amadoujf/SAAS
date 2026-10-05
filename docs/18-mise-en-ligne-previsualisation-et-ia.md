# 18 — Mise en ligne de la prévisualisation, clé IA, médias, extension du studio

Rien de ce document n'est exécuté sans accord explicite : achat du serveur, mise en
ligne, fusion et production restent soumis à validation.

## 1. Créer le serveur (Hetzner Cloud CX33, x86)

À faire par vous, depuis un ordinateur.

1. **Clé SSH** (sur votre ordinateur, une seule fois) :
   `ssh-keygen -t ed25519 -C "previsualisation-ycom"` puis afficher la partie publique :
   `cat ~/.ssh/id_ed25519.pub` (c'est elle, et seulement elle, que l'on donne à Hetzner).
2. **Compte et projet** : https://console.hetzner.cloud → créer un projet
   « Y-COM prévisualisation ».
3. **Ajouter un serveur** (« Add Server ») :
   - Location : Falkenstein, Nuremberg ou Helsinki (UE) ;
   - Image : **Ubuntu 24.04** ;
   - Type : **Shared vCPU → x86 (Intel/AMD) → CX33** (4 vCPU, 8 Go, 80 Go) — pas « Arm64 » ;
   - Networking : IPv4 publique **cochée** (payante, nécessaire pour sslip.io) et IPv6 ;
   - SSH keys : coller la clé publique de l'étape 1 ;
   - Firewalls : en créer un « previsualisation » : entrées TCP 22 (idéalement
     limitée à votre adresse IP), TCP 80 et TCP 443 ; rien d'autre ;
   - Backups : inutiles (base de démonstration recréable) ;
   - Nom : `ycom-preview`.
   Vérifiez le **prix total affiché** (serveur + IPv4, hors TVA) avant « Create & Buy now ».
4. Notez l'adresse IPv4 (ex. `203.0.113.10`).

## 2. Préparer et durcir le serveur

Activez d'abord la double authentification Hetzner et GitHub (docs/19, section 1).

```sh
ssh root@203.0.113.10
apt-get update && apt-get -y upgrade
curl -fsSL https://get.docker.com | sh          # Docker Engine + plugin Compose (dépôt officiel Docker)
```

Récupération du code (dépôt privé) : sur le serveur, `ssh-keygen -t ed25519 -f
~/.ssh/ycom_deploy`, puis GitHub → dépôt → Settings → Deploy keys → Add deploy key
(clé PUBLIQUE, **lecture seule**, « Allow write access » décoché). Ensuite :

```sh
mkdir -p /home/ycom && cd /home/ycom
GIT_SSH_COMMAND="ssh -i ~/.ssh/ycom_deploy" git clone git@github.com:Amadoujf/SAAS.git && cd SAAS
git checkout master        # la version fusionnée et validée, jamais une branche de travail
bash infra/preview/server/harden.sh    # SSH par clé, root interdit, pare-feu, fail2ban, mises à jour
```

**Avant de fermer la session root**, ouvrez un second terminal : `ssh ycom@203.0.113.10`
doit fonctionner. Ensuite, toujours `ssh ycom@…` puis `sudo` ; root n'est plus accessible.
Confier ensuite le code et la clé de déploiement à ycom (une seule fois, en root) :

```sh
install -o ycom -g ycom -m 600 /root/.ssh/ycom_deploy* /home/ycom/.ssh/
chown -R ycom:ycom /home/ycom/SAAS
sudo -u ycom git -C /home/ycom/SAAS config core.sshCommand "ssh -i ~/.ssh/ycom_deploy"
```

## 3. Renseigner les secrets et la clé IA (jamais dans une conversation)

```sh
cp infra/preview/.env.preview.example infra/preview/.env.preview
chmod 600 infra/preview/.env.preview
openssl rand -hex 32        # à exécuter une fois par secret (mots de passe, AUTH_SECRET, ENCRYPTION_KEY)
nano infra/preview/.env.preview
```

- `PREVIEW_DOMAIN=203-0-113-10.sslip.io` (votre IP, points remplacés par des tirets).
- `PREVIEW_ACCESS_CODE` : code long à transmettre aux personnes invitées.
- `PREVIEW_DEMO_PASSWORD` : mot de passe des comptes de démonstration (12 caractères minimum).
- `AI_PROVIDER_API_KEY` : **collée directement dans `nano` sur le serveur**, jamais par
  `echo` (historique du terminal), jamais dans un message, un ticket ou le dépôt.
- `AI_MODEL=claude-sonnet-5-5` (défaut) ; `claude-opus-5-5` pour comparer.
- `AI_PLATFORM_MONTHLY_CAP_XOF=15000`.
- `REDIS_PASSWORD`, `INTERNAL_WORKER_SECRET` : `openssl rand -hex 32` chacun.
- `HEALTHCHECK_PING_URL` : facultatif, voir docs/19 (surveillance).

Changer de clé : créer la nouvelle dans la console, la remplacer dans le fichier,
`docker compose -f infra/preview/docker-compose.yml --env-file infra/preview/.env.preview up -d`,
puis révoquer l'ancienne dans la console.

### Clé et limite côté fournisseur (console Anthropic)

1. https://console.anthropic.com → créer un **espace de travail** dédié
   « previsualisation-ycom » (Settings → Workspaces), pour isoler coûts et clés.
2. Dans cet espace, régler une **limite de dépenses de 25 USD par mois** (réglage des
   limites de l'espace de travail ou de l'organisation). Ce réglage dépend du type de
   compte : je n'ai pas pu le vérifier sur le vôtre — si la console ne le propose pas,
   le plafond Y-COM (15 000 FCFA) reste actif, et une alerte de facturation peut servir
   d'appoint.
3. Créer une **clé API dans cet espace** ; elle ne s'affiche qu'une fois : la coller
   directement sur le serveur (section 3).

### Plafonds appliqués (toute la prévisualisation, pas par client)

| Garde-fou | Où | Effet |
|---|---|---|
| 25 USD / mois | Console Anthropic | Refus par le fournisseur au-delà (définitif) |
| 15 000 FCFA / mois | `AI_PLATFORM_MONTHLY_CAP_XOF` | Coût maximal de chaque appel réservé AVANT l'appel (atomique) ; refus si la réserve dépasserait le plafond ; coût réel imputé ensuite |
| Quotas de la formule | Formule de chaque entreprise | 300 générations et 2 500 FCFA par mois et par entreprise (Business) |

Appels simultanés : chaque appel réserve d'abord son maximum (135 FCFA avec Sonnet 5.5,
269 FCFA avec Opus 5.5) par une seule instruction SQL ; vingt appels lancés en même
temps ne peuvent pas dépasser ensemble le plafond (test PostgreSQL). Nouvelles
tentatives : aucune reprise automatique cachée ; chaque tentative est un nouvel appel,
réservé et compté. Coût inconnu (coupure, délai, réponse illisible, serveur arrêté
pendant l'appel) : le maximum réservé est imputé par précaution.

## 4. Démarrer, vérifier, tester l'IA

```sh
docker compose -f infra/preview/docker-compose.yml --env-file infra/preview/.env.preview up -d --build
sudo bash infra/preview/server/setup-ops.sh                  # sauvegardes et surveillance (docs/19)
sh infra/preview/verify.sh infra/preview/.env.preview      # services, HTTPS, porte, démos
sh infra/preview/ai-trial/run.sh infra/preview/.env.preview  # banc d'essai IA (≈ 2 $ avec Sonnet)
```

Le rapport `infra/preview/ai-trial/out/<date>/index.html` (à copier sur votre
ordinateur : `scp -r ycom@203.0.113.10:SAAS/infra/preview/ai-trial/out .`) montre, pour
10 scénarios sur 5 catalogues de test : le coût réel de chaque génération, les trois
propositions en mode téléphone, les réponses aux demandes de modification, le site
publié à 390 px. Pour comparer avec Opus : `AI_MODEL=claude-opus-5-5`, `up -d`, puis
`ONLY=mode-ceremonie,auto-premium sh infra/preview/ai-trial/run.sh ...`.

Parcours à faire vous-même sur le téléphone : `https://<PREVIEW_DOMAIN>` → code →
connexion (compte de démo + `PREVIEW_DEMO_PASSWORD`) → Mon site → description →
propositions → brouillon → modification par conversation → publication.

Arrêt : `docker compose ... down` ; suppression complète : `down -v`, puis supprimer
le serveur dans la console Hetzner (la facturation s'arrête).

## 5. Ce que l'IA compose avec les médias existants, et ce qui demanderait une génération d'images ou de vidéos

| Disponible aujourd'hui (aucune intégration à ajouter) | Nécessiterait un fournisseur de génération d'images ou de vidéos |
|---|---|
| Choisir, parmi les photos de l'entreprise (produits, médiathèque), celles qui ouvrent le site, illustrent une section ou forment un lookbook | Créer une photo qui n'existe pas (mannequin portant la robe, mise en scène d'un plat, véhicule dans un décor) |
| Ordonner, recadrer à l'affichage (cadrages, formats portrait ou paysage), alterner les mises en page autour des photos | Retoucher une photo (détourage, fond changé, lumière corrigée, défaut retiré) |
| Couleurs, typographies, formes, animations, rythme, textes, ordre des sections | Produire une vidéo d'ouverture ou une animation à partir de photos |
| Signaler les produits sans photo et ne rien inventer à leur place | Générer des visuels de catégorie ou de bannière « à la manière de » la marque |
| Animations de défilement (déjà dans les sections immersives), à partir des photos existantes | Illustrations ou motifs créés à la demande |

Une intégration de génération demanderait : un fournisseur choisi (conditions
d'utilisation commerciale, droits sur les images, coût par image ou par seconde de
vidéo), un stockage des fichiers générés dans la médiathèque, une étiquette « image
générée » visible, la validation humaine avant publication, et un plafond de dépenses
séparé. Elle n'est pas intégrée.

## 6. Étendre le studio IA aux autres secteurs (plan, à valider)

Aujourd'hui : commerce et mode, restauration, automobile, éducation. Sans studio IA :
immobilier, voyage, salon, hôtel, livraison.

Principe : réutiliser la configuration sectorielle commune plutôt que de dupliquer le
studio. Le moteur sait déjà travailler par secteur (`SiteAiContext.mode`, table
`SECTOR` de `apps/web/lib/site-ai/compile.ts` : page d'accueil, liens des éléments,
libellés d'action, textes « signature »). Pour chaque secteur :

1. **Contexte** : charger ses éléments réels (biens, voyages, prestations, types de
   chambres, zones et tarifs) dans le même format que les produits, avec photos et prix.
2. **Configuration** : une entrée `SECTOR` (liens vers les fiches, action principale :
   « Demander une visite », « Réserver ce voyage », « Prendre rendez-vous », « Vérifier
   les disponibilités », « Envoyer un colis »).
3. **Sections** : brancher ses sections existantes dans les structures (archetypes),
   sans en inventer ; l'IA ne fait que choisir et ordonner.
4. **Vocabulaire** dans les consignes et la simulation, tests unitaires du compilateur,
   vérification navigateur 360 à 1440 px, scénarios ajoutés au banc d'essai.

Ordre proposé : salon et hôtel (catalogues proches des produits), puis immobilier et
voyage, puis livraison (vitrine simple autour du tarif instantané). Chaque secteur sera
livré séparément, avec ses tests, sans changer les secteurs déjà couverts.
