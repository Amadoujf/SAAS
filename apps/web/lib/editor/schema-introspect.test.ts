import { describe, expect, it } from "vitest";
import { z } from "zod";
import { sectionParamSchemas } from "@yamacommerce/templates";
import {
  describeField,
  describeObjectSchema,
  emptyValueForField,
  humanizeFieldName,
} from "./schema-introspect";

describe("describeField — types de base", () => {
  it("détecte un champ texte requis", () => {
    const field = describeField("title", z.string().min(1));
    expect(field).toMatchObject({ name: "title", kind: "text", required: true });
    expect(field.label).toBe("Titre");
  });

  it("détecte un champ optionnel", () => {
    const field = describeField("subtitle", z.string().optional());
    expect(field.required).toBe(false);
  });

  it("détecte un champ avec valeur par défaut comme non requis", () => {
    const field = describeField("displayCount", z.number().int().min(1).max(12).default(6));
    expect(field.required).toBe(false);
    expect(field.defaultValue).toBe(6);
    expect(field.kind).toBe("number");
    expect(field.min).toBe(1);
    expect(field.max).toBe(12);
  });

  it("détecte une URL", () => {
    expect(describeField("videoUrl", z.string().url()).kind).toBe("url");
  });

  it("détecte un courriel", () => {
    expect(describeField("email", z.string().email().optional()).kind).toBe("email");
  });

  it("détecte une couleur via le nom du champ", () => {
    expect(describeField("colorPrimary", z.string().min(1)).kind).toBe("color");
    expect(describeField("borderColor", z.string().min(1)).kind).toBe("color");
  });

  it("détecte un booléen", () => {
    expect(describeField("showMap", z.boolean().default(false)).kind).toBe("boolean");
  });

  it("détecte une énumération avec ses options", () => {
    const field = describeField("radius", z.enum(["none", "sm", "md", "lg", "full"]).optional());
    expect(field.kind).toBe("enum");
    expect(field.enumOptions).toEqual(["none", "sm", "md", "lg", "full"]);
  });

  it("détecte un tableau d'identifiants (...Ids)", () => {
    const field = describeField("categoryIds", z.array(z.string()).min(1));
    expect(field.kind).toBe("id-list");
    expect(field.min).toBe(1);
  });

  it("détecte un tableau d'objets avec ses champs imbriqués", () => {
    const field = describeField(
      "items",
      z.array(z.object({ icon: z.string(), title: z.string() })).min(1).max(6),
    );
    expect(field.kind).toBe("array-object");
    expect(field.min).toBe(1);
    expect(field.max).toBe(6);
    expect(field.itemFields?.map((f) => f.name)).toEqual(["icon", "title"]);
  });

  it("détecte un objet imbriqué (media)", () => {
    const field = describeField(
      "media",
      z.object({ url: z.string().url(), alt: z.string().optional() }),
    );
    expect(field.kind).toBe("object");
    expect(field.fields?.map((f) => f.name)).toEqual(["url", "alt"]);
    expect(field.fields?.[0]?.kind).toBe("url");
  });

  it("ne plante jamais sur un type non géré : retombe sur 'unsupported'", () => {
    const field = describeField("weird", z.union([z.string(), z.number()]));
    expect(field.kind).toBe("unsupported");
  });
});

describe("humanizeFieldName — jamais d'échec", () => {
  it("traduit les noms connus", () => {
    expect(humanizeFieldName("title")).toBe("Titre");
    expect(humanizeFieldName("ctaLabel")).toBe("Texte du bouton");
    expect(humanizeFieldName("categoryIds")).toBe("Catégories associées");
  });

  it("retombe sur une mise en forme automatique pour un nom totalement inconnu", () => {
    const label = humanizeFieldName("zorbFlibberCount");
    expect(typeof label).toBe("string");
    expect(label.length).toBeGreaterThan(0);
  });
});

describe("describeObjectSchema — sur les VRAIS schémas de sections", () => {
  it("décrit hero sans erreur", () => {
    const fields = describeObjectSchema(sectionParamSchemas.hero);
    const byName = new Map(fields.map((f) => [f.name, f]));
    expect(byName.get("title")?.required).toBe(true);
    expect(byName.get("subtitle")?.required).toBe(false);
    expect(byName.get("media")?.kind).toBe("object");
  });

  it("décrit les 23 schémas de sections sans jamais planter", () => {
    for (const schema of Object.values(sectionParamSchemas)) {
      expect(() => describeObjectSchema(schema)).not.toThrow();
    }
  });

  it("décrit correctement le tableau d'objets imbriqués de benefits", () => {
    const fields = describeObjectSchema(sectionParamSchemas.benefits);
    const items = fields.find((f) => f.name === "items")!;
    expect(items.kind).toBe("array-object");
    expect(items.itemFields?.map((f) => f.name)).toEqual(["icon", "title", "description"]);
  });
});

describe("emptyValueForField", () => {
  it("produit une valeur vide plausible par nature de champ", () => {
    expect(emptyValueForField({ name: "a", label: "A", kind: "text", required: true })).toBe("");
    expect(emptyValueForField({ name: "a", label: "A", kind: "boolean", required: true })).toBe(
      false,
    );
    expect(emptyValueForField({ name: "a", label: "A", kind: "id-list", required: true })).toEqual(
      [],
    );
  });

  it("produit un objet complet pour un champ 'object' imbriqué", () => {
    const field = describeField(
      "media",
      z.object({ url: z.string().url(), alt: z.string().optional() }),
    );
    expect(emptyValueForField(field)).toEqual({ url: "", alt: "" });
  });
});
