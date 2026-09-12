# 1. Cahier des charges — YamaCommerce AI

## 1.1 Contexte

YamaCommerce AI est une plateforme SaaS multi-entreprises (multi-tenant) qui permet à un opérateur unique (toi, en tant que Super Admin) de créer, configurer et commercialiser des sites web professionnels pour des commerçants sénégalais, dans des secteurs variés, sans développement sur mesure pour chacun.

Chaque client (« tenant ») obtient : un site indépendant, un sous-domaine (`boutique.yamacommerce.ai`) avec option de domaine personnalisé, un catalogue, une identité visuelle, ses propres employés, clients, commandes, paiements et un tableau de bord.

## 1.2 Objectifs

1. Réduire à quelques heures le temps de mise en ligne d'un site professionnel pour un commerçant sénégalais.
2. Automatiser au maximum la création de fiches produits grâce à l'IA (photo, Excel, PDF, lien fournisseur).
3. Encaisser de façon fiable via les moyens de paiement réellement utilisés au Sénégal (Wave, Orange Money, Free Money, cartes, paiement à la livraison), avec zéro simulation de paiement.
4. Générer automatiquement les documents commerciaux (factures, devis, reçus, bons de livraison, avoirs) conformes et infalsifiables une fois finalisés.
5. Donner à chaque commerçant une vision claire de son activité (dashboard + agent IA conversationnel).
6. Permettre à l'opérateur de la plateforme de gérer commercialement l'ensemble (abonnements, commissions, domaines, support) depuis un espace Super Admin unique.
7. Garantir une isolation stricte des données entre entreprises dès la conception (pas en rattrapage).
8. Couvrir, avec un seul noyau technique, des secteurs aussi différents que l'e-commerce, l'immobilier, le voyage, l'automobile, l'hôtellerie, les services et l'éducation — sans jamais développer une application séparée par métier (voir [11-secteurs-et-modules.md](11-secteurs-et-modules.md)).
9. Offrir à chaque entrepreneur un parcours complet et autonome : choix du secteur → choix des modules → choix d'un template → personnalisation visuelle → connexion des paiements → configuration des règles métier → prévisualisation multi-écrans → domaine → publication.

## 1.3 Secteurs ciblés

La plateforme n'est pas limitée à l'e-commerce : chaque entrepreneur choisit son secteur, ses modules et son template. Registre final de **10 secteurs** — détail complet des modules et de la couverture des activités connexes (pharmacies, cabinets médicaux, garages, consultants, artisans, associations, etc., qui se composent à partir des secteurs ci-dessous sans code dédié) dans [11-secteurs-et-modules.md](11-secteurs-et-modules.md) :

Boutiques, commerçants et grossistes (e-commerce) · Mode et vêtements · Restauration · Immobilier · Agences de voyage · Automobile · Hôtels et locations · Salons et prestataires de services · Écoles et centres de formation · Services de livraison.

