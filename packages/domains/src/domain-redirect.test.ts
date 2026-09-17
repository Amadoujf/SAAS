import { describe, expect, it } from "vitest";
import { resolveDomainServeDecision, type RedirectableDomain } from "./domain-redirect";

function domain(overrides: Partial<RedirectableDomain>): RedirectableDomain {
  return {
    id: "d1",
    domain: "example.com",
    isPrimary: false,
    isLive: true,
    serveDirectlyWhenNotPrimary: false,
    ...overrides,
  };
}

describe("resolveDomainServeDecision", () => {
  it("le domaine principal sert toujours directement", () => {
    const primary = domain({ id: "p", isPrimary: true });
    expect(resolveDomainServeDecision(primary, [primary]).action).toBe("serve");
  });

  it("un domaine secondaire redirige vers le principal ACTIF", () => {
    const primary = domain({ id: "p", domain: "boutiquefatou.com", isPrimary: true });
    const secondary = domain({ id: "s", domain: "www.boutiquefatou.com" });
    const decision = resolveDomainServeDecision(secondary, [primary, secondary]);
    expect(decision).toEqual({ action: "redirect", targetDomain: "boutiquefatou.com" });
  });

  it("SOUS-DOMAINE GRATUIT CONSERVÉ EN SECOURS : sert directement malgré un autre domaine principal", () => {
    const primary = domain({ id: "p", domain: "boutiquefatou.com", isPrimary: true });
    const freeSubdomain = domain({
      id: "f",
      domain: "boutique-fatou.yamacommerce.ai",
      serveDirectlyWhenNotPrimary: true,
    });
    const decision = resolveDomainServeDecision(freeSubdomain, [primary, freeSubdomain]);
    expect(decision.action).toBe("serve");
  });

  it("sert directement si aucun domaine principal ACTIF n'existe encore", () => {
    const onlyDomain = domain({ id: "d", isLive: false });
    expect(resolveDomainServeDecision(onlyDomain, [onlyDomain]).action).toBe("serve");
  });

  it("AUCUNE BOUCLE POSSIBLE : le principal ne redirige jamais, même listé après un secondaire", () => {
    const secondary = domain({ id: "s", domain: "www.x.com" });
    const primary = domain({ id: "p", domain: "x.com", isPrimary: true });
    const decisionForPrimary = resolveDomainServeDecision(primary, [secondary, primary]);
    const decisionForSecondary = resolveDomainServeDecision(secondary, [secondary, primary]);
    expect(decisionForPrimary.action).toBe("serve");
    expect(decisionForSecondary).toEqual({ action: "redirect", targetDomain: "x.com" });
  });
});
