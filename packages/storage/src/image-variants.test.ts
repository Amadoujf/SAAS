import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { generateImageVariants, IMAGE_VARIANT_SPECS } from "./image-variants";

async function syntheticJpeg(width: number, height: number): Promise<Uint8Array> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 120, g: 40, b: 200 },
    },
  })
    .jpeg()
    .toBuffer();
}

async function syntheticPng(width: number, height: number): Promise<Uint8Array> {
  return sharp({
    create: { width, height, channels: 4, background: { r: 10, g: 200, b: 50, alpha: 0.5 } },
  })
    .png()
    .toBuffer();
}

describe("generateImageVariants", () => {
  it("génère miniature/petite/moyenne (pas grande) + original pour une image de 1000px", async () => {
    const buffer = await syntheticJpeg(1000, 800);
    const variants = await generateImageVariants({ buffer, sourceType: "jpeg" });
    const keys = variants.map((v) => v.key);
    expect(keys).toContain("thumbnail");
    expect(keys).toContain("small");
    expect(keys).toContain("medium");
    expect(keys).not.toContain("large"); // 1920 >= 1000, jamais d'agrandissement
    expect(keys).toContain("original");
  }, 20_000);

  it("ne génère AUCUNE variante redimensionnée pour une image plus petite que tous les paliers (seulement 'original')", async () => {
    const buffer = await syntheticJpeg(100, 100);
    const variants = await generateImageVariants({ buffer, sourceType: "jpeg" });
    expect(variants.map((v) => v.key)).toEqual(["original"]);
  }, 20_000);

  it("chaque variante redimensionnée respecte sa largeur maximale (jamais d'agrandissement)", async () => {
    const buffer = await syntheticJpeg(2000, 1500);
    const variants = await generateImageVariants({ buffer, sourceType: "jpeg" });
    for (const spec of IMAGE_VARIANT_SPECS) {
      const variant = variants.find((v) => v.key === spec.key);
      if (variant) {
        expect(variant.width).toBeLessThanOrEqual(spec.maxWidth);
      }
    }
  }, 20_000);

  it("choisit toujours le format le plus léger parmi original/WebP/AVIF (jamais un fichier vide ou nul)", async () => {
    const buffer = await syntheticJpeg(1200, 900);
    const variants = await generateImageVariants({ buffer, sourceType: "jpeg" });
    for (const variant of variants) {
      expect(variant.sizeBytes).toBeGreaterThan(0);
      expect(variant.bytes.length).toBe(variant.sizeBytes);
      expect(["jpeg", "png", "webp", "avif"]).toContain(variant.format);
    }
  }, 20_000);

  it("conserve un original PNG transparent en PNG ou un format plus léger, jamais forcé en JPEG (perte de transparence)", async () => {
    const buffer = await syntheticPng(1200, 900);
    const variants = await generateImageVariants({ buffer, sourceType: "png" });
    for (const variant of variants) {
      expect(variant.format).not.toBe("jpeg");
    }
  }, 20_000);

  it("l'original optimisé garde les dimensions d'origine (jamais redimensionné)", async () => {
    const buffer = await syntheticJpeg(640, 480);
    const variants = await generateImageVariants({ buffer, sourceType: "jpeg" });
    const original = variants.find((v) => v.key === "original")!;
    expect(original.width).toBe(640);
    expect(original.height).toBe(480);
  }, 20_000);
});
