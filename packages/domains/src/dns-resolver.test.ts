import { describe, expect, it } from "vitest";
import { computeExpectedDnsRecords } from "./dns-instructions";
import { InMemoryDnsResolver, NodeDnsResolver, checkExpectedDnsRecords } from "./dns-resolver";
import { InMemoryDnsZone } from "./providers/local.provider";

describe("checkExpectedDnsRecords avec InMemoryDnsResolver", () => {
  const domain = "boutiquefatou.com";
  const expected = computeExpectedDnsRecords(domain, "token-abc");

  it("DNS INCORRECT : rapporte tout comme manquant quand la zone simulée est vide", async () => {
    const resolver = new InMemoryDnsResolver(new InMemoryDnsZone());
    const { allMatched } = await checkExpectedDnsRecords(resolver, domain, expected);
    expect(allMatched).toBe(false);
  });

  it("ACTIVATION : rapporte tout comme correspondant une fois les enregistrements ajoutés à la zone simulée", async () => {
    const zone = new InMemoryDnsZone();
    zone.setRecord("A", domain, "203.0.113.10");
    zone.setRecord("TXT", "_yamacommerce-verification.boutiquefatou.com", "token-abc");
    const resolver = new InMemoryDnsResolver(zone);
    const { allMatched } = await checkExpectedDnsRecords(resolver, domain, expected);
    expect(allMatched).toBe(true);
  });

  it("un sous-domaine (ex. www) interroge le bon nom pleinement qualifié", async () => {
    const wwwDomain = "www.boutiquefatou.com";
    const wwwExpected = computeExpectedDnsRecords(wwwDomain, "token-abc");
    const zone = new InMemoryDnsZone();
    zone.setRecord("CNAME", "www.boutiquefatou.com", "connect.yamacommerce.ai");
    zone.setRecord("TXT", "_yamacommerce-verification.www.boutiquefatou.com", "token-abc");
    const resolver = new InMemoryDnsResolver(zone);
    const { allMatched } = await checkExpectedDnsRecords(resolver, wwwDomain, wwwExpected);
    expect(allMatched).toBe(true);
  });
});

describe("NodeDnsResolver", () => {
  it("ne lève jamais, même pour un domaine inexistant (NXDOMAIN devient un tableau vide)", async () => {
    const resolver = new NodeDnsResolver();
    await expect(resolver.resolveRecord("A", "ce-domaine-n-existe-vraiment-pas-12345.invalid")).resolves.toEqual([]);
  });
});
