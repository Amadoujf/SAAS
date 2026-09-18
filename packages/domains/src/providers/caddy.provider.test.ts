import { mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

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

/**
 * Vérifie contre un VRAI système de fichiers (pas un mock) — voir la revue du 18
 * septembre 2026 : un vrai binaire Caddy a d'abord prouvé que le certificat mis en
 * cache d'un domaine suspendu continuait de répondre en HTTPS tant que ses fichiers
 * n'étaient pas supprimés du `FileStorage` sur disque (le seul mécanisme réel de
 * révocation que Caddy expose pour l'émission on-demand). Reproduit ici la structure
 * exacte observée (`certificates/<émetteur>/<domaine>/*`) plutôt qu'une supposition.
 */
describe("CaddyDomainProvider.revokeDomain", () => {
  const originalEnv = process.env.CADDY_CERT_STORAGE_PATH;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.CADDY_CERT_STORAGE_PATH;
    else process.env.CADDY_CERT_STORAGE_PATH = originalEnv;
  });

  async function makeFakeCaddyStorage() {
    const root = await mkdtemp(path.join(tmpdir(), "caddy-storage-"));
    const certificatesDir = path.join(root, "certificates");
    for (const issuer of ["local", "acme-v02.api.letsencrypt.org-directory"]) {
      const domainDir = path.join(certificatesDir, issuer, "revoke-me.example.com");
      await mkdir(domainDir, { recursive: true });
      await writeFile(path.join(domainDir, "revoke-me.example.com.crt"), "fake-cert");
      await writeFile(path.join(domainDir, "revoke-me.example.com.key"), "fake-key");

      // Un autre domaine, sous le MÊME émetteur — ne doit JAMAIS être touché par la
      // révocation d'un domaine différent (isolation, même exigence que la RLS).
      const otherDomainDir = path.join(certificatesDir, issuer, "keep-me.example.com");
      await mkdir(otherDomainDir, { recursive: true });
      await writeFile(path.join(otherDomainDir, "keep-me.example.com.crt"), "fake-cert");
    }
    return { root, certificatesDir };
  }

  it("supprime le certificat mis en cache pour CE domaine, sous TOUS les émetteurs, sans toucher aux autres domaines", async () => {
    const { certificatesDir } = await makeFakeCaddyStorage();
    process.env.CADDY_CERT_STORAGE_PATH = path.dirname(certificatesDir);

    const provider = new CaddyDomainProvider();
    await provider.revokeDomain("revoke-me.example.com");

    for (const issuer of ["local", "acme-v02.api.letsencrypt.org-directory"]) {
      const remaining = await readdir(path.join(certificatesDir, issuer));
      expect(remaining).toEqual(["keep-me.example.com"]);
    }
  });

  it("ne lève jamais si CADDY_CERT_STORAGE_PATH n'est pas configuré (log un avertissement plutôt que de prétendre avoir révoqué)", async () => {
    delete process.env.CADDY_CERT_STORAGE_PATH;
    const provider = new CaddyDomainProvider();
    await expect(provider.revokeDomain("peu-importe.example.com")).resolves.toBeUndefined();
  });

  it("ne lève jamais si le stockage n'a encore rien émis (répertoire certificates/ absent)", async () => {
    const empty = await mkdtemp(path.join(tmpdir(), "caddy-storage-empty-"));
    process.env.CADDY_CERT_STORAGE_PATH = empty;
    const provider = new CaddyDomainProvider();
    await expect(provider.revokeDomain("jamais-emis.example.com")).resolves.toBeUndefined();
  });
});
