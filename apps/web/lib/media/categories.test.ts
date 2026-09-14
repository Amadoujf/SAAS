import { describe, expect, it } from "vitest";
import { categoryForType, mediaAssetTypeForCategory } from "./categories";

describe("categoryForType", () => {
  it("classe les formats image", () => {
    expect(categoryForType("jpeg")).toBe("image");
    expect(categoryForType("png")).toBe("image");
    expect(categoryForType("webp")).toBe("image");
    expect(categoryForType("avif")).toBe("image");
  });
  it("classe mp4 comme vidéo", () => {
    expect(categoryForType("mp4")).toBe("video");
  });
  it("classe pdf comme document", () => {
    expect(categoryForType("pdf")).toBe("document");
  });
});

describe("mediaAssetTypeForCategory", () => {
  it("mappe chaque catégorie vers l'enum MediaAsset correspondant", () => {
    expect(mediaAssetTypeForCategory("image")).toBe("IMAGE");
    expect(mediaAssetTypeForCategory("video")).toBe("VIDEO");
    expect(mediaAssetTypeForCategory("document")).toBe("DOCUMENT");
  });
});
