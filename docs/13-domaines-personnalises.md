# 13. Domaines personnalisés et sous-domaines gratuits

Assistant permettant à un client de connecter un domaine déjà acheté (chez n'importe
quel registrar) à son site, ou de réclamer un sous-domaine gratuit
(`boutique.yamacommerce.ai`). Voir `packages/domains` (logique métier), le pipeline
`apps/web/lib/domains/*`, les routes `/api/domains/*` et `/api/admin/domains/*`, et
`infra/Caddyfile` (TLS à la demande).

L'achat automatique de domaines (revente OpenSRS) est explicitement **hors périmètre**
pour l'instant — voir la revue du 18 septembre 2026 : connecter des domaines déjà
achetés par le client suffit pour démarrer. Les domaines restent une fonction commune ;
le cœur du SaaS est la création de sites premium par secteur (immobilier, voyage,
commerce, services, etc.) — le développement doit refléter cette priorité.

## Cycle de vie d'un domaine

`DRAFT → PENDING_DNS → VERIFYING → VERIFIED → SSL_PENDING → ACTIVE`, avec les statuts
d'exception `MISCONFIGURED`, `SUSPENDED`, `EXPIRED`, `REMOVED`. Voir
`packages/database` (`DomainLifecycleStatus`) et `packages/domains/src/resolve.ts`
pour les deux questions distinctes posées à ce statut :

- **Résolution publique** (`resolveTenantByHost`/`resolveActiveDomainByHost`) :
  n'accepte QUE `ACTIVE` — jamais un domaine suspendu, retiré, ou pas encore prêt.
- **Éligibilité à l'émission TLS** (`isDomainAllowedForTls`, consultée par Caddy via
  `/api/domains/ask`) : accepte `VERIFIED`/`SSL_PENDING`/`ACTIVE`, sinon aucun
  certificat ne pourrait jamais être émis. Refuse aussi si le TENANT est suspendu,
  même si le domaine lui-même est `ACTIVE` (défense en profondeur).

## Preuves obtenues sur infrastructure réelle (revue du 18 septembre 2026)

À la demande explicite d'une revue précédente ("`prisma migrate diff` ne prouve pas
que la migration et l'isolation fonctionnent sur un vrai PostgreSQL" / "la
démonstration simule la propagation DNS et le SSL"), les vérifications suivantes ont
été faites contre de VRAIES infrastructures plutôt que des simulations :

- **PostgreSQL réel** (`embedded-postgres`, instance isolée, jamais l'instance système
  existante) : migrations + RLS exécutées pour de vrai. A trouvé et corrigé 4 bugs
  jusque-là invisibles (tests silencieusement ignorés sans base de données) :
  validation de section trop faible dans `updatePageBlocks`/`finalizePublish`
  (`packages/database/src/site-versions-registry.ts`), brouillon vide créé par
  `getOrCreateDraftVersion` quand seule une version non-brouillon existe, un appel
  `prisma` nu contournant la RLS dans un test, et un nettoyage de test incomplet
  (`Counter`) provoquant une violation de clé étrangère.
- **Sécurité de la résolution publique** : `packages/domains/src/resolve.test.ts`
  couvre exhaustivement les 10 statuts de cycle de vie (aucun sauf `ACTIVE` ne résout
  un tenant), le cas tenant-suspendu, et documente explicitement que
  `resolveTenantByHost` ne vérifie PAS lui-même `tenant.status` pour les statuts
  intermédiaires — c'est `resolvePublicSite` qui doit le faire séparément.
- **Vrai binaire Caddy (v2.11.4) + vraie décision `/api/domains/ask` contre
  PostgreSQL réel** : a permis de détecter que `infra/Caddyfile` utilisait des
  options `interval`/`burst` supprimées par Caddy 2.11 — ce fichier n'aurait jamais pu
  démarrer en production tel quel. Corrigé et revalidé avec le vrai binaire.
- **Test activation → suspension avec certificat déjà en cache** (exigé
  explicitement, car refuser un certificat NEUF ne prouve rien sur un certificat déjà
  émis) : a révélé que Caddy ne reconsulte `ask` qu'à l'émission/au renouvellement
  d'un certificat, jamais à chaque connexion. Un domaine suspendu restait donc
  accessible en HTTPS via son certificat déjà émis, sans plus jamais retoucher `ask`.
  Voir `CaddyDomainProvider.revokeDomain` (packages/domains/src/providers/
  caddy.provider.ts) : supprime maintenant les fichiers de certificat du `FileStorage`
  de Caddy (`CADDY_CERT_STORAGE_PATH`, voir .env.example) plutôt que de ne rien faire.

