import { resolve4, resolveCname, resolveTxt } from "node:dns/promises";
import type { InMemoryDnsZone } from "./providers/local.provider";
import { matchDnsRecords, type DnsRecordMatch, type ExpectedDnsRecord } from "./dns-instructions";

/**
 * Résolution DNS générique (A/CNAME/TXT) — voir docs/13, « DÉTECTION DNS ». Séparée
 * de `DomainProvider` (qui ne s'occupe que de la vérification de propriété et du
 * TLS) : ce module répond juste à « qu'est-ce que le DNS public dit en ce moment
 * pour cet enregistrement ? », utilisé pour l'affichage « État détecté » de chaque
 * ligne d'instructions DNS (voir dns-instructions.ts `matchDnsRecords`).
 */
export interface DnsResolver {
  resolveRecord(type: "A" | "CNAME" | "TXT", host: string): Promise<string[]>;
}

/** Résolveur RÉEL — interroge le vrai DNS public. Ne lève jamais : une absence
 *  d'enregistrement (NXDOMAIN, ENODATA) devient un tableau vide, jamais une
 *  exception qui interromprait la vérification des AUTRES enregistrements. */
export class NodeDnsResolver implements DnsResolver {
  async resolveRecord(type: "A" | "CNAME" | "TXT", host: string): Promise<string[]> {
    try {
      if (type === "A") return await resolve4(host);
      if (type === "CNAME") return await resolveCname(host);
      const records = await resolveTxt(host);
      return records.map((chunks) => chunks.join(""));
    } catch {
      return [];
    }
  }
}

/** Résolveur simulé — voir docs/13, « DÉMONSTRATION » : « Un simulateur de
 *  propagation DNS ». Lit une `InMemoryDnsZone` (voir providers/local.provider.ts)
 *  au lieu du réseau réel. */
export class InMemoryDnsResolver implements DnsResolver {
  constructor(private readonly zone: InMemoryDnsZone) {}

  async resolveRecord(type: "A" | "CNAME" | "TXT", host: string): Promise<string[]> {
    return this.zone.getRecords(type, host);
  }
}

/**
 * `ExpectedDnsRecord.host` encode soit "@" (l'apex), soit le PREMIER label du
 * domaine ajouté lui-même (ex. "www" pour "www.boutiquefatou.com" — voir
 * `computeExpectedDnsRecords`, qui l'a extrait de ce même `domain`), soit — pour le
 * seul TXT de vérification — un nom déjà pleinement qualifié
 * (`_yamacommerce-verification.domaine.com`). Dans les deux premiers cas,
 * l'enregistrement à interroger est donc `domain` LUI-MÊME, jamais `label.domain`
 * (qui doublerait "www"). On distingue les deux formes par la présence d'un point :
 * seul un nom déjà pleinement qualifié en contient un.
 */
export function toQualifiedHost(domain: string, recordHost: string): string {
  return recordHost.includes(".") ? recordHost : domain;
}

/**
 * Interroge le résolveur pour CHAQUE enregistrement attendu, puis compare via
 * `matchDnsRecords` (voir dns-instructions.ts) — le point d'entrée unique utilisé à
 * la fois par le worker de détection (apps/web/lib/domains/dns-check-worker.ts) et
 * par le bouton « Vérifier maintenant ».
 */
export async function checkExpectedDnsRecords(
  resolver: DnsResolver,
  domain: string,
  expected: ExpectedDnsRecord[],
): Promise<{ allMatched: boolean; records: DnsRecordMatch[] }> {
  const detected: { type: string; host: string; value: string }[] = [];
  for (const record of expected) {
    const values = await resolver.resolveRecord(record.type, toQualifiedHost(domain, record.host));
    for (const value of values) {
      detected.push({ type: record.type, host: record.host, value });
    }
  }
  return matchDnsRecords(expected, detected);
}
