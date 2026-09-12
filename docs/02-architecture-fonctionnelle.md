# 2. Architecture fonctionnelle

## 2.1 Vue d'ensemble des modules

```mermaid
graph TB
    subgraph Platform["Espace Super Admin"]
        SA1[Gestion des tenants]
        SA2[Formules & abonnements]
        SA3[Domaines & sous-domaines]
        SA4[Modèles de site]
        SA5[Paiements & commissions]
        SA6[Impersonation & logs]
    end

    subgraph Tenant["Espace Tenant (par entreprise)"]
        T1[Dashboard & Agent IA]
        T2[Produits & IA catalogue]
        T3[Commandes]
        T4[Clients & marketing]
        T5[Paiements]
        T6[Facturation & documents]
        T7[Livraison]
        T8[Employés & rôles]
        T9[Paramètres & thème]
        T10[Stocks & achats]
    end

    subgraph Public["Site public du tenant"]
        P1[Vitrine / catalogue]
        P2[Panier & checkout]
        P3[Compte client]
    end

    SA1 --> Tenant
    SA4 --> P1
    T2 --> P1
    P2 --> T3
    T3 --> T5
    T5 --> T6
    T6 --> T4
    T3 --> T7
    T5 -. webhooks .-> Providers[(PayDunya / PayTech / Wave / OM / Free Money)]
```

## 2.2 Niveaux d'accès

| Niveau       | Portée                | Accès données                                                                                  |
| ------------ | --------------------- | ---------------------------------------------------------------------------------------------- |
| Super Admin  | Toute la plateforme   | Lecture/administration cross-tenant, jamais d'accès direct aux secrets de paiement des tenants |
| Propriétaire | Un tenant             | Accès complet à son tenant uniquement                                                          |
| Employé      | Un tenant, selon rôle | Accès limité par permissions (voir [05](05-roles-permissions.md))                              |

Le Super Admin agit **toujours** au travers d'un mécanisme d'impersonation journalisé (jamais de lecture silencieuse des données tenant) — voir [05](05-roles-permissions.md#impersonation).

## 2.3 Cycle de vie d'un tenant

1. Création par le Super Admin (ou auto-inscription + validation manuelle en V2) : nom, secteur d'activité, formule, sous-domaine proposé.
2. Attribution automatique d'un **modèle de site** correspondant au secteur (modifiable par le Super Admin).
3. Provisionnement : enregistrement du sous-domaine, création du schéma de données tenant (voir isolation en [03](03-architecture-technique.md)), période d'essai démarrée selon la formule.
4. Le propriétaire configure : identité visuelle, moyens de paiement activés, zones de livraison, employés.
5. Le tenant peut être suspendu (accès bloqué, données conservées) ou supprimé (soft delete + purge différée) par le Super Admin.
6. Le tenant peut demander un domaine personnalisé : vérification par enregistrement DNS TXT, puis émission automatique du certificat TLS.

## 2.4 Architecture multi-business : noyau, modules, secteurs, templates

La plateforme n'est **pas** une application différente par type d'entreprise. Elle repose sur quatre couches :

1. **Le noyau commun** : auth, entreprises, clients, employés/rôles, paiements, facturation, e-mails, WhatsApp, IA, abonnements, domaines, éditeur visuel, fichiers, analyses, paramètres — toujours actif, identique pour tous.
2. **Les modules** : unités fonctionnelles activables (`catalog`, `listings`, `appointments`, `leases`, `enrollments`…), soit fournies par le noyau, soit rattachées à un ou plusieurs secteurs.
3. **Les secteurs** : un registre de 10 secteurs (e-commerce, mode, restauration, immobilier, voyage, automobile, hôtellerie, services, éducation, livraison) — chacun active un jeu de modules par défaut, ajustable ensuite par formule d'abonnement ou manuellement par le propriétaire.
4. **Les templates** : plusieurs habillages réellement différents par secteur (structure, direction artistique, composants), jamais de simple recoloration — voir [12](12-systeme-templates-et-direction-artistique.md).

Détail complet des secteurs et modules : [11-secteurs-et-modules.md](11-secteurs-et-modules.md). Détail du système de templates, de l'éditeur visuel et de la direction artistique : [12-systeme-templates-et-direction-artistique.md](12-systeme-templates-et-direction-artistique.md).

Le moteur de commande/réservation du noyau reste unique : les modules sectoriels alimentent les mêmes primitives génériques (`Listing`, `Reservation`, voir [04](04-schema-base-de-donnees.md#45-extension-multi-secteurs)) plutôt que de dupliquer la logique métier par secteur — aucune réécriture du cœur n'est nécessaire pour ajouter un nouveau métier.

## 2.5 Agent IA commerçant

Un service de question-réponse adossé aux données du tenant (lecture seule, jamais d'action destructrice sans confirmation explicite) :

- Traduit la question en requête agrégée sur les données du tenant (CA, produits, commandes, stock) — **jamais** un accès SQL libre généré par le LLM sur la base réelle : un jeu fixe de requêtes paramétrées est exposé au modèle (function calling), qui choisit la fonction et les paramètres.
- Répond en français avec chiffres réels en FCFA, jamais de valeur inventée.
- Exemples couverts nativement : produit le plus vendu, CA du mois, recommandations de réassort, commandes nécessitant une intervention (impayées, bloquées), risques de rupture de stock.

## 2.6 Assistant IA fiche produit

Pipeline : **Entrée** (photo(s) / texte / ligne Excel / page PDF / URL fournisseur) → **Extraction** (vision + OCR si besoin) → **Génération** (nom, catégorie, descriptions, mots-clés, prix suggéré, variantes, textes réseaux sociaux, traductions) → **Brouillon** (`AIGenerationJob`, statut `pending_review`) → **Validation humaine obligatoire** → **Publication**.

Aucun contenu généré par l'IA n'atteint le catalogue public sans un clic de validation du commerçant (ou d'un employé avec la permission `products.publish`).

## 2.7 Flux inter-modules clé

```mermaid
flowchart LR
    A[Commande créée] --> B[Paiement]
    B -->|webhook vérifié| C[Facture générée]
    C --> D[Notification client<br/>email + WhatsApp]
    B --> E[Statut commande mis à jour]
    E --> F[Livraison assignée]
    F --> G[Preuve de livraison]
    G --> E
    C --> H[Comptabilité / export]
```

## 2.8 Gouvernance des formules d'abonnement

Chaque formule est une configuration de **limites** et de **fonctionnalités** appliquée en temps réel (middleware de vérification avant chaque action soumise à quota : ajout produit, ajout employé, génération IA, etc.). Le dépassement de quota bloque l'action avec un message explicite et une invitation à mettre à niveau — jamais un blocage silencieux.
