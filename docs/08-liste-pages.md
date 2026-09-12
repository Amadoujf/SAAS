# 8. Liste des pages

## 8.1 Site public du tenant (`<slug>.yamacommerce.ai` ou domaine perso)

| Page                                  | Route                                                                                                  | Notes                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Accueil                               | `/`                                                                                                    | Blocs configurables selon le template du secteur           |
| Catalogue                             | `/catalogue` (ou `/menu`, `/biens`, `/vehicules`, `/prestations`, `/chambres`, `/cours` selon secteur) | Filtres, tri, pagination                                   |
| Détail produit / bien / prestation    | `/p/[slug]`                                                                                            | Variantes, avis, produits liés                             |
| Panier                                | `/panier`                                                                                              |                                                            |
| Commande / réservation                | `/commande`                                                                                            | Adresse, créneau (secteurs à réservation), choix livraison |
| Paiement                              | `/paiement`                                                                                            | Redirection prestataire ou choix COD                       |
| Confirmation                          | `/commande/[id]/confirmation`                                                                          |                                                            |
| Suivi de commande                     | `/commande/[id]/suivi`                                                                                 | Statuts + position livreur si dispo                        |
| Compte client — tableau de bord       | `/compte`                                                                                              |                                                            |
| Compte client — commandes             | `/compte/commandes`                                                                                    |                                                            |
| Compte client — factures              | `/compte/factures`                                                                                     |                                                            |
| Compte client — favoris               | `/compte/favoris`                                                                                      |                                                            |
| Compte client — adresses              | `/compte/adresses`                                                                                     |                                                            |
| Connexion / inscription               | `/connexion`, `/inscription`                                                                           |                                                            |
| Mot de passe oublié                   | `/mot-de-passe-oublie`                                                                                 |                                                            |
| Pages statiques                       | `/a-propos`, `/contact`, `/cgv`, `/politique-confidentialite`                                          | Contenu éditable par le tenant                             |
| Vérification de facture (QR)          | `/verifier/[qrToken]`                                                                                  | Page publique lecture seule                                |
| Page d'erreur tenant suspendu/inconnu | —                                                                                                      | Rendue par le middleware avant toute route                 |

## 8.2 Dashboard commerçant (`app.yamacommerce.ai/[tenant]/...` ou sous-chemin authentifié du domaine du tenant)

| Page                                   | Route                                     | Notes                                |
| -------------------------------------- | ----------------------------------------- | ------------------------------------ |
| Accueil dashboard                      | `/dashboard`                              | KPIs, graphiques, agent IA en widget |
| Assistant IA (chat)                    | `/dashboard/assistant`                    |                                      |
| Produits — liste                       | `/dashboard/produits`                     |                                      |
| Produits — nouveau (formulaire)        | `/dashboard/produits/nouveau`             |                                      |
| Produits — assistant IA (photo/texte)  | `/dashboard/produits/nouveau/ia`          |                                      |
| Produits — import massif               | `/dashboard/produits/import`              | Excel/CSV/PDF/URL                    |
| Produits — édition                     | `/dashboard/produits/[id]`                |                                      |
| Produits — édition massive             | `/dashboard/produits/edition-massive`     |                                      |
| Catégories                             | `/dashboard/categories`                   |                                      |
| Stocks                                 | `/dashboard/stocks`                       |                                      |
| Fournisseurs & achats                  | `/dashboard/achats`                       | Post-MVP                             |
| Commandes — liste                      | `/dashboard/commandes`                    | Filtres par statut                   |
| Commandes — détail                     | `/dashboard/commandes/[id]`               | Historique, actions de statut        |
| Clients — liste                        | `/dashboard/clients`                      |                                      |
| Clients — détail                       | `/dashboard/clients/[id]`                 |                                      |
| Avis clients                           | `/dashboard/avis`                         | Post-MVP                             |
| Promotions & codes promo               | `/dashboard/promotions`                   | Post-MVP                             |
| Cartes-cadeaux                         | `/dashboard/cartes-cadeaux`               | Post-MVP                             |
| Campagnes marketing                    | `/dashboard/marketing`                    | Post-MVP                             |
| Paniers abandonnés                     | `/dashboard/marketing/paniers-abandonnes` | Post-MVP                             |
| Paiements — moyens activés             | `/dashboard/paiements`                    |                                      |
| Paiements — transactions               | `/dashboard/paiements/transactions`       |                                      |
| Factures & documents                   | `/dashboard/documents/factures`           |                                      |
| Devis                                  | `/dashboard/documents/devis`              |                                      |
| Avoirs / remboursements                | `/dashboard/documents/avoirs`             |                                      |
| Livraison — zones & tarifs             | `/dashboard/livraison/zones`              |                                      |
| Livraison — livreurs                   | `/dashboard/livraison/livreurs`           |                                      |
| Livraison — suivi                      | `/dashboard/livraison/suivi`              |                                      |
| Dépenses                               | `/dashboard/depenses`                     |                                      |
| Rapports & exports                     | `/dashboard/rapports`                     | PDF/Excel/CSV, filtres période       |
| Employés                               | `/dashboard/employes`                     |                                      |
| Rôles & permissions                    | `/dashboard/employes/roles`               |                                      |
| Journal d'audit (tenant)               | `/dashboard/audit`                        |                                      |
| Paramètres — informations entreprise   | `/dashboard/parametres/entreprise`        |                                      |
| Paramètres — identité visuelle / thème | `/dashboard/parametres/apparence`         |                                      |
| Paramètres — domaine                   | `/dashboard/parametres/domaine`           |                                      |
| Paramètres — notifications             | `/dashboard/parametres/notifications`     |                                      |
| Paramètres — abonnement                | `/dashboard/parametres/abonnement`        |                                      |

## 8.3 Espace Super Admin (`admin.yamacommerce.ai`)

| Page                                 | Route                    | Notes                                 |
| ------------------------------------ | ------------------------ | ------------------------------------- |
| Vue d'ensemble plateforme            | `/admin`                 | Nb tenants, CA plateforme, alertes    |
| Tenants — liste                      | `/admin/tenants`         |                                       |
| Tenants — création                   | `/admin/tenants/nouveau` |                                       |
| Tenants — détail                     | `/admin/tenants/[id]`    | Statut, formule, impersonation        |
| Formules & fonctionnalités           | `/admin/formules`        | Éditeur de plans                      |
| Abonnements & facturation plateforme | `/admin/abonnements`     |                                       |
| Paiements & commissions              | `/admin/paiements`       |                                       |
| Domaines                             | `/admin/domaines`        | Vérifications DNS, statut TLS         |
| Modèles de site                      | `/admin/modeles`         | Bibliothèque de templates par secteur |
| Journal d'impersonation              | `/admin/impersonation`   |                                       |
| Journal d'audit plateforme           | `/admin/audit`           |                                       |
| Erreurs & activités importantes      | `/admin/erreurs`         | Alimenté par `ErrorLog`               |
| Paramètres plateforme                | `/admin/parametres`      |                                       |
| Comptes Super Admin                  | `/admin/equipe`          |                                       |

## 8.4 Pages transverses

| Page                        | Route                  | Notes                              |
| --------------------------- | ---------------------- | ---------------------------------- |
| Connexion Super Admin (2FA) | `/admin/connexion`     | Domaine séparé du dashboard tenant |
| Connexion dashboard tenant  | `/dashboard/connexion` |                                    |
| Page 404 tenant             | —                      | Personnalisable par le tenant      |
| Page maintenance            | —                      | Bascule globale ou par tenant      |
