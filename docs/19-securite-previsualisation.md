# 19 — Sécurité de la prévisualisation : comptes, serveur, secrets, sauvegardes, alertes

Rien n'est acheté, déployé ni ouvert au public sans accord explicite. La prévisualisation
reste **privée** (code d'accès, pages non indexées) et ne contient que des **données de
démonstration** (base dédiée, entreprises fictives).

## 1. Double authentification (à faire vous-même, avant le serveur)

Une application d'authentification suffit (Google Authenticator, Microsoft Authenticator,
2FAS, Aegis, 1Password…). **Les codes de secours ne se donnent à personne** : imprimez-les
ou rangez-les dans un gestionnaire de mots de passe, hors du téléphone.

### Hetzner

1. Connectez-vous sur https://accounts.hetzner.com (le même compte sert à la console Cloud).
2. Menu **Security** (« Sécurité ») → **Two-factor authentication** → activer.
3. Scannez le QR code avec l'application, saisissez le code à 6 chiffres affiché.
4. Enregistrez les **codes de secours** proposés.
5. Vérification : déconnectez-vous, reconnectez-vous ; le code doit être demandé.

Les libellés exacts peuvent légèrement varier ; l'option se trouve toujours dans les
réglages de sécurité du compte, pas dans un projet.

### GitHub

1. https://github.com → photo de profil → **Settings** → **Password and authentication**.
2. **Enable two-factor authentication** → **Authenticator app** → scanner le QR code →
   saisir le code.
3. **Download** les codes de secours (fichier `github-recovery-codes.txt`) et rangez-les.
4. Recommandé : ajouter aussi une **passkey** (même page) comme seconde méthode, pour ne
   pas perdre l'accès si le téléphone est perdu.
5. Vérification : la page affiche « Two-factor authentication: Enabled ».

## 2. Où saisir les secrets (jamais dans une conversation)

| Secret | Où | Comment |
|---|---|---|
| Mots de passe base, Redis, `AUTH_SECRET`, `ENCRYPTION_KEY`, secret interne | `infra/preview/.env.preview` sur le serveur (ycom, mode 600) | `openssl rand -hex 32`, copier-coller dans `nano` |
| Clé IA (`AI_PROVIDER_API_KEY`) | même fichier | collée directement depuis la console Anthropic |
| Mot de passe de chiffrement des sauvegardes (`RESTIC_PASSWORD`) | `/etc/ycom-backup/backup.env` (root, mode 600) | `openssl rand -base64 32` ; **copie aussi dans votre gestionnaire de mots de passe** |
| Clé SSH de sauvegarde | `/etc/ycom-backup/storagebox_ed25519` (root, 600) | générée par `setup-ops.sh`, seule la partie publique sort |
| Mot de passe sudo de ycom | saisi à l'invite de `harden.sh` | jamais utilisé pour SSH |

Règles : jamais `echo secret > fichier` (historique du terminal), jamais dans le dépôt
(`.env.preview` est ignoré par git), jamais dans un message, une capture ou un ticket.
Vérifier les droits : `ls -l infra/preview/.env.preview /etc/ycom-backup` (`-rw-------`).
Une clé exposée par erreur se **révoque** dans la console du fournisseur puis se remplace.

## 3. Serveur

`harden.sh` (une fois, en root, juste après la création) :

- un seul administrateur `ycom`, connexion **par clé uniquement** ; root et mots de passe
  refusés en SSH ; `AllowUsers ycom`, 3 essais, pas de redirection de ports ;
- pare-feu **ufw** : 22 (limité en débit), 80, 443 ; tout le reste fermé en entrée ;
- **fail2ban** : bannit les adresses qui insistent sur SSH ;
- **mises à jour de sécurité automatiques** (Ubuntu et Docker), redémarrage la nuit à
  04:30 si nécessaire ;
- Docker : journaux plafonnés, `no-new-privileges`, `live-restore` ; réglages réseau
  noyau durcis.

Dans la console Hetzner Cloud, en plus :
- **Firewall** « previsualisation » (TCP 22, 80, 443 en entrée), appliqué au serveur :
  double barrière avec ufw, filtrée avant même d'atteindre la machine ;
- serveur → **Protection** → cocher « Delete » et « Rebuild » (évite une suppression par
  erreur).

### Pile applicative (`infra/preview/docker-compose.yml`)

- seul **Caddy** publie des ports (80/443, HTTPS automatique, en-têtes de sécurité,
  corps de requête plafonnés, `/api/internal/*` inaccessible depuis Internet) ;
- **PostgreSQL et Redis** sont sur un réseau Docker interne, **sans port publié et sans
  accès Internet** ; Redis exige un mot de passe ;
- web et worker tournent sans root, sans aucune capacité Linux, sans les secrets
  d'administration (réservés au conteneur de migration) ;
- appels worker → web authentifiés par un secret interne (comparaison à temps constant).

## 4. Application (protections vérifiées)

