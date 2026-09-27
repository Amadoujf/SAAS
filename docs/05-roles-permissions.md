# 5. Rôles et permissions

## 5.1 Rôles

| Rôle                        | Portée             | Type                                                                     |
| --------------------------- | ------------------ | ------------------------------------------------------------------------ |
| `SUPER_ADMIN`               | Plateforme entière | Global, flag sur `User.isSuperAdmin`, hors du modèle `Role` tenant       |
| `OWNER` (Propriétaire)      | Un tenant          | Système, toutes permissions du tenant, non supprimable                   |
| `MANAGER` (Gérant)          | Un tenant          | Système, presque toutes permissions sauf facturation plateforme/domaines |
| `SALES` (Vente/Caissier)    | Un tenant          | Système, commandes + clients + encaissement                              |
| `INVENTORY_MANAGER` (Stock) | Un tenant          | Système, produits + stock + fournisseurs                                 |
| `MARKETING`                 | Un tenant          | Système, clients + promotions + campagnes                                |
| `ACCOUNTANT` (Comptable)    | Un tenant          | Système, factures + dépenses + exports, lecture seule sur le reste       |
| `DELIVERY_STAFF` (Livreur)  | Un tenant          | Système, ses livraisons assignées uniquement                             |
| Rôles personnalisés         | Un tenant          | Créés par le propriétaire en combinant des clés de permission            |

## 5.2 Catalogue de permissions (clés)

Format `module.action`. Vérifiées côté serveur sur chaque mutation, jamais seulement masquées côté UI.

```
products.view / products.create / products.edit / products.delete / products.publish / products.bulk_edit
orders.view / orders.update_status / orders.cancel / orders.refund
customers.view / customers.edit / customers.export
payments.view / payments.configure / payments.refund
invoices.view / invoices.issue_credit_note
delivery.view / delivery.assign / delivery.update_status / delivery.manage_zones
employees.view / employees.invite / employees.edit_roles / employees.remove
settings.branding / settings.domain / settings.notifications / settings.subscription
reports.view / reports.export / reports.advanced
marketing.manage_promotions / marketing.manage_campaigns
ai.use_product_assistant / ai.use_chat_agent
inventory.manage_stock / inventory.manage_suppliers
listings.view / listings.create / listings.edit / listings.publish / listings.delete / listings.manage_availability
reservations.view / reservations.update_status / reservations.cancel
leases.view / leases.manage / rents.record
```

Fiches et réservations (octobre 2026, secteurs hors commerce) : Sales voit les fiches et
traite les réservations (sans les annuler) ; Inventory gère les fiches et leurs créneaux
(sans les supprimer) ; Owner et Manager ont tout.

## 5.3 Matrice (extrait)

| Permission                 | Owner | Manager | Sales | Inventory | Marketing | Accountant |                       Delivery staff                        |
| -------------------------- | :---: | :-----: | :---: | :-------: | :-------: | :--------: | :---------------------------------------------------------: |
| products.publish           |  ✅   |   ✅    |  ❌   |    ✅     |    ❌     |     ❌     |                             ❌                              |
| orders.update_status       |  ✅   |   ✅    |  ✅   |    ❌     |    ❌     |     ❌     | ❌ (uniquement `delivery.update_status` sur ses livraisons) |
| payments.configure         |  ✅   |   ❌    |  ❌   |    ❌     |    ❌     |     ❌     |                             ❌                              |
| invoices.issue_credit_note |  ✅   |   ✅    |  ❌   |    ❌     |    ❌     |     ✅     |                             ❌                              |
| settings.domain            |  ✅   |   ❌    |  ❌   |    ❌     |    ❌     |     ❌     |                             ❌                              |
| reports.export             |  ✅   |   ✅    |  ❌   |    ❌     |    ❌     |     ✅     |                             ❌                              |
| marketing.manage_campaigns |  ✅   |   ✅    |  ❌   |    ❌     |    ✅     |     ❌     |                             ❌                              |

Un rôle personnalisé est une ligne `Role` (`tenantId` renseigné, `isSystem = false`) avec un sous-ensemble libre de ces clés.

## 5.4 Impersonation (connexion temporaire du Super Admin)

1. Le Super Admin déclenche une impersonation depuis la fiche tenant, avec un **motif obligatoire** (texte libre, ex. « support ticket #482 »).
2. Création d'une ligne `ImpersonationSession` (`startedAt`, `reason`) et d'une entrée `AuditLog` (`action: "impersonation.started"`).
3. Une bannière permanente et non masquable s'affiche sur toute l'interface pendant la session (« Vous agissez en tant que Super Admin sur le compte de [Tenant] »).
4. Toute action effectuée pendant l'impersonation est journalisée dans `AuditLog` avec `actorType: "super_admin"` et l'identifiant de la session d'impersonation en métadonnée.
5. Fin de session (déconnexion explicite ou expiration après 30 min) → `endedAt` renseigné.
6. Le Super Admin **ne peut pas** voir les moyens de paiement configurés en clair, ni les mots de passe — l'impersonation donne un accès fonctionnel, pas un accès aux secrets.

## 5.5 Règle générale de vérification

Toute route serveur (route handler / server action) applique la séquence :

1. Résoudre la session → `userId`.
2. Résoudre le tenant courant à partir du **domaine de la requête**, jamais d'un paramètre client.
3. Vérifier l'appartenance (`TenantUser`) et charger `Role.permissions`.
4. Vérifier la présence de la permission requise pour l'action.
5. Poser `app.current_tenant_id` avant toute requête Prisma (protection RLS).

Un manquement à l'étape 2 (faire confiance à un `tenantId` fourni par le client) est considéré comme une faille bloquante en revue de code.
