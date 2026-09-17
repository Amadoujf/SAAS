import { describe, expect, it } from "vitest";
import { computeExpectedDnsRecords, matchDnsRecords } from "./dns-instructions";

describe("computeExpectedDnsRecords", () => {
  it("demande un enregistrement A pour un domaine apex", () => {
    const records = computeExpectedDnsRecords("boutiquefatou.com", "token-123");
    const aRecord = records.find((r) => r.type === "A");
    expect(aRecord).toBeDefined();
    expect(aRecord?.host).toBe("@");
  });

  it("demande un enregistrement CNAME pour un sous-domaine (ex. www)", () => {
    const records = computeExpectedDnsRecords("www.boutiquefatou.com", "token-123");
    const cname = records.find((r) => r.type === "CNAME");
    expect(cname).toBeDefined();
    expect(cname?.host).toBe("www");
  });

  it("inclut toujours l'enregistrement TXT de vérification avec le bon jeton", () => {
    const records = computeExpectedDnsRecords("boutiquefatou.com", "mon-jeton-secret");
    const txt = records.find((r) => r.type === "TXT");
    expect(txt).toBeDefined();
    expect(txt?.host).toBe("_yamacommerce-verification.boutiquefatou.com");
    expect(txt?.value).toBe("mon-jeton-secret");
  });

  it("inclut un TTL recommandé pour chaque enregistrement", () => {
    const records = computeExpectedDnsRecords("boutiquefatou.com", "token-123");
    expect(records.every((r) => r.ttlSeconds > 0)).toBe(true);
  });
});

describe("matchDnsRecords", () => {
  const expected = computeExpectedDnsRecords("boutiquefatou.com", "token-123");

  it("signale tout comme manquant quand rien n'est détecté", () => {
    const { allMatched, records } = matchDnsRecords(expected, []);
    expect(allMatched).toBe(false);
    expect(records.every((r) => r.status === "missing")).toBe(true);
  });

  it("signale tout comme correspondant quand les valeurs détectées sont identiques", () => {
    const detected = expected.map((r) => ({ type: r.type, host: r.host, value: r.value }));
    const { allMatched, records } = matchDnsRecords(expected, detected);
    expect(allMatched).toBe(true);
    expect(records.every((r) => r.status === "matched")).toBe(true);
  });

  it("signale un enregistrement DÉTECTÉ mais avec une valeur INCORRECTE (mal configuré)", () => {
    const detected = expected.map((r) => ({ type: r.type, host: r.host, value: "valeur-incorrecte" }));
    const { allMatched, records } = matchDnsRecords(expected, detected);
    expect(allMatched).toBe(false);
    expect(records.every((r) => r.status === "mismatched")).toBe(true);
  });

  it("la comparaison de valeur ignore la casse et les espaces superflus", () => {
    const detected = expected.map((r) => ({ type: r.type, host: r.host, value: `  ${r.value.toUpperCase()}  ` }));
    const { allMatched } = matchDnsRecords(expected, detected);
    expect(allMatched).toBe(true);
  });
});
