import "server-only";
import { AiUsageError, platformAiSpendXOF, withSuperAdminAccess } from "@yamacommerce/database";

/**
 * Plafond de dépenses IA de TOUTE la plateforme, par mois civil, en FCFA estimés
 * (`AI_PLATFORM_MONTHLY_CAP_XOF`). S'ajoute aux quotas et plafonds de chaque formule.
 * Vérifié AVANT chaque appel réel au fournisseur : une fois atteint, plus aucune
 * génération n'est lancée jusqu'au mois suivant (ou jusqu'à un relèvement du plafond).
 * Le dépassement possible est borné à un seul appel en cours (réponse limitée en jetons).
 *
 * C'est une estimation calculée par Y-COM : la limite de dépenses réglée dans la console
 * du fournisseur reste le garde-fou définitif.
 */
export function platformAiCapXOF(): number | null {
  const cap = Number(process.env.AI_PLATFORM_MONTHLY_CAP_XOF);
  return Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : null;
}

export function platformCapReached(spentXOF: number, capXOF: number | null): boolean {
  return capXOF !== null && spentXOF >= capXOF;
}

export async function assertPlatformAiBudget(): Promise<void> {
  const cap = platformAiCapXOF();
  if (cap === null) return;
  const spent = await withSuperAdminAccess((tx) => platformAiSpendXOF(tx));
  if (platformCapReached(spent, cap)) {
    throw new AiUsageError("cost_cap", "Le plafond mensuel de dépenses IA de la plateforme est atteint : l'assistant est en pause jusqu'au mois prochain. Votre site n'a pas été modifié.");
  }
}
