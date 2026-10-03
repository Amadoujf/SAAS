/** Libellés et rôle de chaque rôle système, pour l'écran Équipe. */
export const ROLE_LABELS: Record<string, { label: string; description: string }> = {
  OWNER: { label: "Propriétaire", description: "Tous les accès, y compris l'abonnement." },
  MANAGER: { label: "Gérant", description: "Tous les accès sauf l'abonnement et la facturation des domaines." },
  SALES: { label: "Vendeur", description: "Commandes et clients." },
  INVENTORY_MANAGER: { label: "Gestionnaire de stock", description: "Produits et stocks." },
  MARKETING: { label: "Marketing", description: "Clients, promotions et rapports." },
  ACCOUNTANT: { label: "Comptable", description: "Factures, paiements et rapports." },
  DELIVERY_STAFF: { label: "Livreur", description: "Livraisons qui lui sont confiées." },
  TEACHER: { label: "Enseignant", description: "Présences et notes de ses classes uniquement." },
};
