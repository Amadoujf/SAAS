import { describe, expect, it } from "vitest";
import { z } from "zod";
import { sectionParamSchemas } from "@yamacommerce/templates";
import { describeZodError, validateWithMessages } from "./field-errors";

describe("validateWithMessages", () => {
  it("retourne success + data quand la valeur est valide", () => {
    const result = validateWithMessages(z.object({ title: z.string().min(1) }), {
      title: "Bonjour",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.title).toBe("Bonjour");
  });

  it("retourne des messages compréhensibles pour un champ requis manquant", () => {
    const result = validateWithMessages(sectionParamSchemas.hero, {
      media: { url: "https://x.test/a.jpg" },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors.title?.[0]).toMatch(/requis/i);
    }
  });

  it("traduit une contrainte de longueur minimale", () => {
    const result = validateWithMessages(z.object({ n: z.array(z.string()).min(1) }), { n: [] });
    if (!result.success) {
      expect(result.fieldErrors.n?.[0]).toMatch(/au moins 1/);
    } else {
      throw new Error("devait échouer");
    }
  });

  it("traduit une contrainte de longueur maximale", () => {
    const result = validateWithMessages(z.object({ n: z.string().max(3) }), { n: "trop long" });
    if (!result.success) {
      expect(result.fieldErrors.n?.[0]).toMatch(/au plus 3/);
    } else {
      throw new Error("devait échouer");
    }
  });

  it("traduit une URL invalide", () => {
    const result = validateWithMessages(z.object({ videoUrl: z.string().url() }), {
      videoUrl: "pas-une-url",
    });
    if (!result.success) {
      expect(result.fieldErrors.videoUrl?.[0]).toMatch(/lien valide/i);
    } else {
      throw new Error("devait échouer");
    }
  });

  it("traduit une valeur d'énumération invalide avec les options possibles", () => {
    const schema = z.object({ radius: z.enum(["sm", "md", "lg"]) });
    const result = validateWithMessages(schema, { radius: "xxl" });
    if (!result.success) {
      expect(result.fieldErrors.radius?.[0]).toContain("sm, md, lg");
    } else {
      throw new Error("devait échouer");
    }
  });

  it("regroupe les erreurs par chemin complet pour un champ imbriqué", () => {
    const schema = z.object({ media: z.object({ url: z.string().url() }) });
    const error = schema.safeParse({ media: { url: "invalide" } });
    if (error.success) throw new Error("devait échouer");
    const grouped = describeZodError(error.error);
    expect(grouped["media.url"]?.[0]).toMatch(/lien valide/i);
  });
});
