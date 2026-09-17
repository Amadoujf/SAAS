import { describe, expect, it } from "vitest";
import { isApexDomain, normalizeDomainName, toDisplayDomainName, validateDomainFormat } from "./domain-validation";

describe("normalizeDomainName", () => {
  it("met en minuscules et retire un schéma/chemin collé par erreur", () => {
    expect(normalizeDomainName("https://Boutiquefatou.com/catalogue")).toBe("boutiquefatou.com");
  });

  it("retire un point final (FQDN)", () => {
    expect(normalizeDomainName("boutiquefatou.com.")).toBe("boutiquefatou.com");
  });

  it("encode un domaine IDN en Punycode ASCII", () => {
    const normalized = normalizeDomainName("café.com");
    expect(normalized).toBe("xn--caf-dma.com");
  });
});

describe("toDisplayDomainName", () => {
  it("redécode le Punycode pour l'affichage", () => {
    expect(toDisplayDomainName("xn--caf-dma.com")).toBe("café.com");
  });
});

describe("isApexDomain", () => {
  it("identifie un domaine racine (2 labels)", () => {
    expect(isApexDomain("boutiquefatou.com")).toBe(true);
  });

  it("identifie un sous-domaine (3+ labels) comme non-apex", () => {
    expect(isApexDomain("www.boutiquefatou.com")).toBe(false);
  });
});

describe("validateDomainFormat", () => {
  it("accepte un domaine valide", () => {
    expect(validateDomainFormat("boutiquefatou.com").valid).toBe(true);
    expect(validateDomainFormat("www.boutiquefatou.com").valid).toBe(true);
  });

  it("DOMAINE IDN : accepte un domaine Punycode valide sans le signaler comme invalide", () => {
    expect(validateDomainFormat(normalizeDomainName("café.com")).valid).toBe(true);
  });

  it("rejette une chaîne vide", () => {
    expect(validateDomainFormat("").issues).toEqual(["empty"]);
  });

  it("BLOCAGE IP : rejette une adresse IPv4 ou IPv6", () => {
    expect(validateDomainFormat("192.168.1.1").issues).toContain("is_ip_address");
    expect(validateDomainFormat("::1").valid).toBe(false);
  });

  it("BLOCAGE LOCALHOST/INTERNE : rejette localhost et les domaines .local/.internal", () => {
    expect(validateDomainFormat("localhost").issues).toContain("is_localhost_or_internal");
    expect(validateDomainFormat("printer.local").issues).toContain("is_localhost_or_internal");
    expect(validateDomainFormat("server.internal").issues).toContain("is_localhost_or_internal");
  });

  it("rejette les TLD réservées RFC 2606 (test/example/invalid)", () => {
    expect(validateDomainFormat("boutique.test").issues).toContain("blocked_tld");
    expect(validateDomainFormat("boutique.example").issues).toContain("blocked_tld");
    expect(validateDomainFormat("boutique.invalid").issues).toContain("blocked_tld");
  });

  it("rejette un format invalide (label vide, caractères interdits)", () => {
    expect(validateDomainFormat("boutique..com").valid).toBe(false);
    expect(validateDomainFormat("boutique_fatou.com").valid).toBe(false);
    expect(validateDomainFormat("sanspointcom").valid).toBe(false);
  });
});
