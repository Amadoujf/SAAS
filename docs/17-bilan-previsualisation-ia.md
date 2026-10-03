# 17 — Préparation de la prévisualisation avec IA réelle : hébergement, coûts, état des secteurs

État au 1er octobre 2026. Aucun achat, aucune mise en ligne, aucune fusion : tout ce qui
suit attend une validation.

## 1. Hébergement proposé

| | Recommandé : Hetzner Cloud **CX33** | Minimum : Hetzner Cloud **CX23** |
|---|---|---|
| Ressources | 4 vCPU x86 partagés, 8 Go RAM, 80 Go SSD | 2 vCPU x86 partagés, 4 Go RAM, 40 Go SSD |
| Prix serveur | 8,49 € / mois HT | 5,49 € / mois HT |
| Adresse IPv4 | 0,50 € / mois HT | 0,50 € / mois HT |
| **Total** | **8,99 € / mois HT** | **5,99 € / mois HT** |
| Lieu | Allemagne ou Finlande | idem |

- Prix après la hausse Hetzner du 15 juin 2026, **relevés par recherche web** : les pages
  officielles (hetzner.com, docs.hetzner.com) sont bloquées depuis l'environnement de
  développement. À confirmer sur l'offre officielle https://www.hetzner.com/cloud et
  sur l'annonce https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/
  avant toute commande.
- **Taxes** : Hetzner affiche ses prix hors TVA ; la TVA éventuelle dépend du pays et du
  statut du client et s'affiche au moment de la commande. Non vérifiable d'ici.
- **Compatibilité** : architecture x86_64, la même que celle de l'essai complet
  (docs/16). La pile consomme environ 400 Mo en fonctionnement (web 167 Mo, worker
  133 Mo, base 67 Mo, Caddy 15 Mo, Redis 4 Mo) ; la construction de l'image Next.js
  sur le serveur est la phase la plus gourmande, d'où la marge du CX33. Image : 2,1 Go.
  Les serveurs ARM (CAX) n'ont pas été testés.
- Aucun nom de domaine à acheter : `<ip>.sslip.io`.

## 2. IA proposée

- **Fournisseur** : Anthropic (API Claude), appelée uniquement depuis le serveur.
- **Modèle retenu pour les premiers essais** : Claude Sonnet 5.5 (`claude-sonnet-5-5`),
  modèle par défaut du code depuis le 1er octobre 2026. Tarif public : 2 $ par million
  de jetons en entrée, 10 $ en sortie, 0,20 $ en lecture de cache. Interchangeable par
  `AI_MODEL` : Claude Opus 5.5 (`claude-opus-5-5`, 4 $ / 20 $) pour comparer quelques
  résultats ; chaque génération enregistre le modèle réellement utilisé.

### Ce que l'IA fait réellement (secteurs commerce et mode, restauration, automobile, éducation)

| Fonction | Détail |
|---|---|
| Création | Quatre questions (activité, clientèle, style, goûts) → trois sites complets, distincts, construits avec les VRAIS produits, plats, véhicules ou formations de l'entreprise |
| Brouillon | Le choix d'une proposition l'écrit dans le brouillon, sans rien publier |
| Modification par conversation | « Rends le haut de page plus lumineux », « ajoute un lookbook »… → proposition prévisualisable, appliquée seulement après accord, annulable |
| « Améliorer mon site » | Relecture globale avec propositions |
| Ce qu'elle peut changer | Couleurs, typographies, style, formes, animations, textes, ajout, retrait et ordre des sections, produits mis en avant, choix parmi les photos de l'entreprise |
| Publication | Toujours par une personne, jamais par l'IA |
| Garde-fous | Sorties validées par schéma, jamais de code exécuté ; quotas et plafond de coût par formule ; plafond global de la plateforme ; journal des jetons et coûts |

Immobilier, voyage, salon, hôtel et livraison : éditeur manuel et vitrine, **sans**
assistant IA pour l'instant.

### Textes et mise en page, pas d'images ni de vidéos

L'IA produit **des textes et une mise en page** (données structurées). Elle **ne génère
ni images ni vidéos** : les visuels sont les photos de l'entreprise (médiathèque) ;
ceux des démos ont été dessinés par des scripts, pas par une IA. Générer des images ou
des vidéos demanderait un autre fournisseur, non intégré, avec un coût séparé.

