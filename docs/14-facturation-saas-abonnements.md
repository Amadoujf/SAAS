# Facturation SaaS — abonnements des entreprises à la plateforme

Voir docs/01 à docs/13 pour le reste du produit. Ce document couvre EXCLUSIVEMENT les
paiements des **entreprises** à **YamaCommerce AI** pour leur propre abonnement à la
plateforme — jamais les paiements des clients finaux sur le site d'une entreprise
(voir docs/07-parcours-paiement-facture.md et `packages/payments` pour ce second
domaine, entièrement séparé : modèles, webhooks, et routes ne sont jamais partagés).

## Principe : prépayé, renouvellement manuel, aucun prélèvement non autorisé

Au lancement, `packages/billing` n'implémente qu'un seul mode : le client choisit une
formule (mensuelle ou annuelle), le serveur crée une session de paiement Chariow, le
client est redirigé vers le checkout hébergé Chariow, confirme lui-même le paiement, et
seul un webhook Pulse Chariow **authentifié côté serveur** active ou prolonge
l'abonnement. Jamais un prélèvement initié par la plateforme sans confirmation
explicite du client à CHAQUE paiement.

`TenantSubscription.renewalMode`/`SubscriptionPlan.renewalMode` portent deux valeurs :
- `MANUAL` — seul mode utilisable aujourd'hui.
- `AUTOMATIC` — réservé au schéma, structurellement impossible à activer : aucun
  adaptateur de `packages/billing` n'implémente un mandat de paiement récurrent
  conforme. Toute tentative de configurer `AUTOMATIC` doit être refusée par
  l'application tant que cette phrase reste vraie.

## Formule de renouvellement — une seule règle pour tous les cas

```
newPeriodEnd = ajouterJours(max(maintenant, currentPeriodEnd), dureeDuCycle)
```

- **Renouvellement anticipé** (abonnement encore `ACTIVE`, `currentPeriodEnd` dans le
  futur) : la base reste `currentPeriodEnd` — aucun jour prépayé n'est jamais perdu.
- **Réactivation après grâce/suspension/expiration** (`currentPeriodEnd` déjà dans le
  passé) : la base devient `maintenant` — le temps déjà écoulé sans paiement n'est
  jamais compté comme une période payée.

Une seule formule, jamais deux branches séparées : c'est délibéré (voir
`packages/database/src/subscription-registry.ts`, `confirmSubscriptionPaymentSuccess`)
pour qu'aucune réimplémentation future n'invente une seconde règle incohérente avec la
première.

## Machine à états (`SubscriptionStatus`)

```
PENDING -> TRIALING | ACTIVE           (première confirmation de paiement, ou essai)
TRIALING -> ACTIVE | GRACE_PERIOD | CANCELED
ACTIVE -> GRACE_PERIOD | CANCELED
GRACE_PERIOD -> ACTIVE (paiement reçu) | SUSPENDED (grâce dépassée)
SUSPENDED -> ACTIVE (paiement reçu) | EXPIRED (délai supplémentaire dépassé)
CANCELED / EXPIRED -> (terminal, sauf réactivation explicite via un nouveau paiement)
```

`PAST_DUE` est réservé à un futur signal "tentative de paiement échouée" — aucun
événement Chariow ne le déclenche aujourd'hui dans le flux normal ; il n'est atteint
que par une action Super Admin manuelle ou une future extension.

Toute transition passe par `transitionSubscriptionStatus` (garde anti-TOCTOU sur le
COUPLE `(status lu, currentPeriodEnd lu)`, jamais un `UPDATE` nu) — un webhook rejoué ou
un double clic "Renouveler" concurrent ne peut jamais prolonger deux fois la période ;
le perdant de la course voit `count === 0` et est traité comme un rejeu bénin (retourne
l'état actuel), jamais une erreur.

## Politique de disponibilité du site public pendant grâce/suspension

`apps/web/lib/rendering/resolve-public-site.ts` (`resolveActiveTenant`, seul point
d'entrée du site public) distingue désormais deux notions de suspension, jamais
confondues :
- `Tenant.status === "SUSPENDED"` — décision Super Admin sur le TENANT ENTIER, motif
  indépendant de la facturation (abus, litige, etc.). Comportement inchangé.
- `"billing_suspended"` (nouveau statut de `ActiveTenantResolution`) — dérivé de
  `TenantSubscription.status` :
  - `GRACE_PERIOD` : site public **inchangé**, aucune pénalité avant la fin de la grâce.
  - `SUSPENDED`/`EXPIRED` : site public affiche une page de suspension facturation
    dédiée (`PublicSiteBillingSuspended`) — **jamais** de suppression de données
    (produits, commandes, clients, fichiers tous conservés intégralement), **jamais**
    de blocage du dashboard (le propriétaire peut toujours se connecter et renouveler).

`checkPublishReadiness` (`packages/publishing/src/readiness.ts`) autorise la
publication pour `PENDING... non` — précisément `TRIALING`, `ACTIVE`, `GRACE_PERIOD`
uniquement ; `PENDING`, `PAST_DUE`, `SUSPENDED`, `CANCELED`, `EXPIRED` la bloquent.

## Séparation stricte des deux domaines de paiement

| | Paiements des CLIENTS FINAUX | Facturation SaaS (cette étape) |
|---|---|---|
| Qui paie | Le client d'une entreprise | L'entreprise elle-même |
| Qui est le marchand | L'entreprise (compte PayDunya/PayTech propre) | La plateforme (un seul compte Chariow) |
| Package | `packages/payments` | `packages/billing` |
| Modèles | `Payment`, `PaymentProviderConfig`, `PaymentWebhookEvent` | `SubscriptionPayment`, `SubscriptionEvent`, `BillingCheckoutSession` |
| Webhook | `/api/webhooks/[provider]/[tenantId]` | `/api/webhooks/chariow` |
| Résolution du prestataire | `resolveProviderForTenant(tenantId, ...)` — PAR TENANT | `resolveSaasBillingProvider()` — PLATEFORME, aucun paramètre tenant |

Ne jamais faire dépendre l'un de l'autre, ne jamais partager un modèle entre les deux.

## Limites assumées (à ne pas présenter comme résolues)

- **Chariow n'a pas été vérifié en détail** (endpoint exact, en-tête et algorithme de
  signature du Pulse, disponibilité réelle Wave/Orange Money au Sénégal, devise de
  règlement, KYC, frais, délai de reversement, procédure de remboursement, tarif
  entreprise) — à confirmer en sandbox/support Chariow avant toute mise en production
  réelle. L'adaptateur (`ChariowBillingAdapter`) est construit sur une forme
  raisonnable, non garantie exacte.
- Pas de proration lors d'un changement de formule — effectif au prochain
  renouvellement uniquement.
- Pas de téléchargement de reçu (aucun module documents aujourd'hui).
- Renouvellement automatique impossible tant qu'aucun prestataire ne fournit un mandat
  conforme.
- Quotas sectoriels au-delà de l'e-commerce/mode/restauration (immobilier, voyage,
  services, éducation) : le cadre (`subscription-usage.ts`) est extensible mais ne
  contient aujourd'hui que les ressources réellement dénombrables (produits, employés,
  domaines) — aucune fausse entrée pour des entités métier qui n'existent pas encore.
