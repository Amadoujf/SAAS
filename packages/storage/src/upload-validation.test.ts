import { describe, expect, it } from "vitest";
import { validateUploadedFile } from "./upload-validation";

function ascii(text: string): number[] {
  return Array.from(text).map((char) => char.charCodeAt(0));
}

function buildPng(width = 100, height = 100): Uint8Array {
  const buffer = new Uint8Array(33);
  buffer.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(buffer.buffer);
  view.setUint32(8, 13, false);
  buffer.set(ascii("IHDR"), 12);
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  return buffer;
}

function baseInput(overrides: Partial<Parameters<typeof validateUploadedFile>[0]> = {}) {
  return {
    buffer: buildPng(),
    declaredMimeType: "image/png",
    originalFileName: "photo.png",
    maxSizeBytes: 10_000_000,
    ...overrides,
  };
}

describe("validateUploadedFile — cas valide", () => {
  it("accepte un PNG cohérent (signature, MIME déclaré, extension, taille)", () => {
    const result = validateUploadedFile(baseInput());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.type).toBe("png");
      expect(result.dimensions).toEqual({ width: 100, height: 100 });
      expect(result.checksumSha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("le checksum est déterministe pour un contenu identique", () => {
    const a = validateUploadedFile(baseInput());
    const b = validateUploadedFile(baseInput());
    expect(a.success && b.success && a.checksumSha256 === b.checksumSha256).toBe(true);
  });
});

describe("validateUploadedFile — rejets", () => {
  it("rejette un fichier vide", () => {
    const result = validateUploadedFile(baseInput({ buffer: new Uint8Array(0) }));
    expect(result).toMatchObject({ success: false, reason: "empty_file" });
  });

  it("rejette un fichier trop volumineux", () => {
    const result = validateUploadedFile(baseInput({ maxSizeBytes: 10 }));
    expect(result).toMatchObject({ success: false, reason: "too_large" });
  });

  it("rejette une double extension dangereuse (facture.pdf.exe)", () => {
    const result = validateUploadedFile(
      baseInput({ originalFileName: "facture.pdf.exe", declaredMimeType: "application/pdf" }),
    );
    expect(result).toMatchObject({ success: false, reason: "double_extension" });
  });

  it("MIME FALSIFIÉ : rejette un déclaré 'image/png' pour un contenu réel non-image", () => {
    const scriptBuffer = new Uint8Array(ascii("just some random bytes, not an image"));
    const result = validateUploadedFile(
      baseInput({ buffer: scriptBuffer, originalFileName: "photo.png" }),
    );
    expect(result).toMatchObject({ success: false, reason: "unrecognized_signature" });
  });

  it("rejette un MIME déclaré différent de la signature réelle détectée", () => {
    const result = validateUploadedFile(baseInput({ declaredMimeType: "image/jpeg" }));
    expect(result).toMatchObject({ success: false, reason: "mime_mismatch" });
  });

  it("rejette une extension ne correspondant pas au contenu réel (PNG nommé .jpg)", () => {
    const result = validateUploadedFile(baseInput({ originalFileName: "photo.jpg" }));
    expect(result).toMatchObject({ success: false, reason: "extension_mismatch" });
  });

  it("rejette un contenu dangereux (balise <script embarquée après les données PNG)", () => {
    const png = buildPng();
    const withScript = new Uint8Array([...png, ...ascii("<script>alert(1)</script>")]);
    const result = validateUploadedFile(baseInput({ buffer: withScript }));
    expect(result).toMatchObject({ success: false, reason: "dangerous_content" });
  });

  it("rejette un contenu dangereux (shebang embarqué, style polyglotte)", () => {
    const png = buildPng();
    const withShebang = new Uint8Array([...png, ...ascii("#!/bin/sh\nrm -rf /")]);
    const result = validateUploadedFile(baseInput({ buffer: withShebang }));
    expect(result).toMatchObject({ success: false, reason: "dangerous_content" });
  });

  it("rejette un PDF contenant du JavaScript intégré", () => {
    const pdfWithJs = new Uint8Array(ascii("%PDF-1.7\n1 0 obj << /OpenAction 2 0 R /JavaScript (app.alert(1)) >>"));
    const result = validateUploadedFile(
      baseInput({ buffer: pdfWithJs, declaredMimeType: "application/pdf", originalFileName: "doc.pdf" }),
    );
    expect(result).toMatchObject({ success: false, reason: "dangerous_content" });
  });

  it("rejette une bombe de décompression (image annoncée avec des dimensions énormes)", () => {
    const hugePng = buildPng(20000, 20000);
    const result = validateUploadedFile(baseInput({ buffer: hugePng }));
    expect(result).toMatchObject({ success: false, reason: "decompression_bomb" });
  });
});
