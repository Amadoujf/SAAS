# 20 — Pages légales

Trois pages existent sur la plateforme ET sur le site de chaque entreprise, au même
chemin ; le contenu dépend de l'adresse visitée :

| Page | Plateforme (`<domaine>`) | Site d'une entreprise |
|---|---|---|
| `/mentions-legales` | Éditeur de la plateforme, hébergeur | L'entreprise (éditrice du site), solution technique, hébergeur |
| `/conditions-generales` | Conditions d'utilisation pour les entreprises | Conditions de vente et de réservation du vendeur |
| `/confidentialite` | Données des comptes, prestataires, droits | Données des clients du vendeur, droits |

Les liens figurent dans le pied de page de tous les sites (8 secteurs, boutiques,
plateforme).

## Ce qui alimente ces pages

- **Plateforme** : variables `PLATFORM_LEGAL_*` de `infra/preview/.env.preview`
  (raison sociale, forme, adresse, NINEA, RCCM, e-mail, téléphone, responsable de la
  publication). Vide = « Non renseigné ».
- **Entreprise** : tableau de bord → *Informations légales* (propriétaire et gérant,
  permission `settings.branding`). Table `TenantLegalProfile`, isolée par RLS. À défaut,
  le nom, l'adresse, l'e-mail et le téléphone du site sont repris.
- La politique de retour et les conditions particulières saisies par l'entreprise
  s'ajoutent à ses conditions de vente.

Aucune donnée n'est inventée : un champ absent s'affiche « Non renseigné ». Une
entreprise de démonstration affiche un bandeau « informations fictives ».

## Contenu exact des textes

- Paiement : une commande payée par transfert (Wave, Orange Money) n'est payée
  qu'après confirmation par le vendeur ; sinon elle reste « en attente de paiement ».
- Cookies : uniquement ceux nécessaires (panier, session, accès à la prévisualisation) ;
  aucun cookie publicitaire ni de mesure d'audience (vérifié dans le code).
- Données hébergées chez Hetzner, en Allemagne (hors du Sénégal), mentionné.
- Droits selon la loi n° 2008-12 du 25 janvier 2008 ; recours auprès de la CDP.

## À faire avant l'ouverture au public

1. Faire relire les trois textes (plateforme et modèle entreprise) par un juriste.
2. Renseigner les variables `PLATFORM_LEGAL_*` sur le serveur.
3. Vérifier que chaque entreprise réelle a rempli ses informations légales.
