import { describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({
  resolveTxt: vi.fn(),
}));

const { resolveTxt } = await import("node:dns/promises");
const { CaddyDomainProvider } = await import("./caddy.provider");

describe("CaddyDomainProvider.verifyDomain", () => {
  it("valide le domaine quand le TXT attendu est présent", async () => {
    vi.mocked(resolveTxt).mockResolvedValue([["expected-token"]]);

    const provider = new CaddyDomainProvider();
    const result = await provider.verifyDomain("boutique.example.sn", "expected-token");

    expect(result.verified).toBe(true);
  });

  it("refuse le domaine quand le TXT ne correspond pas", async () => {
    vi.mocked(resolveTxt).mockResolvedValue([["autre-valeur"]]);

    const provider = new CaddyDomainProvider();
    const result = await provider.verifyDomain("boutique.example.sn", "expected-token");

    expect(result.verified).toBe(false);
  });

  it("refuse proprement le domaine quand la résolution DNS échoue", async () => {
    vi.mocked(resolveTxt).mockRejectedValue(new Error("ENOTFOUND"));

    const provider = new CaddyDomainProvider();
    const result = await provider.verifyDomain("inconnu.example.sn", "expected-token");

    expect(result.verified).toBe(false);
    expect(result.reason).toContain("ENOTFOUND");
  });
});
