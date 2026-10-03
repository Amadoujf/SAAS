/**
 * Présentation commerciale des formules — source unique pour le site public et la page
 * « Abonnement » du dashboard. Les LIMITES chiffrées viennent toujours de la base
 * (`SubscriptionPlan`) ; ce fichier ne décrit que le texte et l'état de disponibilité de
 * chaque avantage. Un avantage pas encore opérationnel est marqué `soon` et affiché
 * « À venir » — jamais vendu comme disponible.
 */

export interface PlanPerk { label: string; soon?: boolean; note?: string }

export interface PlanLimits {
  maxProducts: number;
  maxEmployees: number;
  maxCustomDomains: number;
  maxAIGenerationsPerMonth: number;
}

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

export function planPerks(name: string, limits: PlanLimits): PlanPerk[] {
  const fiches = { label: `${fmt(limits.maxProducts)} fiches`, note: "Produits, biens, offres, prestations… selon votre secteur" };
  const users = { label: limits.maxEmployees > 1 ? `${fmt(limits.maxEmployees)} utilisateurs` : "1 utilisateur" };
  switch (name) {
    case "Essentiel":
      return [
        { label: "Site premium et animations" },
        { label: "Template personnalisable" },
        fiches,
        { label: "Commandes ou demandes clients" },
        users,
      ];
    case "Business":
      return [
        { label: "Tous les avantages Essentiel" },
        { label: "Connexion d'un domaine personnalisé", note: "Achat et renouvellement du domaine non inclus" },
        fiches,
        users,
        { label: "Gestion métier" },
        { label: "Factures" },
        { label: "Statistiques détaillées" },
        { label: `Quota d'IA : ${fmt(limits.maxAIGenerationsPerMonth)} générations / mois`, soon: true, note: "Assistant IA à venir" },
      ];
    case "Premium":
      return [
        { label: "Tous les avantages Business" },
        fiches,
        users,
        { label: "Gestion avancée", soon: true },
        { label: "Automatisations", soon: true },
        { label: `Quota d'IA supérieur : ${fmt(limits.maxAIGenerationsPerMonth)} générations / mois`, soon: true, note: "Assistant IA à venir" },
        { label: "Assistance prioritaire" },
      ];
    case "Sur mesure":
      return [
        { label: "Plusieurs établissements" },
        { label: "Intégrations spécifiques" },
        { label: "Accompagnement dédié" },
        { label: "Quotas adaptés à votre activité" },
      ];
    default:
      return [fiches, users];
  }
}

/** Ce que compte une « fiche » dans chaque secteur. Commandes, réservations, paiements,
 *  factures, clients et historiques ne sont jamais des fiches. */
export const FICHE_DEFINITIONS: { sector: string; fiche: string }[] = [
  { sector: "Commerce et mode", fiche: "un produit (ses variantes de taille ou de couleur comprises)" },
  { sector: "Restauration", fiche: "un plat ou une boisson de la carte" },
  { sector: "Immobilier", fiche: "un bien (villa, appartement, terrain, local)" },
  { sector: "Voyage", fiche: "une offre (circuit, séjour, excursion) — ses dates de départ comprises" },
  { sector: "Automobile", fiche: "un véhicule" },
  { sector: "Hôtels et locations", fiche: "une chambre ou un logement" },
  { sector: "Salons et services", fiche: "une prestation" },
  { sector: "Écoles et formations", fiche: "une formation — ses sessions comprises" },
  { sector: "Livraison", fiche: "une zone ou une formule de livraison" },
];

export const NEVER_COUNTED = "Ne comptent jamais comme des fiches : commandes, réservations, rendez-vous, paiements, factures, clients et historiques.";
