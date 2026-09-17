import type { DomainProvider, DomainProvisioningResult, DomainVerificationResult } from "../types";

/**
 * Zone DNS simulée en mémoire — voir docs/13, « DÉMONSTRATION » : « Un simulateur de
 * propagation DNS ». Un test ou la démonstration y écrit les enregistrements qu'un
 * client aurait "ajoutés chez son fournisseur DNS réel" ; `LocalDomainProvider` ne lit
 * QUE cette zone, jamais le vrai réseau — voir `CaddyDomainProvider` pour l'équivalent
 * qui interroge un vrai résolveur DNS.
 */
export type SimulatedRecordType = "A" | "CNAME" | "TXT";

/** Zone générique (A/CNAME/TXT) — voir dns-resolver.ts `DnsResolver`, dont
 *  `InMemoryDnsZone` est l'implémentation "réseau simulé". `setTxtRecord`/
 *  `getTxtRecords` restent des raccourcis pour `LocalDomainProvider`, qui ne
 *  s'intéresse qu'au TXT de vérification de propriété. */
export class InMemoryDnsZone {
  private readonly records = new Map<SimulatedRecordType, Map<string, Set<string>>>();

  setRecord(type: SimulatedRecordType, host: string, value: string): void {
    const byHost = this.records.get(type) ?? new Map<string, Set<string>>();
    const key = host.toLowerCase();
    const existing = byHost.get(key) ?? new Set<string>();
    existing.add(value);
    byHost.set(key, existing);
    this.records.set(type, byHost);
  }

  getRecords(type: SimulatedRecordType, host: string): string[] {
    return [...(this.records.get(type)?.get(host.toLowerCase()) ?? [])];
  }

  setTxtRecord(host: string, value: string): void {
    this.setRecord("TXT", host, value);
  }

  getTxtRecords(host: string): string[] {
    return this.getRecords("TXT", host);
  }

  clear(host?: string): void {
    if (host) {
      for (const byHost of this.records.values()) byHost.delete(host.toLowerCase());
    } else {
      this.records.clear();
    }
  }
}

/**
 * Implémentation LOCALE/DÉMONSTRATION de `DomainProvider` — voir docs/13,
 * « DÉMONSTRATION » : « Un adaptateur local complet », « Un simulateur de création
 * HTTPS ». Même contrat que `CaddyDomainProvider`/`CloudflareCustomHostnameProvider`
 * (voir la note de tête de fichier de types.ts) : le code appelant (pipeline,
 * worker) ne sait jamais laquelle des trois implémentations il utilise.
 *
 * Le certificat n'est émis ("issued") qu'après `sslIssueAfterAttempts` appels à
 * `provisionDomain` (rappelé à CHAQUE tentative du worker de détection, voir sa
 * documentation dans types.ts) — simule une émission qui prend un peu de temps (voir
 * « statut SSL_PENDING » dans le cycle de vie), plutôt qu'instantanée, ce qui
 * rendrait la démonstration de cet état impossible à observer.
 */
export class LocalDomainProvider implements DomainProvider {
  readonly name = "local" as const;
  private readonly attemptsByDomain = new Map<string, number>();

  constructor(
    private readonly dnsZone: InMemoryDnsZone,
    private readonly sslIssueAfterAttempts = 2,
  ) {}

  async verifyDomain(domain: string, expectedToken: string): Promise<DomainVerificationResult> {
    const records = this.dnsZone.getTxtRecords(`_yamacommerce-verification.${domain}`);
    if (records.includes(expectedToken)) return { verified: true };
    return {
      verified: false,
      reason:
        records.length > 0
          ? "Un enregistrement TXT a été trouvé mais ne correspond pas au jeton attendu."
          : "Aucun enregistrement TXT de vérification trouvé — la propagation DNS peut prendre un certain temps.",
    };
  }

  async provisionDomain(domain: string): Promise<DomainProvisioningResult> {
    const attempts = (this.attemptsByDomain.get(domain) ?? 0) + 1;
    this.attemptsByDomain.set(domain, attempts);
    return this.statusForAttempts(attempts);
  }

  async revokeDomain(domain: string): Promise<void> {
    this.attemptsByDomain.delete(domain);
    this.dnsZone.clear(`_yamacommerce-verification.${domain}`);
  }

  private statusForAttempts(attempts: number): DomainProvisioningResult {
    return { sslStatus: attempts >= this.sslIssueAfterAttempts ? "issued" : "pending" };
  }
}