### Coût estimé

Tailles mesurées sur les démos (Boutique Aïda, Sunu Marché, Les Filaos) : une création
envoie environ 13 000 caractères et en reçoit 5 400 ; une modification envoie environ
14 000 caractères et en reçoit environ 450. Hypothèse : environ 3 caractères par jeton.
S'y ajoute la réflexion du modèle, facturée en sortie et impossible à mesurer sans clé,
d'où des fourchettes. Taux utilisé : 610 FCFA pour 1 $ (réglable, `AI_USD_TO_XOF`).

| Opération | Opus 5.5 | Sonnet 5.5 | Plafond technique par appel (Opus) |
|---|---|---|---|
| Création (trois propositions) | 0,10 à 0,22 $ (60 à 135 FCFA) | 0,05 à 0,11 $ | 0,35 $ (≈ 215 FCFA) : réponse limitée à 16 000 jetons |
| Modification par conversation | 0,045 à 0,09 $ (30 à 55 FCFA) | 0,02 à 0,045 $ | idem |
| « Améliorer mon site » | 0,06 à 0,15 $ (35 à 90 FCFA) | 0,03 à 0,08 $ | idem |

Exemple de mois de test avec Sonnet 5.5 : 20 créations et 100 modifications, environ
7 $ au plus (≈ 4 300 FCFA). Plafonds retenus pour TOUTE la prévisualisation : 15 000
FCFA dans Y-COM (`AI_PLATFORM_MONTHLY_CAP_XOF`, réservations atomiques, voir docs/18)
et 25 $ de limite dans la console Anthropic si le compte le permet. Les coûts réels sont
mesurés par le banc d'essai (`infra/preview/ai-trial`) ; ces estimations seront
remplacées par les chiffres mesurés.

## 3. Secteurs et fonctionnalités

Légende : **Opérationnel** = fonctionne et a été vérifié (tests exécutés et navigateur) ;
**Simulé** = remplacé par une simulation clairement étiquetée (développement
uniquement) ; **Non connecté** = prévu mais aucun fournisseur branché, rien n'est
présenté comme fait ; **À tester** = construit mais pas encore vérifié dans les
conditions réelles.

| Secteur (démo) | Site public et parcours client | Tableau de bord métier | Assistant IA « Mon site » |
|---|---|---|---|
| Commerce (Sunu Marché, Boutique Aïda) | Opérationnel : catalogue, panier, commande, suivi | Opérationnel : commandes, stock, livraisons, encaissements | À tester avec une vraie clé (vérifié en simulation) |
| **Mode et vêtements** (Atelier Naya) | Opérationnel : variantes taille × couleur avec stock par variante, guide des tailles sur la fiche produit, lookbook, habillage « Atelier Naya » | Opérationnel : commandes, stock, guides des tailles modifiables (par catégorie, remplaçables par produit) | À tester avec une vraie clé |
| Immobilier (Almadies Immobilier) | Opérationnel | Opérationnel : biens, visites, baux, loyers | Pas d'assistant IA (éditeur manuel) |
| Voyage (Baobab Voyages) | Opérationnel | Opérationnel : offres, départs, voyageurs, encaissements | Pas d'assistant IA |
| Salon (Maison Adja) | Opérationnel : prise de rendez-vous | Opérationnel : prestations, disponibilités, rendez-vous | Pas d'assistant IA |
| Hôtel (Maison Sabar) | Opérationnel : recherche par dates, réservation | Opérationnel : planning, séjours, ménage, tarifs | Pas d'assistant IA |
| Restauration (Braise & Bissap) | Opérationnel : carte, commande, QR table, réservation | Opérationnel : cuisine, commandes, tables | À tester avec une vraie clé |
| Automobile (Baobab Motors, Teranga Auto) | Opérationnel : stock, essais, suivi d'import | Opérationnel : arrivages, prospects, ventes | À tester avec une vraie clé |
| Éducation (Collège Les Filaos) | Opérationnel : formations, inscription, espaces famille et élève | Opérationnel : inscriptions, classes, présences, notes, échéances | À tester avec une vraie clé |
| Livraison (Sama Coursier) | Opérationnel : tarif, demande, suivi, espace livreur | Opérationnel : courses, livreurs, caisse, zones | Pas d'assistant IA (vitrine simple) |

