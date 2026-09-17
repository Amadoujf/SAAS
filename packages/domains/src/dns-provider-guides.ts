/**
 * Aide contextuelle « selon le fournisseur DNS » — voir docs/13, « INSTRUCTIONS
 * DNS ». Purement informatif (texte + lien vers la doc officielle du fournisseur) :
 * cette plateforme ne modifie JAMAIS automatiquement le DNS d'un fournisseur tiers
 * sans autorisation API réelle (voir la contrainte explicite du cahier des charges) —
 * ces guides ne font qu'orienter le client vers LA bonne page dans SON propre tableau
 * de bord DNS.
 */
export type DnsProviderKey =
  | "cloudflare"
  | "godaddy"
  | "namecheap"
  | "hostinger"
  | "ovh"
  | "google_domains"
  | "other";

export interface DnsProviderGuide {
  key: DnsProviderKey;
  label: string;
  helpUrl: string;
  steps: string[];
}

export const DNS_PROVIDER_GUIDES: Record<DnsProviderKey, DnsProviderGuide> = {
  cloudflare: {
    key: "cloudflare",
    label: "Cloudflare",
    helpUrl: "https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/",
    steps: [
      "Ouvrez le tableau de bord Cloudflare et sélectionnez votre domaine.",
      "Allez dans l'onglet DNS.",
      "Ajoutez chaque enregistrement listé ci-dessus avec le type et la valeur exacts.",
      "Désactivez le proxy (nuage orange) sur ces enregistrements le temps de la vérification.",
    ],
  },
  godaddy: {
    key: "godaddy",
    label: "GoDaddy",
    helpUrl: "https://www.godaddy.com/help/add-a-cname-record-19236",
    steps: [
      "Connectez-vous à votre compte GoDaddy puis ouvrez « Mes produits ».",
      "Cliquez sur « DNS » à côté de votre domaine.",
      "Ajoutez chaque enregistrement listé ci-dessus.",
    ],
  },
  namecheap: {
    key: "namecheap",
    label: "Namecheap",
    helpUrl: "https://www.namecheap.com/support/knowledgebase/article.aspx/9646/",
    steps: [
      "Ouvrez « Domain List » puis cliquez sur « Manage » à côté de votre domaine.",
      "Allez dans l'onglet « Advanced DNS ».",
      "Ajoutez chaque enregistrement listé ci-dessus.",
    ],
  },
  hostinger: {
    key: "hostinger",
    label: "Hostinger",
    helpUrl: "https://support.hostinger.com/en/articles/1583227-how-to-manage-dns-records",
    steps: [
      "Ouvrez hPanel puis « Domaines » > votre domaine.",
      "Cliquez sur « Enregistrements DNS ».",
      "Ajoutez chaque enregistrement listé ci-dessus.",
    ],
  },
  ovh: {
    key: "ovh",
    label: "OVH",
    helpUrl: "https://help.ovhcloud.com/csm/fr-dns-manage-dns-zone",
    steps: [
      "Ouvrez l'espace client OVH puis « Domaines » > votre domaine > « Zone DNS ».",
      "Cliquez sur « Ajouter une entrée ».",
      "Ajoutez chaque enregistrement listé ci-dessus.",
    ],
  },
  google_domains: {
    key: "google_domains",
    label: "Google Domains / Squarespace Domains",
    helpUrl: "https://support.squarespace.com/hc/articles/360002101888",
    steps: [
      "Ouvrez votre domaine puis « DNS » ou « Enregistrements DNS personnalisés ».",
      "Ajoutez chaque enregistrement listé ci-dessus.",
    ],
  },
  other: {
    key: "other",
    label: "Autre fournisseur",
    helpUrl: "",
    steps: [
      "Ouvrez la section « Gestion DNS » ou « Zone DNS » de votre fournisseur.",
      "Ajoutez chaque enregistrement listé ci-dessus avec le type, le nom et la valeur exacts.",
      "Si vous ne trouvez pas cette section, contactez le support de votre fournisseur de domaine.",
    ],
  },
};
