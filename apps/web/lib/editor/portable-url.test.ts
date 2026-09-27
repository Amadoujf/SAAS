import { describe, expect, it } from "vitest";
import { toPortableUrl } from "./portable-url";

describe("URL de média enregistrée", () => {
  it("un média de l'application devient un chemin valable sur tous les domaines", () => {
    expect(toPortableUrl("http://localhost:3005/api/media/abc/file", "http://localhost:3005")).toBe("/api/media/abc/file");
    expect(toPortableUrl("https://app.y-com.sn/api/media/abc/file?v=2", "https://app.y-com.sn")).toBe("/api/media/abc/file?v=2");
  });
  it("une image d'un autre hôte ou déjà relative reste inchangée", () => {
    expect(toPortableUrl("https://cdn.exemple.com/photo.webp", "http://localhost:3005")).toBe("https://cdn.exemple.com/photo.webp");
    expect(toPortableUrl("/demo-templates/x.webp", "http://localhost:3005")).toBe("/demo-templates/x.webp");
  });
});