## Limite résiduelle connue — révocation TLS non instantanée sur un processus Caddy déjà démarré

Le correctif ci-dessus a été vérifié pour de vrai selon trois scénarios :

1. Certificat supprimé du disque, **processus Caddy toujours actif** → la connexion
   HTTPS réussit ENCORE (cache mémoire de CertMagic non purgé par la suppression du
   fichier).
2. Rechargement de configuration via l'API admin Caddy (`POST /load`) sur ce même
   processus → la connexion réussit TOUJOURS (un rechargement de config ne vide pas le
   cache de certificats on-demand, volontairement, pour éviter une réémission massive
   à chaque déploiement).
3. **Redémarrage complet du processus Caddy**, fichier déjà supprimé → la connexion
   ÉCHOUE enfin (Caddy ne trouve plus de certificat, reconsulte `ask`, qui refuse) : le
   correctif fonctionne, mais seulement à partir du prochain redémarrage/de la
   prochaine réplique.

Caddy n'expose aucune API publique pour invalider immédiatement un certificat
on-demand déjà chargé en mémoire par un processus en cours d'exécution — c'est une
limite de Caddy lui-même, pas un oubli côté YamaCommerce. Implication opérationnelle :
après une suspension/un retrait urgent, un redémarrage (ou redéploiement) de Caddy est
nécessaire pour une révocation immédiate ; sans cela, l'exposition dure jusqu'au
renouvellement naturel du certificat (des semaines avec un vrai émetteur ACME). Pistes
pour lever cette limite plus tard : migrer vers `CloudflareCustomHostnameProvider`
(déjà implémenté dans ce paquet) qui expose une VRAIE API de suppression de hostname,
ou adopter des certificats à durée de vie courte.

## Vérifications qui restent ouvertes

- **DNS public et certificat public réels** : le test Caddy ci-dessus est entièrement
  local (`tls internal`, résolution DNS forcée via `--resolve`/hosts, aucun domaine
  public, aucun appel réel à Let's Encrypt/ZeroSSL). Reste à vérifier avec un domaine
  possédé pour de vrai, une propagation DNS publique réelle, et un certificat ACME
  public réellement émis, avant un premier lancement client.
- **Interface Super Admin (`/admin/domains`) non vérifiée dans un vrai navigateur** :
  le typecheck passe et le composant est couvert par des tests de rendu réels
  (`components/admin/admin-domains-panel.test.tsx`, contrat d'API fidèle aux vraies
  routes), mais une tentative de démarrer `next dev` contre PostgreSQL/Redis isolés
  pour un test navigateur réel est restée bloquée sur ce poste (aucune réponse même
  après plusieurs minutes sur la page de connexion, cause probable : synchronisation
  OneDrive du dossier de travail ralentissant fortement les compilations webpack). À
  refaire dans un environnement sans ce problème avant mise en production.
- **Notifications** : les événements du cycle de vie (`domain_verified`,
  `https_enabled`, `domain_misconfigured`) sont journalisés (`AuditLog`) et mis en
  file (`notificationsQueue`), mais l'envoi réel (SMS/WhatsApp/e-mail) reste un TODO —
  même convention que `emailsWorker`/`invoicesWorker`/`aiJobsWorker`/`importsWorker`
  dans `apps/worker/src/index.ts` (tous Phase 1/2, pas une lacune propre aux
  domaines). À regrouper dans l'étape commune e-mails/WhatsApp plutôt que refaite en
  double pour les domaines seuls — reste une exigence à livrer, pas à abandonner.
- **CI non activée** : `.github/workflows/ci.yml` est déjà complet et réel (services
  PostgreSQL 17 + Redis 7, migrations réelles, seed réel, lint, typecheck, TOUS les
  tests y compris l'isolation RLS) — mais ce dépôt n'a pas de remote GitHub configuré,
  donc ce workflow ne s'est jamais exécuté. À activer (pousser vers un remote GitHub)
  avant de considérer la CI comme une protection effective contre les régressions.
