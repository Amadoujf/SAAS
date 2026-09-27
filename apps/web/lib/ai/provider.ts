import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type * as z from "zod/v4";
import { estimateCostXOF } from "./cost";

/**
 * Accès au fournisseur IA — UNIQUEMENT côté serveur (jamais de clé ni d'appel depuis le
 * navigateur). L'IA ne renvoie que des DONNÉES structurées, validées contre un schéma ;
 * elle ne produit jamais de code exécuté par la plateforme.
 *
 * Trois états, toujours affichés tels quels à l'entreprise :
 * - « anthropic » : vraie génération (clé `AI_PROVIDER_API_KEY` configurée) ;
 * - « simulated » : développement uniquement (`AI_PROVIDER=simulated`, refusé en
 *   production) — règles locales déterministes, TOUJOURS étiquetées « simulation »,
 *   jamais présentées comme une génération IA ;
 * - indisponible : aucune clé → l'assistant l'indique, rien n'est inventé.
 */

export type AiProviderKind = "anthropic" | "simulated";

export interface AiStatus {
  available: boolean;
  kind: AiProviderKind | null;
  model: string | null;
  /** Explication affichable quand l'IA n'est pas disponible. */
  reason?: string;
}

const DEFAULT_MODEL = "claude-opus-5";

export function getAiStatus(): AiStatus {
  const key = process.env.AI_PROVIDER_API_KEY?.trim();
  if (key) return { available: true, kind: "anthropic", model: process.env.AI_MODEL?.trim() || DEFAULT_MODEL };
  if (process.env.AI_PROVIDER === "simulated" && process.env.NODE_ENV !== "production") {
    return { available: true, kind: "simulated", model: null };
  }
  return { available: false, kind: null, model: null, reason: "Le fournisseur IA n'est pas encore configuré sur cette plateforme (clé d'accès manquante)." };
}

export class AiProviderError extends Error {
  constructor(
    public readonly reason: "unavailable" | "refused" | "invalid_output" | "rate_limited" | "network" | "provider",
    message: string,
    public readonly usage: { inputTokens: number; outputTokens: number; costXOF: number } = { inputTokens: 0, outputTokens: 0, costXOF: 0 },
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}

export interface StructuredRequest<T> {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  /** Profondeur de réflexion : `medium` pour une modification ciblée, `high` pour une création. */
  effort: "low" | "medium" | "high";
  /** Règles locales du mode simulé (développement) — jamais utilisées avec un vrai fournisseur. */
  simulate: () => T;
}

export interface StructuredResult<T> {
  data: T;
  model: string | null;
  simulated: boolean;
  inputTokens: number;
  outputTokens: number;
  costXOF: number;
}

let client: Anthropic | null = null;
function anthropic(apiKey: string): Anthropic {
  client ??= new Anthropic({ apiKey, timeout: 120_000, maxRetries: 1 });
  return client;
}

export async function generateStructured<T>(request: StructuredRequest<T>): Promise<StructuredResult<T>> {
  const status = getAiStatus();
  if (!status.available) throw new AiProviderError("unavailable", status.reason ?? "IA indisponible.");
  if (status.kind === "simulated") {
    const data = request.schema.parse(request.simulate());
    return { data, model: null, simulated: true, inputTokens: 0, outputTokens: 0, costXOF: 0 };
  }

  const model = status.model ?? DEFAULT_MODEL;
  try {
    const response = await anthropic(process.env.AI_PROVIDER_API_KEY!.trim()).beta.messages.parse({
      model,
      max_tokens: 16000,
      // Repli côté serveur si le modèle décline : la demande est reprise par un autre
      // modèle dans le même appel, sans intervention de l'entreprise.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: request.effort, format: betaZodOutputFormat(request.schema) },
      system: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: request.prompt }],
    });
    const inputTokens = (response.usage.input_tokens ?? 0) + (response.usage.cache_creation_input_tokens ?? 0) + (response.usage.cache_read_input_tokens ?? 0);
    const outputTokens = response.usage.output_tokens ?? 0;
    const usage = { inputTokens, outputTokens, costXOF: estimateCostXOF(response.model ?? model, response.usage) };
    if (response.stop_reason === "refusal") throw new AiProviderError("refused", "La demande a été refusée par le fournisseur IA. Reformulez-la.", usage);
    if (response.stop_reason === "max_tokens") throw new AiProviderError("invalid_output", "La réponse de l'IA était incomplète. Réessayez.", usage);
    if (!response.parsed_output) throw new AiProviderError("invalid_output", "La réponse de l'IA n'a pas le format attendu. Réessayez.", usage);
    return { data: response.parsed_output as T, model: response.model ?? model, simulated: false, ...usage };
  } catch (error) {
    if (error instanceof AiProviderError) throw error;
    if (error instanceof Anthropic.RateLimitError) throw new AiProviderError("rate_limited", "Le service IA est très sollicité. Réessayez dans une minute.");
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      throw new AiProviderError("unavailable", "La clé du fournisseur IA est refusée : vérifiez la configuration de la plateforme.");
    }
    if (error instanceof Anthropic.APIConnectionError) throw new AiProviderError("network", "Le service IA est injoignable. Réessayez dans un instant.");
    if (error instanceof Anthropic.APIError) throw new AiProviderError("provider", `Le service IA a renvoyé une erreur (${error.status ?? "?"}). Réessayez.`);
    throw new AiProviderError("invalid_output", "La réponse de l'IA n'a pas pu être validée. Réessayez.");
  }
}
