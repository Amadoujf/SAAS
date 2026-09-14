import { describe, expect, it } from "vitest";
import { detectFileSignature } from "./file-signatures";

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

function ascii(text: string): number[] {
  return Array.from(text).map((char) => char.charCodeAt(0));
}

/** Construit une boîte `ftyp` ISO-BMFF minimale (utilisée par MP4 ET AVIF). */
function ftypBox(majorBrand: string, compatibleBrands: string[] = []): Uint8Array {
  const size = 16 + compatibleBrands.length * 4;
  const buffer = new Uint8Array(size);
  const view = new DataView(buffer.buffer);
  view.setUint32(0, size, false);
  buffer.set(ascii("ftyp"), 4);
  buffer.set(ascii(majorBrand.padEnd(4, " ")), 8);
  // minor_version (4 octets, ignoré ici)
  compatibleBrands.forEach((brand, index) => {
    buffer.set(ascii(brand.padEnd(4, " ")), 16 + index * 4);
  });
  return buffer;
}

describe("detectFileSignature", () => {
  it("détecte un JPEG à sa signature FF D8 FF", () => {
    const result = detectFileSignature(bytes(0xff, 0xd8, 0xff, 0xe0));
    expect(result).toEqual({ type: "jpeg", mimeType: "image/jpeg" });
  });

  it("détecte un PNG à sa signature de 8 octets", () => {
    const result = detectFileSignature(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0));
    expect(result).toEqual({ type: "png", mimeType: "image/png" });
  });

  it("détecte un WebP (RIFF....WEBP)", () => {
    const buffer = new Uint8Array(16);
    buffer.set(ascii("RIFF"), 0);
    buffer.set(ascii("WEBP"), 8);
    expect(detectFileSignature(buffer)).toEqual({ type: "webp", mimeType: "image/webp" });
  });

  it("détecte un PDF (%PDF-)", () => {
    const buffer = new Uint8Array(ascii("%PDF-1.7\n"));
    expect(detectFileSignature(buffer)).toEqual({ type: "pdf", mimeType: "application/pdf" });
  });

  it("détecte un AVIF via la marque ftyp 'avif'", () => {
    const buffer = ftypBox("avif", ["mif1", "miaf"]);
    expect(detectFileSignature(buffer)).toEqual({ type: "avif", mimeType: "image/avif" });
  });

  it("détecte un MP4 via la marque ftyp 'isom'", () => {
    const buffer = ftypBox("isom", ["iso2", "mp41"]);
    expect(detectFileSignature(buffer)).toEqual({ type: "mp4", mimeType: "video/mp4" });
  });

  it("détecte un MP4 quand la marque MP4 est seulement une marque COMPATIBLE (pas la marque majeure)", () => {
    const buffer = ftypBox("dash", ["isom", "avc1"]);
    expect(detectFileSignature(buffer)).toEqual({ type: "mp4", mimeType: "video/mp4" });
  });

  it("retourne null pour un contenu totalement inconnu (jamais une devinette)", () => {
    expect(detectFileSignature(bytes(1, 2, 3, 4, 5, 6, 7, 8))).toBeNull();
  });

  it("retourne null pour un SVG (jamais reconnu comme type accepté)", () => {
    const buffer = new Uint8Array(ascii('<?xml version="1.0"?><svg></svg>'));
    expect(detectFileSignature(buffer)).toBeNull();
  });

  it("retourne null pour un buffer trop court", () => {
    expect(detectFileSignature(bytes(0xff))).toBeNull();
  });

  it("ne se laisse pas tromper par une extension .jpg sur un contenu non-JPEG (usurpation d'extension)", () => {
    // Contenu réel : un script — jamais reconnu comme un type accepté, quelle que
    // soit l'extension du nom de fichier original (vérifiée séparément, voir
    // upload-validation.ts).
    const buffer = new Uint8Array(ascii("#!/bin/sh\necho pwned\n"));
    expect(detectFileSignature(buffer)).toBeNull();
  });
});
