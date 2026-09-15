import { describe, expect, it } from "vitest";
import { extractMediaAssetIdFromUrl } from "./media-url-ref";

describe("extractMediaAssetIdFromUrl", () => {
  it("reconnaît une URL de médiathèque réelle", () => {
    expect(extractMediaAssetIdFromUrl("https://boutique.example.com/api/media/abc-123/file")).toBe(
      "abc-123",
    );
  });

  it("reconnaît une URL de médiathèque de démonstration", () => {
    expect(extractMediaAssetIdFromUrl("http://localhost:3000/api/demo-media/xyz-789/file")).toBe(
      "xyz-789",
    );
  });

  it("retourne null pour un média externe (hébergé ailleurs)", () => {
    expect(extractMediaAssetIdFromUrl("https://cdn.externe.test/photo.jpg")).toBeNull();
  });

  it("retourne null pour une chaîne vide", () => {
    expect(extractMediaAssetIdFromUrl("")).toBeNull();
  });

  it("gère une chaîne de requête après l'id", () => {
    expect(extractMediaAssetIdFromUrl("https://x.test/api/media/abc-123/file?w=800")).toBe("abc-123");
  });
});
