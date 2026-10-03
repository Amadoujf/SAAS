import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";
import { testOwnerClient } from "./test-owner-client";
import { createCategory, createProduct } from "../src/catalog-registry";
import {
  SizeGuideError,
  createSizeGuide,
  deleteSizeGuide,
  listSizeGuides,
  normalizeSizeGuide,
  resolveProductSizeGuide,
  setCategorySizeGuide,
  setProductSizeGuide,
  updateSizeGuide,
} from "../src/size-guide-registry";

/**
 * Guides des tailles sur PostgreSQL RÉEL : validation, résolution produit → catégorie,
 * détachement à la suppression, isolation (RLS et clés composites même-entreprise).
 */
let databaseAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch (error) {
  if (process.env.REQUIRE_DB_TESTS === "true") {
    throw new Error(`REQUIRE_DB_TESTS=true mais PostgreSQL est injoignable : ${error instanceof Error ? error.message : String(error)}`);
  }
  databaseAvailable = false;
  // eslint-disable-next-line no-console
  console.warn("[size-guide.test] Base de données injoignable — suite ignorée (skip).");
}

const FEMME = {
  name: "Robes et hauts femme",
  columns: ["Taille", "Poitrine (cm)", "Taille (cm)", "Hanches (cm)"],
  rows: [["S", "84-88", "66-70", "92-96"], ["M", "89-93", "71-75", "97-101"], ["L", "94-99", "76-81", "102-107"]],
  note: "Entre deux tailles, prenez la plus grande.",
};

describe("normalisation d'un guide des tailles", () => {
  it("nettoie les espaces, retire les lignes vides, complète les cellules manquantes", () => {
    const g = normalizeSizeGuide({ name: "  Chaussures  ", columns: ["Pointure", " Longueur (cm) "], rows: [["38", "24"], ["", ""], ["39"]], note: "  " });
    expect(g).toEqual({ name: "Chaussures", columns: ["Pointure", "Longueur (cm)"], rows: [["38", "24"], ["39", ""]], note: null });
  });
  it("refuse : sans nom, une seule colonne, colonne sans titre, taille manquante, taille en double", () => {
    expect(() => normalizeSizeGuide({ ...FEMME, name: " " })).toThrow(SizeGuideError);
    expect(() => normalizeSizeGuide({ ...FEMME, columns: ["Taille"] })).toThrow(/2 à 6 colonnes/);
    expect(() => normalizeSizeGuide({ ...FEMME, columns: ["Taille", ""] })).toThrow(/intitulé/);
    expect(() => normalizeSizeGuide({ ...FEMME, rows: [["", "84"]] })).toThrow(/sa taille/);
    expect(() => normalizeSizeGuide({ ...FEMME, rows: [["M", "1"], ["m", "2"]] })).toThrow(/qu'une fois/);
  });
});

describe.skipIf(!databaseAvailable)("guides des tailles (PostgreSQL)", () => {
  const suffix = Math.random().toString(36).slice(2, 10);
  const tenantIds: string[] = [];
  let a = "";
  let b = "";
  let catA = "";
  let prodA = "";

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      for (const k of ["a", "b"]) {
        const t = await tx.tenant.create({ data: { slug: `test-tailles-${k}-${suffix}`, name: `Mode ${k}`, businessType: "ECOMMERCE", status: "ACTIVE" } });
        tenantIds.push(t.id);
      }
    });
    [a, b] = tenantIds as [string, string];
    await withTenant(a, async (tx) => {
      catA = (await createCategory(tx, a, { name: "Robes", slug: "robes" })).id;
      prodA = (await createProduct(tx, a, { name: "Robe portefeuille", slug: "robe-portefeuille", basePrice: 54_000, categoryId: catA })).id;
    });
  });

  afterAll(async () => {
    const o = testOwnerClient();
    await o.product.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await o.category.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await o.sizeGuide.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await o.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await o.$disconnect();
  });

  it("résolution : guide de la catégorie, remplacé par celui du produit, puis retour à la catégorie", async () => {
    await withTenant(a, async (tx) => {
      const femme = await createSizeGuide(tx, a, FEMME);
      const ample = await createSizeGuide(tx, a, { name: "Coupe ample", columns: ["Taille", "Longueur (cm)"], rows: [["Unique", "140"]] });
      expect(await resolveProductSizeGuide(tx, a, prodA)).toBeNull();
      await setCategorySizeGuide(tx, a, catA, femme.id);
      expect((await resolveProductSizeGuide(tx, a, prodA))?.name).toBe("Robes et hauts femme");
      await setProductSizeGuide(tx, a, prodA, ample.id);
      expect((await resolveProductSizeGuide(tx, a, prodA))?.rows).toEqual([["Unique", "140"]]);
      await setProductSizeGuide(tx, a, prodA, null);
      expect((await resolveProductSizeGuide(tx, a, prodA))?.id).toBe(femme.id);
      const listed = await listSizeGuides(tx, a);
      expect(listed.find((g) => g.id === femme.id)).toMatchObject({ categories: 1, products: 0 });
      await expect(createSizeGuide(tx, a, FEMME)).rejects.toThrow(/déjà ce nom/);
    });
  });

  it("modification puis suppression : le guide est détaché de ses usages", async () => {
    await withTenant(a, async (tx) => {
      const g = await createSizeGuide(tx, a, { name: "Temporaire", columns: ["Taille", "Tour (cm)"], rows: [["M", "90"]] });
      await setProductSizeGuide(tx, a, prodA, g.id);
      const updated = await updateSizeGuide(tx, a, g.id, { name: "Temporaire", columns: ["Taille", "Tour (cm)"], rows: [["M", "92"]] });
      expect(updated.rows).toEqual([["M", "92"]]);
      await deleteSizeGuide(tx, a, g.id);
      const p = await tx.product.findUniqueOrThrow({ where: { id: prodA } });
      expect(p.sizeGuideId).toBeNull();
    });
  });

  it("isolation : une autre entreprise ne voit pas le guide et ne peut pas le rattacher", async () => {
    const guideA = await withTenant(a, (tx) => createSizeGuide(tx, a, { name: "Privé A", columns: ["Taille", "Tour"], rows: [["S", "80"]] }));
    expect(await withTenant(b, (tx) => listSizeGuides(tx, b))).toHaveLength(0);
    const catB = await withTenant(b, (tx) => createCategory(tx, b, { name: "Hauts", slug: "hauts" }));
    await expect(withTenant(b, (tx) => setCategorySizeGuide(tx, b, catB.id, guideA.id))).rejects.toThrow(/introuvable/);
    // Même en contournant l'application, la clé composite refuse le rattachement.
    await expect(withSuperAdminAccess((tx) => tx.category.update({ where: { id: catB.id }, data: { sizeGuideId: guideA.id } }))).rejects.toThrow();
  });
});