| Fonction transversale | État |
|---|---|
| Encaissements saisis par l'équipe (espèces, Wave, Orange Money, virement) avec reçus | Opérationnel (enregistrement manuel, jamais présenté comme un paiement en ligne) |
| Paiement en ligne des commandes (PayDunya) | Mode test (sandbox) seulement, boutique en ligne uniquement ; aucun argent réel dans la prévisualisation |
| API Wave ou Orange Money | Non connecté |
| Abonnements Y-COM (Chariow) | Réservé aux abonnements, jamais aux commandes ; manuel dans la prévisualisation |
| E-mails | Non connecté sans clé Resend : « non envoyé — aucun fournisseur » |
| WhatsApp, SMS | Non connecté |
| Assistant IA | Simulé en développement (étiqueté) ; **à tester** avec une vraie clé ; « non configuré » sans clé |
| Génération d'images et de vidéos | Absente |
| Prévisualisation Docker (build, services, HTTPS, démos) | Opérationnel en essai complet ; Let's Encrypt réel à tester sur le serveur |

Tests exécutés au 1er octobre 2026 : base de données 361, application web 403, tous
réussis.

### Couverture Mode et vêtements (mise à jour du 1er octobre 2026)

- **Démo dédiée « Atelier Naya »** (et sa boutique de test « Maison Naya »), secteur
  `fashion` : 7 pièces photographiées dans une même direction (prêt-à-porter, sacs,
  accessoires), variantes taille × couleur avec stock, 2 guides des tailles, commandes
  réelles par les moteurs. Les illustrations dessinées ont été retirées : un catalogue
  mêlant photos et dessins rendait les propositions incohérentes. Les photos sont des
  recadrages provisoires des maquettes du client (voir demo-templates/MANIFEST.json).
- **Guide des tailles modifiable** : tableau libre (2 à 6 colonnes, 1 à 30 lignes,
  conseil), rattaché à une catégorie et remplaçable par produit ; affiché sur la fiche
  produit (feuille en bas d'écran sur téléphone) seulement si un guide s'applique.
  Vérifié : tests PostgreSQL (validation, résolution, isolation) et navigateur à 390 et
  1440 px (édition, rattachement, affichage boutique).
- **Reste** : le module « Lookbook » n'active rien de spécifique (la section existe pour
  tout commerce) ; pas de filtre par taille dans le catalogue ; pas de génération de
  photos portées (voir docs/18, section 5).

### Atelier de création et trois directions Mode (1er octobre 2026)

- **Trois directions vraiment différentes** pour une boutique d'au moins trois produits
  photographiés : *Éditorial* (photographie dominante, didone, portraits décalés,
  citation), *Sculptural* (pièce sur socle de pierre, arches, grotesque légère, nouveau
  style « Socle ») et *Studio* (nom géant sur aplat cobalt, bandeau défilant, grille
  numérotée, nouveau style « Studio »). Chacune a son propre cadre de page : en-tête,
  cartes produits et pied de page (`siteFrame`, publié avec le site).
- **Nouvelles sections** : `collection_hero` (cover, plinth, wordmark), `product_lineup`
  (editorial, plinth, index), `marquee` (band, outline), `brand_story` (quote, split,
  bold). Contenu toujours visible sans animation ; animations signature (respiration
  de la photo, lettres levées, pièce qui flotte, bandeau en boucle, révélations au
  défilement) coupées si le visiteur réduit les animations.
- **Atelier de création** : onglets 01/02/03, grand aperçu ordinateur ou téléphone,
  plein écran (←/→, Échap), « Votre directeur artistique » à côté de l'aperçu (panneau
  qui monte du bas sur téléphone et tablette), bouton Publier avec menu (voir le site,
  annuler, logo, recréer, réglages avancés). Les directions non choisies sont retrouvées
  en revenant sur la page.
- **Vérifié dans le navigateur** (simulation locale, boutique de test « Maison Naya ») à
  1440 et 390 px : choix d'une direction, sélection d'une section, modification en
  conversation, application au brouillon, publication, puis site en ligne au bon cadre
  avec le nouveau titre. Les textes des directions sont produits par la simulation
  (signalée), pas par l'IA.
