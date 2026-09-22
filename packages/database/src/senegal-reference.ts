/**
 * Données de référence pour le Sénégal — étape 2 (clients/panier/commandes/livraison,
 * 19 septembre 2026). Rien de tel n'existait dans le projet avant cette étape (aucune
 * liste de régions, aucun validateur de téléphone) : seul précédent trouvé par
 * l'exploration était deux valeurs de démonstration en dur dans `seed.ts`
 * (`+221771234567`).
 *
 * `Customer.phone`/`CustomerAddress.region`/`DeliveryZone.region` restent des colonnes
 * `String` libres dans le schéma (pas d'enum Postgres, pas de table de référence) : ces
 * fonctions sont donc des validateurs APPLICATIFS, appelés à la frontière (formulaires
 * dashboard/storefront, checkout), jamais une contrainte DB — cohérent avec le reste du
 * schéma qui ne modélise aucune de ces valeurs comme enum.
 */

/** Les 14 régions administratives du Sénégal. */
export const SENEGAL_REGIONS = [
  "Dakar",
  "Diourbel",
  "Fatick",
  "Kaffrine",
  "Kaolack",
  "Kédougou",
  "Kolda",
  "Louga",
  "Matam",
  "Saint-Louis",
  "Sédhiou",
  "Tambacounda",
  "Thiès",
  "Ziguinchor",
] as const;

export type SenegalRegion = (typeof SENEGAL_REGIONS)[number];

export function isValidSenegalRegion(region: string): region is SenegalRegion {
  return (SENEGAL_REGIONS as readonly string[]).includes(region);
}

/**
 * Numéro sénégalais : indicatif +221 suivi de 9 chiffres (ex. `+221771234567`, seul
 * format observé dans ce projet — voir `seed.ts`). Accepte aussi une saisie locale à 9
 * chiffres commençant par un préfixe mobile connu (70/75/76/77/78) et la normalise vers
 * la forme `+221XXXXXXXXX` — jamais d'espaces, jamais de `0` initial après l'indicatif.
 */
const SENEGAL_MOBILE_PREFIXES = ["70", "75", "76", "77", "78"];

export function normalizeSenegalPhone(input: string): string | null {
  const digitsOnly = input.replace(/[\s.-]/g, "");

  let nationalNumber: string | null = null;
  if (/^\+221\d{9}$/.test(digitsOnly)) {
    nationalNumber = digitsOnly.slice(4);
  } else if (/^00221\d{9}$/.test(digitsOnly)) {
    nationalNumber = digitsOnly.slice(5);
  } else if (/^\d{9}$/.test(digitsOnly)) {
    nationalNumber = digitsOnly;
  } else {
    return null;
  }

  const prefix = nationalNumber.slice(0, 2);
  if (!SENEGAL_MOBILE_PREFIXES.includes(prefix)) {
    return null;
  }

  return `+221${nationalNumber}`;
}

export function isValidSenegalPhone(input: string): boolean {
  return normalizeSenegalPhone(input) !== null;
}
