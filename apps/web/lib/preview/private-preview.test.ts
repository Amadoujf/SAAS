import { describe, expect, it } from "vitest";
import { isPreviewExempt, previewFingerprint, safeNext } from "./private-preview";

describe("prévisualisation privée", () => {
  it("n'accepte qu'un chemin relatif de retour", () => {
    expect(safeNext("/formations?domaine=school")).toBe("/formations?domaine=school");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext("/\\evil")).toBe("/");
    expect(safeNext(null)).toBe("/");
  });
  it("laisse passer uniquement la porte, sa vérification, le contrôle TLS et les ressources", () => {
    expect(isPreviewExempt("/acces-previsualisation")).toBe(true);
    expect(isPreviewExempt("/api/domains/ask")).toBe(true);
    expect(isPreviewExempt("/_next/static/x.js")).toBe(true);
    expect(isPreviewExempt("/")).toBe(false);
    expect(isPreviewExempt("/dashboard")).toBe(false);
    expect(isPreviewExempt("/api/storefront/courier/request")).toBe(false);
  });
  it("empreinte stable, jamais le code en clair", async () => {
    const a = await previewFingerprint("secret-code");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain("secret");
    expect(await previewFingerprint(" secret-code ")).toBe(a);
    expect(await previewFingerprint("autre")).not.toBe(a);
  });
});