- **Isolation entre entreprises** : PostgreSQL RLS forcé sur **toutes** les tables
  (test automatique qui échoue si une nouvelle table l'oublie) ; le rôle applicatif n'est
  ni superutilisateur ni `BYPASSRLS`. Seule exception assumée : `User` (lu à la connexion,
  avant tout contexte d'entreprise ; jamais exposé sans contrôle applicatif).
- **Permissions** : rôles OWNER / MANAGER / STAFF… ; valider un paiement exige
  `orders.update_status` + `payments.view` (OWNER et MANAGER).
- **Fichiers importés** : jetons signés à durée limitée, taille plafonnée à la réception,
  signature réelle du fichier vérifiée (SVG/HTML refusés), fichiers servis sans exécution
  possible (`nosniff`, CSP « sandbox »), isolés par entreprise.
- **Paiements** : prix recalculés côté serveur (jamais ceux du navigateur) ; webhooks à
  signature vérifiée, idempotents, protégés contre l'usage croisé entre entreprises,
  corps plafonné ; une commande en attente n'est jamais affichée payée ; Chariow ne sert
  qu'aux abonnements.

## 5. Sauvegardes hors serveur

- **Quoi** : base complète (pg_dump), fichiers importés, configuration (`.env.preview`), le tout chiffré.
- **Où** : dépôt **restic chiffré** sur une **Hetzner Storage Box** (autre machine,
  accès SFTP par clé dédiée). Sans `RESTIC_PASSWORD`, les sauvegardes sont illisibles —
  y compris pour Hetzner.
- **Quand** : chaque nuit à 03:15 ; conservation 7 jours, 4 semaines, 6 mois.
- **Test de restauration réel chaque dimanche** : intégrité de 5 % des données, base
  restaurée dans un conteneur jetable sans réseau, comparaison des comptages avec la base
  en service, RLS vérifié, fichiers et configuration restaurés.
- **Restauration complète** (sinistre) : `sudo bash infra/preview/backup/restore.sh`
  (demande de taper RESTAURER).

Mise en place (après achat validé de la Storage Box) :

```sh
# Console Hetzner → Storage Box → Settings : activer « SSH support » et « External reachability »
sudo cat /etc/ycom-backup/storagebox_ed25519.pub \
  | ssh -p 23 uXXXXXX@uXXXXXX.your-storagebox.de install-ssh-key   # mot de passe de la box, une fois
sudo sh -c 'ssh-keyscan -p 23 uXXXXXX.your-storagebox.de > /etc/ycom-backup/known_hosts'
sudo nano /etc/ycom-backup/backup.env      # RESTIC_REPOSITORY, RESTIC_PASSWORD, URLs healthchecks
sudo systemctl start ycom-backup && journalctl -u ycom-backup -n 50
sudo systemctl start ycom-restore-test && journalctl -u ycom-restore-test -n 80
```

## 6. Surveillance et alertes

Compte gratuit sur https://healthchecks.io (alertes par e-mail ou Telegram).
Créer trois contrôles et coller chaque URL de ping sur le serveur :

| Contrôle | Période / délai de grâce | Variable |
|---|---|---|
| Serveur (battement) | 5 min / 10 min | `HEALTHCHECK_PING_URL` dans `.env.preview` |
| Sauvegarde | 1 jour / 2 h | `HEALTHCHECK_BACKUP_URL` dans `backup.env` |
| Test de restauration | 7 jours / 6 h | `HEALTHCHECK_RESTORE_URL` dans `backup.env` |

Le battement vérifie toutes les 5 minutes : services démarrés, disque < 85 %, page
d'accès en HTTPS, certificat valable plus de 14 jours, redémarrage en attente depuis plus
de 30 h. Une anomalie envoie une alerte avec le détail ; un serveur éteint ou injoignable
déclenche aussi l'alerte (absence de signal). Facultatif : UptimeRobot (gratuit) pour un
contrôle extérieur de `https://<PREVIEW_DOMAIN>/acces-previsualisation`.

Consulter : `systemctl list-timers 'ycom-*'`, `journalctl -u ycom-heartbeat -n 20`.

## 7. Coûts supplémentaires (rien n'est engagé sans votre accord)

| Élément | Coût | Indispensable ? |
|---|---|---|
| Hetzner Storage Box BX11 (1 To) | environ 3 à 4 € / mois — **vérifiez le prix affiché** avant de commander | Oui pour des sauvegardes hors serveur |
| healthchecks.io (plan gratuit, 20 contrôles) | 0 € | Recommandé |
| UptimeRobot (plan gratuit) | 0 € | Facultatif |
| Sauvegardes automatiques Hetzner Cloud (20 % du prix du serveur) | ≈ 1,5 € / mois | Non : restic les remplace et est testé |

## 8. Ouverture au public

Pas avant votre accord. La prévisualisation garde le code d'accès, `noindex` et les
données fictives. Une ouverture publique demandera d'abord : votre validation, un domaine
définitif, la désactivation du code d'accès sur ce domaine seulement, et une revue des
comptes de démonstration.