Chaque secteur active un **jeu de modules par défaut** (catalogue, réservations, baux, inscriptions…) au-dessus du même noyau commun (paiements, factures, clients, employés) et propose plusieurs **templates** réellement différents, avec leur propre direction artistique — voir [02-architecture-fonctionnelle.md](02-architecture-fonctionnelle.md#24-architecture-multi-business--noyau-modules-secteurs-templates) pour l'architecture et [12-systeme-templates-et-direction-artistique.md](12-systeme-templates-et-direction-artistique.md) pour le système de templates et l'éditeur visuel.

## 1.4 Acteurs

| Acteur                        | Description                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| **Super Admin**               | Opérateur de la plateforme YamaCommerce AI. Un seul niveau, plusieurs comptes possibles. |
| **Propriétaire d'entreprise** | Souscrit un abonnement, administre son tenant.                                           |
| **Employé**                   | Compte rattaché à un tenant, avec rôle et permissions limitées.                          |
| **Client final**              | Achète/réserve sur le site d'un tenant. Compte optionnel selon config.                   |
| **Livreur**                   | Rattaché à un tenant, gère les livraisons qui lui sont assignées.                        |

## 1.5 Exigences fonctionnelles

### Multi-tenant

- Isolation totale des données par entreprise (aucune fuite inter-tenant, y compris en cas de bug applicatif — voir stratégie RLS en [03](03-architecture-technique.md)).
- Sous-domaine automatique à la création + domaine personnalisé optionnel avec vérification DNS et TLS automatique.
- Attribution d'un modèle de site par le Super Admin, personnalisable ensuite par le tenant (couleurs, logo, thème clair/sombre par défaut).

### Dashboard commerçant

CA brut/net, bénéfice estimé, nb commandes, panier moyen, nouveaux clients, ventes par période, top/flop produits, alertes stock faible, commandes impayées, paiements réussis/échoués, dépenses, performance par canal et par zone de livraison, comparaison période précédente, export PDF/Excel/CSV, filtres de date. Agent IA conversationnel sur ces données (voir [02](02-architecture-fonctionnelle.md#agent-ia-commerçant)).

### Produits assistés par IA

Ajout par formulaire, photo(s), Excel/CSV, PDF, lien fournisseur, import massif. L'IA propose (jamais ne publie sans validation) : nom, catégorie, descriptions longue/courte, caractéristiques, mots-clés SEO, prix suggéré, variantes/couleurs/tailles, tags, textes réseaux sociaux (FB/IG/WhatsApp), traduction FR/EN/Wolof. Système de **brouillon obligatoire**. Modification massive (prix, stock, catégorie, statut).

### Commandes

Statuts : Nouvelle, En attente de paiement, Payée, Confirmée, En préparation, Prête, Expédiée, En livraison, Livrée, Annulée, Remboursée. Historique horodaté et attribué à un utilisateur pour chaque transition.

### Paiements (Sénégal)

Wave, Orange Money, Free Money, cartes bancaires, via agrégateurs **PayDunya** et **PayTech** (API officielles), paiement à la livraison, paiement partiel, paiement en tranches. Vérification serveur exclusivement via webhooks signés. Idempotence stricte (aucun double encaissement / double facture). Activation/désactivation par moyen de paiement au niveau du tenant.

### Facturation

Facture PDF automatique après paiement confirmé ou commande COD validée : numérotation séquentielle par tenant, logo/coordonnées entreprise, infos client, détail produits/taxes/remises/livraison, mode et statut de paiement, QR code de vérification, archivage dans le compte client, envoi email + WhatsApp, téléchargement, **immutabilité après finalisation** (toute correction passe par un avoir). Également : devis, reçus, bons de commande, bons de livraison, avoirs, factures d'acompte/finales.

### Notifications

Modèles personnalisables (confirmation commande/paiement, échec paiement, préparation, expédition, livraison, facture disponible, panier abandonné, réassort, reset mot de passe) sur email, SMS, notification interne, WhatsApp — canaux activables par tenant, avec personnalisation expéditeur/logo/couleurs/texte.

### Livraison

Tarification par région/département/commune/quartier ou zone, franco de port configurable, tarif par poids/volume/catégorie, règle du produit le plus volumineux, frais d'installation optionnels, attribution à un livreur, suivi, preuve de livraison (photo/signature/code), encaissement COD, historique des remises d'argent.

### Clients & marketing

Comptes clients, historique, favoris, avis, fidélité, parrainage, codes promo, cartes-cadeaux, prix de gros/comptes revendeurs, segmentation, campagnes email/WhatsApp, relance panier abandonné, recommandations IA.

### Gestion interne

Stocks multi-boutique/entrepôt, mouvements de stock, fournisseurs, achats, dépenses, marges, retours/remboursements, employés, rôles/permissions personnalisables, journal d'audit, impression de reçus, export comptable.

### Abonnements

Formules Essentiel / Business / Premium / Entreprise, chaque limite/fonctionnalité configurable par le Super Admin (produits, employés, boutiques, stockage, IA, domaine personnalisé, rapports avancés, automatisations WhatsApp, commission, prix mensuel/annuel, essai gratuit).

### Sécurité

Auth sécurisée + 2FA, RBAC, isolation stricte des données, chiffrement des données sensibles, protection attaques courantes (OWASP), rate limiting, validation serveur systématique, sauvegardes, audit log, gestion des secrets via variables d'environnement/coffre-fort, aucune donnée bancaire stockée en direct.

## 1.6 Exigences non fonctionnelles

| Catégorie            | Exigence                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Performance          | Chargement initial < 2,5 s sur mobile 3G/4G Sénégal ; animations sans jank (60 fps, respect de `prefers-reduced-motion`) |
| Disponibilité        | Cible 99,5 % pour le MVP, avec sauvegardes quotidiennes automatiques de la base                                          |
| Accessibilité        | Contraste conforme WCAG AA, navigation clavier, `aria-*` sur les composants interactifs                                  |
| Internationalisation | FR par défaut, architecture i18n prête pour EN et Wolof dès le MVP (pas de chaînes en dur)                               |
| Scalabilité          | Doit supporter plusieurs centaines de tenants actifs simultanément sans changement d'architecture                        |
| Mobile-first         | Le site public de chaque tenant doit être irréprochable sur téléphone (canal principal des clients finaux)               |
| Devise               | FCFA (XOF) partout, montants entiers (pas de sous-unité), formatage `1 250 000 FCFA`                                     |

## 1.7 Contraintes spécifiques au Sénégal

- Connectivité mobile variable → priorité à la légèreté des pages publiques (images optimisées, pas de JS bloquant).
- WhatsApp est un canal de communication et de vente central → intégration WhatsApp Business Cloud API dès le MVP pour factures et notifications.
- Les moyens de paiement grand public transitent par des agrégateurs locaux (PayDunya, PayTech) plutôt que des intégrations directes propriétaires — voir [03](03-architecture-technique.md#paiements).
- Adressage postal informel (quartiers plutôt que codes postaux) → le modèle de zone de livraison utilise région/département/commune/quartier plutôt qu'un code postal strict.

## 1.8 Hors périmètre pour le MVP (Phase 1)

Explicitement reportés aux phases suivantes (voir [09-plan-developpement.md](09-plan-developpement.md)) :

- La majorité des secteurs et de leurs modules dédiés (immobilier, voyage, automobile, hôtellerie, éducation en particulier) — le MVP livre le noyau + le registre secteurs/modules/templates + le secteur e-commerce complet (3 templates), preuve de la généricité de l'architecture ; le calendrier détaillé d'introduction des autres secteurs est posé en [09-plan-developpement.md](09-plan-developpement.md).
- Fidélité, parrainage, cartes-cadeaux, comptes revendeurs, campagnes marketing, relance panier abandonné automatisée.
- Multi-boutique/entrepôt, fournisseurs/achats.
- Paiement en tranches (l'architecture le prévoit, l'implémentation UI vient en phase 3).
- Domaine personnalisé avec TLS automatique (l'architecture le prévoit dès le MVP, l'automatisation complète vient en phase 3).
- Application mobile (l'API est conçue pour la supporter dès le départ).

## 1.9 Critères d'acceptation du MVP

1. Un Super Admin peut créer un tenant e-commerce, lui attribuer une formule, et le tenant est accessible sur `<slug>.yamacommerce.ai`.
2. Un commerçant peut ajouter un produit par photo et voir une fiche générée par l'IA en brouillon, qu'il doit valider avant publication.
3. Un client peut passer une commande, payer via PayDunya (Wave/Orange Money/carte) ou choisir le paiement à la livraison.
4. Un paiement n'est jamais marqué « réussi » sans confirmation webhook vérifiée côté serveur ; un rejeu du même webhook ne crée pas de doublon.
5. Une facture PDF numérotée, avec QR code, est générée et envoyée par email dès que le paiement est confirmé (ou la commande COD validée), et n'est plus modifiable ensuite.
6. Les données du tenant A sont invérifiables et inaccessibles depuis un compte du tenant B, y compris en modifiant une URL/ID.
7. Le dashboard affiche les indicateurs clés avec au moins un filtre de période fonctionnel et un export CSV réel.
