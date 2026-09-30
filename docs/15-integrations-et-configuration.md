# 15 — Intégrations : état réel et configuration de production

Ce document décrit, pour chaque service externe, **ce qui fonctionne aujourd'hui**, ce
qui manque, et **la configuration exacte** pour l'activer. L'état est aussi visible en
direct dans le tableau de bord : **Gestion → État des services**
(`/dashboard/services`), calculé à chaque affichage à partir des variables
d'environnement et de la configuration de l'entreprise (aucune valeur secrète n'est
affichée, seulement sa présence).

**Règle absolue** : les clés et secrets sont renseignés dans les **variables
d'environnement du serveur** (gestionnaire de secrets de l'hébergeur), jamais dans le
code, jamais dans un fichier versionné, jamais dans une conversation.

## Règles d'honnêteté appliquées partout

| Situation | Ce qui est affiché | Ce qui n'est jamais affiché |
|---|---|---|
| Notification créée, pas encore traitée | « En file d'attente » | « Envoyée » |
| Aucun fournisseur pour ce canal | « Non envoyée — aucun fournisseur configuré » | « Envoyée » |
| Encaissement saisi par l'équipe (espèces, Wave, OM, virement, terminal) | « Encaissement enregistré par l'équipe », reçu `REC-…` | « Paiement en ligne » |
| Assistant en mode simulé | « Simulation locale — pas une génération IA » | « Généré par l'IA » |
| Paiement en ligne en mode test | « Mode test (sandbox) » | « Payé » avec de l'argent réel |

## 1. Assistant IA (studio « Mon site »)

**État du code** : branché sur l'API Anthropic via le SDK officiel
(`apps/web/lib/ai/provider.ts`) — sorties structurées validées par schéma
(`beta.messages.parse` + `betaZodOutputFormat`), réflexion adaptative, repli
automatique côté serveur en cas de refus (`server-side-fallback-2026-07-01`,
`fallbacks: "default"`), mise en cache du prompt système, quotas et coûts suivis par
entreprise (`AIUsageRecord`), échecs journalisés. L'IA ne renvoie que des données
(configuration de sections), jamais du code exécuté ; elle ne fixe jamais de prix, de
stock ni de produit.

| Variable | Obligatoire | Effet |
|---|---|---|
| `AI_PROVIDER_API_KEY` | oui (production) | Clé API Anthropic (console Anthropic → API Keys). Présente = génération réelle. |
| `AI_MODEL` | non | Modèle utilisé. Défaut : `claude-opus-5-5` (4 $ / 20 $ par million de jetons en entrée / sortie). |
| `AI_USD_TO_XOF` | non | Taux de conversion pour l'estimation des coûts en FCFA (défaut 610). |
| `AI_PROVIDER=simulated` | **développement uniquement** | Règles locales déterministes, toujours étiquetées « simulation ». Refusé si `NODE_ENV=production`. |

Sans clé en production : l'assistant affiche « le fournisseur IA n'est pas encore
configuré » et ne propose rien (aucune simulation déguisée).

**Mise en service** : 1) créer la clé dans la console Anthropic (organisation de
l'entreprise exploitante, limite de dépense mensuelle recommandée) ; 2) la renseigner
dans les secrets de l'hébergeur ; 3) redémarrer ; 4) vérifier « État des services » →
« Assistant IA : Opérationnel » ; 5) faire une première création sur la démo.

## 2. Notifications

Chaîne commune à tous les secteurs : l'événement métier écrit une ligne `queued` dans
`NotificationLog` dans la même transaction ; après validation, elle est mise en file
(Redis / BullMQ) ; le **worker** (`apps/worker`) la traite et fixe le statut final
selon la réponse RÉELLE du fournisseur.

| Canal | État | Configuration |
|---|---|---|
| Interne (équipe) | Opérationnel | — |
| E-mail | Opérationnel **si** configuré | `RESEND_API_KEY`, `EMAIL_FROM` (domaine d'envoi vérifié chez Resend). Sans eux : « non envoyée — aucun fournisseur ». |
| WhatsApp | **Pas encore branché** | Compte WhatsApp Business par entreprise (Embedded Signup Meta), `WHATSAPP_META_APP_ID`, `WHATSAPP_META_APP_SECRET`, puis développement de l'envoi. |
| SMS | **Pas encore branché** | Fournisseur à choisir (Twilio ou opérateur local) : `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, puis développement de l'envoi. |

Le worker doit tourner en production (`apps/worker`, même `DATABASE_URL`/`REDIS_URL`).
Sans worker, les notifications restent « en file d'attente » — affichées comme telles.

## 3. Paiements des clients des entreprises

| Moyen | Nature | État | Configuration |
|---|---|---|---|
| Espèces, carte sur terminal, virement | Encaissement manuel | Opérationnel | Saisi par l'équipe, reçu numéroté `REC-AAAA-NNNNNN`, annulation motivée. |
| Wave / Orange Money (numéro de l'entreprise) | Encaissement manuel | Opérationnel | Numéros dans « Moyens de paiement » ; le client transfère, l'équipe vérifie et enregistre. **Pas un paiement en ligne.** |
| Paiement à la livraison | Encaissement manuel | Opérationnel (boutique) | Activé dans « Moyens de paiement ». |
| PayDunya | **Paiement en ligne** | Branché sur la **boutique en ligne uniquement** | Clés marchandes de l'entreprise (chiffrées dans `PaymentProviderConfig`) ou identifiants plateforme `PAYDUNYA_MODE`, `PAYDUNYA_MASTER_KEY`, `PAYDUNYA_PRIVATE_KEY`, `PAYDUNYA_PUBLIC_KEY`, `PAYDUNYA_TOKEN` + `ENCRYPTION_KEY`. Une commande n'est « payée » qu'après confirmation par webhook. |
| SamirPay | Paiement en ligne | **Non intégré** | À confirmer avec le fournisseur (documentation API, environnement de test, conditions). |

Les secteurs à réservation (voyage, hôtel, salon, automobile, éducation…) et le
restaurant n'ont **pas** de paiement en ligne à ce jour : tous leurs encaissements sont
manuels (service commun `payment-ledger`).

**Chariow** est réservé aux **abonnements des entreprises à Y-COM** (`SAAS_BILLING_PROVIDER=chariow`,
`CHARIOW_SECRET_KEY`, `CHARIOW_WEBHOOK_SECRET`) — jamais aux paiements de leurs clients.

## 4. Service commun des encaissements

Deux tables, un seul service (`packages/database/src/payment-ledger.ts`) :
`ReservationPayment` (encaissement d'une réservation) et `RestaurantPayment`
(encaissement d'une commande du restaurant, qui n'est pas une réservation). Chacune
garde une clé étrangère réelle vers son objet ; moyens de paiement, numérotation des
reçus, règles d'annulation et journal en lecture sont communs.
