export interface ExpectedDnsRecord {
  type: "CNAME" | "A" | "TXT";
  host: string;
  value: string;
}

/**
 * Calcule les enregistrements DNS à afficher au commerçant dans l'assistant de
 * configuration de domaine (voir docs/09-plan-developpement.md, Phase 1 — « domaine
 * personnalisé »). Un domaine apex (ex. `boutiquefatou.com`) ne peut pas recevoir de
 * CNAME (limite DNS standard) : on demande un enregistrement A vers l'IP d'entrée de
 * la plateforme ; un sous-domaine (ex. `www.boutiquefatou.com`) reçoit un CNAME.
 *
 * Le jeton de vérification TXT (`verificationToken` en base) est fourni séparément par
 * l'appelant — cette fonction ne décide que de la FORME des enregistrements attendus.
 */
export function computeExpectedDnsRecords(
  domain: string,
  verificationToken: string,
  platformIngressHost = "connect.yamacommerce.ai",
  platformIngressIp = process.env.PLATFORM_INGRESS_IP ?? "203.0.113.10",
): ExpectedDnsRecord[] {
  const labels = domain.split(".");
  const isApex = labels.length <= 2; // ex. "boutiquefatou.com" (2 labels) = apex

  const records: ExpectedDnsRecord[] = isApex
    ? [{ type: "A", host: "@", value: platformIngressIp }]
    : [{ type: "CNAME", host: labels[0]!, value: platformIngressHost }];

  records.push({
    type: "TXT",
    host: `_yamacommerce-verification.${domain}`,
    value: verificationToken,
  });

  return records;
}
