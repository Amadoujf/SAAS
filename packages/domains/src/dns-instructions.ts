export interface ExpectedDnsRecord {
  type: "CNAME" | "A" | "TXT";
  host: string;
  value: string;
  /** Secondes — voir docs/13, « INSTRUCTIONS DNS » : « TTL recommandé ». 3600 (1h) est
   *  un compromis raisonnable : assez court pour que la propagation reste rapide, assez
   *  long pour ne pas surcharger le fournisseur DNS du client. */
  ttlSeconds: number;
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

  const DEFAULT_TTL_SECONDS = 3600;

  const records: ExpectedDnsRecord[] = isApex
    ? [{ type: "A", host: "@", value: platformIngressIp, ttlSeconds: DEFAULT_TTL_SECONDS }]
    : [{ type: "CNAME", host: labels[0]!, value: platformIngressHost, ttlSeconds: DEFAULT_TTL_SECONDS }];

  records.push({
    type: "TXT",
    host: `_yamacommerce-verification.${domain}`,
    value: verificationToken,
    ttlSeconds: DEFAULT_TTL_SECONDS,
  });

  return records;
}

export type DnsRecordMatchStatus = "matched" | "missing" | "mismatched";

export interface DnsRecordMatch {
  expected: ExpectedDnsRecord;
  status: DnsRecordMatchStatus;
  detectedValue?: string;
}

/**
 * Compare les enregistrements ATTENDUS aux enregistrements RÉELLEMENT détectés (voir
 * apps/web/lib/domains/dns-check.ts, qui interroge le vrai DNS) — module pur : ne
 * résout jamais lui-même le DNS, ne fait que la comparaison affichée au client
 * (« État détecté » par enregistrement, voir « INSTRUCTIONS DNS »).
 */
export function matchDnsRecords(
  expected: ExpectedDnsRecord[],
  detected: { type: string; host: string; value: string }[],
): { allMatched: boolean; records: DnsRecordMatch[] } {
  const records = expected.map((record): DnsRecordMatch => {
    const candidates = detected.filter(
      (d) => d.type === record.type && d.host.toLowerCase() === record.host.toLowerCase(),
    );
    if (candidates.length === 0) {
      return { expected: record, status: "missing" };
    }
    const match = candidates.find((d) => d.value.trim().toLowerCase() === record.value.trim().toLowerCase());
    if (match) {
      return { expected: record, status: "matched", detectedValue: match.value };
    }
    return { expected: record, status: "mismatched", detectedValue: candidates[0]!.value };
  });

  return { allMatched: records.every((r) => r.status === "matched"), records };
}
