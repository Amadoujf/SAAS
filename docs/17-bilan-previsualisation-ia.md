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
- **Modèle** : Claude Opus 5.5 (`claude-opus-5-5`), déjà le modèle par défaut du code.
  Tarif public : 4 $ par million de jetons en entrée, 20 $ en sortie, 0,20 $ en
  lecture de cache. Variante moins chère, à qualité moindre : Claude Sonnet 5.5
  (`AI_MODEL=claude-sonnet-5-5`, 2 $ / 10 $), environ deux fois moins cher.

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

Exemple de mois de test : 20 créations et 100 modifications, soit environ 13 $ au plus
(≈ 8 200 FCFA) avec Opus. Plafond proposé : 15 000 FCFA dans Y-COM
(`AI_PLATFORM_MONTHLY_CAP_XOF`) et 25 $ de limite dans la console Anthropic. Les coûts
réels s'affichent après chaque génération ; ces estimations seront remplacées par les
chiffres mesurés.

## 3. Secteurs et fonctionnalités

Légende : **Opérationnel** = fonctionne et a été vérifié (tests exécutés et navigateur) ;
**Simulé** = remplacé par une simulation clairement étiquetée (développement
uniquement) ; **Non connecté** = prévu mais aucun fournisseur branché, rien n'est
présenté comme fait ; **À tester** = construit mais pas encore vérifié dans les
conditions réelles.

| Secteur (démo) | Site public et parcours client | Tableau de bord métier | Assistant IA « Mon site » |
|---|---|---|---|
| Commerce (Sunu Marché, Boutique Aïda) | Opérationnel : catalogue, panier, commande, suivi | Opérationnel : commandes, stock, livraisons, encaissements | À tester avec une vraie clé (vérifié en simulation) |
| **Mode et vêtements** (pas de démo dédiée) | Opérationnel via le moteur commerce : variantes taille, couleur, matière avec stock par variante ; section lookbook ; habillage « Atelier Naya » | Opérationnel (commun au commerce) | À tester avec une vraie clé |
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

### Couverture Mode et vêtements

- **Présent** : secteur « Mode et vêtements » proposé à l'inscription, avec des modules
  par défaut ; variantes par taille, couleur et matière avec stock propre ; section
  lookbook ; habillage éditorial « Atelier Naya » ; assistant IA (même moteur que le
  commerce).
- **Manque** :
  1. aucune démo au secteur `fashion` : Boutique Aïda porte l'habillage mode mais son
     secteur est « commerce » et son catalogue est mixte (mode, accessoires, maison,
     beauté) ;
  2. le guide des tailles n'existe que dans les maquettes statiques, l'entreprise ne
     peut pas le remplir ;
  3. les modules « Variantes avancées » et « Lookbook » ne changent rien de spécifique
     (le lookbook est disponible pour tout commerce).
- **Proposition** (après validation) : une démo dédiée « mode » au secteur `fashion`, un
  guide des tailles modifiable par produit ou par catégorie, et un test de l'assistant
  IA sur cette démo.
