import { describe, expect, it } from "vitest";
import { isDecompressionBomb, readImageDimensions } from "./image-dimensions";

function ascii(text: string): number[] {
  return Array.from(text).map((char) => char.charCodeAt(0));
}

function buildPng(width: number, height: number): Uint8Array {
  const buffer = new Uint8Array(33);
  buffer.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(buffer.buffer);
  view.setUint32(8, 13, false); // longueur du chunk IHDR
  buffer.set(ascii("IHDR"), 12);
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  return buffer;
}

function buildJpeg(width: number, height: number): Uint8Array {
  // SOI + SOF0 (0xFFC0) avec longueur=17, précision=8, hauteur, largeur, 3 composants factices.
  const buffer = new Uint8Array(2 + 2 + 2 + 1 + 2 + 2 + 9 + 2);
  let offset = 0;
  buffer.set([0xff, 0xd8], offset); // SOI
  offset += 2;
  buffer.set([0xff, 0xc0], offset); // SOF0
  offset += 2;
  new DataView(buffer.buffer).setUint16(offset, 17, false); // longueur segment
  offset += 2;
  buffer[offset] = 8; // précision
  offset += 1;
  new DataView(buffer.buffer).setUint16(offset, height, false);
  offset += 2;
  new DataView(buffer.buffer).setUint16(offset, width, false);
  offset += 2;
  // 9 octets de composants factices + EOI
  offset += 9;
  buffer.set([0xff, 0xd9], offset);
  return buffer;
}

function buildWebpVp8x(width: number, height: number): Uint8Array {
  const buffer = new Uint8Array(30);
  buffer.set(ascii("RIFF"), 0);
  buffer.set(ascii("WEBP"), 8);
  buffer.set(ascii("VP8X"), 12);
  const w = width - 1;
  const h = height - 1;
  buffer[24] = w & 0xff;
  buffer[25] = (w >> 8) & 0xff;
  buffer[26] = (w >> 16) & 0xff;
  buffer[27] = h & 0xff;
  buffer[28] = (h >> 8) & 0xff;
  buffer[29] = (h >> 16) & 0xff;
  return buffer;
}

describe("readImageDimensions", () => {
  it("lit les dimensions d'un PNG", () => {
    expect(readImageDimensions(buildPng(800, 600), "png")).toEqual({ width: 800, height: 600 });
  });

  it("lit les dimensions d'un JPEG (segment SOF0)", () => {
    expect(readImageDimensions(buildJpeg(1024, 768), "jpeg")).toEqual({ width: 1024, height: 768 });
  });

  it("lit les dimensions d'un WebP VP8X", () => {
    expect(readImageDimensions(buildWebpVp8x(1200, 900), "webp")).toEqual({
      width: 1200,
      height: 900,
    });
  });

  it("retourne null pour un WebP qui n'est pas VP8X (limite assumée), jamais une valeur inventée", () => {
    const buffer = new Uint8Array(30);
    buffer.set(ascii("RIFF"), 0);
    buffer.set(ascii("WEBP"), 8);
    buffer.set(ascii("VP8 "), 12);
    expect(readImageDimensions(buffer, "webp")).toBeNull();
  });

  it("retourne toujours null pour AVIF (limite assumée, documentée)", () => {
    expect(readImageDimensions(new Uint8Array(100), "avif")).toBeNull();
  });

  it("retourne null pour un PNG tronqué plutôt que de lire des octets hors limites", () => {
    expect(readImageDimensions(new Uint8Array(10), "png")).toBeNull();
  });
});

describe("isDecompressionBomb", () => {
  it("n'alerte pas pour une image raisonnable (1920x1080)", () => {
    expect(isDecompressionBomb({ width: 1920, height: 1080 })).toBe(false);
  });

  it("détecte une bombe de décompression (ex. 20000x20000)", () => {
    expect(isDecompressionBomb({ width: 20000, height: 20000 })).toBe(true);
  });

  it("accepte pile la limite mais refuse un pixel de plus", () => {
    expect(isDecompressionBomb({ width: 8000, height: 8000 })).toBe(false); // 64,000,000 pile
    expect(isDecompressionBomb({ width: 8000, height: 8001 })).toBe(true);
  });
});
