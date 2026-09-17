import { describe, expect, it } from "vitest";
import { InMemoryDnsZone, LocalDomainProvider } from "./local.provider";

describe("LocalDomainProvider", () => {
  it("VÉRIFICATION TXT : échoue quand aucun enregistrement n'est présent", async () => {
    const zone = new InMemoryDnsZone();
    const provider = new LocalDomainProvider(zone);
    const result = await provider.verifyDomain("boutiquefatou.com", "token-abc");
    expect(result.verified).toBe(false);
  });

  it("réussit une fois l'enregistrement TXT attendu présent dans la zone simulée", async () => {
    const zone = new InMemoryDnsZone();
    zone.setTxtRecord("_yamacommerce-verification.boutiquefatou.com", "token-abc");
    const provider = new LocalDomainProvider(zone);
    const result = await provider.verifyDomain("boutiquefatou.com", "token-abc");
    expect(result.verified).toBe(true);
  });

  it("distingue 'aucun enregistrement' de 'un enregistrement incorrect'", async () => {
    const zone = new InMemoryDnsZone();
    zone.setTxtRecord("_yamacommerce-verification.boutiquefatou.com", "mauvais-jeton");
    const provider = new LocalDomainProvider(zone);
    const result = await provider.verifyDomain("boutiquefatou.com", "token-abc");
    expect(result.verified).toBe(false);
    expect(result.reason).toMatch(/ne correspond pas/);
  });

  it("SSL_PENDING PUIS ACTIVE : le certificat n'est émis qu'après plusieurs tentatives", async () => {
    const zone = new InMemoryDnsZone();
    const provider = new LocalDomainProvider(zone, 2);
    const first = await provider.provisionDomain("boutiquefatou.com");
    expect(first.sslStatus).toBe("pending");
    const second = await provider.provisionDomain("boutiquefatou.com");
    expect(second.sslStatus).toBe("issued");
  });

  it("provisionDomain reste 'issued' même rappelé après l'avoir déjà atteint (idempotent)", async () => {
    const zone = new InMemoryDnsZone();
    const provider = new LocalDomainProvider(zone, 1);
    const first = await provider.provisionDomain("boutiquefatou.com");
    const second = await provider.provisionDomain("boutiquefatou.com");
    expect(first.sslStatus).toBe("issued");
    expect(second.sslStatus).toBe("issued");
  });

  it("revokeDomain réinitialise l'état (nouvelle vérification et un nouveau certificat requis)", async () => {
    const zone = new InMemoryDnsZone();
    zone.setTxtRecord("_yamacommerce-verification.boutiquefatou.com", "token-abc");
    const provider = new LocalDomainProvider(zone, 2);
    await provider.provisionDomain("boutiquefatou.com");
    await provider.revokeDomain("boutiquefatou.com");

    expect((await provider.provisionDomain("boutiquefatou.com")).sslStatus).toBe("pending");
    expect((await provider.verifyDomain("boutiquefatou.com", "token-abc")).verified).toBe(false);
  });
});
