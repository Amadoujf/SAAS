/**
 * Coût estimé d'un appel IA, en FCFA, à partir des jetons facturés. Tarifs publics par
 * million de jetons (USD) ; taux de change configurable (`AI_USD_TO_XOF`, défaut 610).
 * Estimation de suivi (quotas, plafond de la formule), pas une facture.
 */
const PRICES_USD_PER_MTOK: Record<string, { input: number; output: number; cacheRead: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1 },
};

export interface TokenUsage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

export function estimateCostXOF(model: string, usage: TokenUsage): number {
  const price = PRICES_USD_PER_MTOK[model] ?? PRICES_USD_PER_MTOK["claude-opus-5-5"]!;
  const rate = Number(process.env.AI_USD_TO_XOF) > 0 ? Number(process.env.AI_USD_TO_XOF) : 610;
  const usd =
    ((usage.input_tokens ?? 0) * price.input +
      (usage.cache_creation_input_tokens ?? 0) * price.input * 1.25 +
      (usage.cache_read_input_tokens ?? 0) * price.cacheRead +
      (usage.output_tokens ?? 0) * price.output) /
    1_000_000;
  return Math.ceil(usd * rate);
}

/** Plafond de la réponse demandée au fournisseur (réflexion comprise). */
export const AI_MAX_OUTPUT_TOKENS = 16_000;
/** Majorant des jetons envoyés par appel (consigne + demande + schéma ≈ 5 000 mesurés). */
const AI_MAX_INPUT_TOKENS = 30_000;

/** Coût MAXIMAL d'un appel, réservé sur le budget de la plateforme avant l'appel. */
export function worstCaseCostXOF(model: string): number {
  return estimateCostXOF(model, { input_tokens: AI_MAX_INPUT_TOKENS, output_tokens: AI_MAX_OUTPUT_TOKENS });
}
