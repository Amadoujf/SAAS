import { describe, expect, it } from "vitest";
import { formatListingPrice, selectShowcaseItems, type ShowcasePool } from "./showcase";

const pool: ShowcasePool = {
  products: ["a", "b", "c", "d"].map((id) => ({ id, title: `Produit ${id}`, href: `/p/${id}`, priceLabel: "10 000 FCFA" })),
  listings: [{ id: "v1", title: "Villa", href: "/biens/villa", priceLabel: "650 000 FCFA / mois" }, { id: "o1", title: "Circuit", priceLabel: undefined }],
};
const base = { source: "products" as const, items: [], displayCount: 6, showPrice: true };

describe("sélection du carrousel immersif", () => {
  it("sélection explicite : ordre du commerçant, identifiants inconnus ignorés", () => {
    expect(selectShowcaseItems({ ...base, productIds: ["c", "zz", "a"] }, pool).map((i) => i.id)).toEqual(["c", "a"]);
  });
  it("sans sélection : les plus récents, limités au nombre affiché", () => {
    expect(selectShowcaseItems({ ...base, displayCount: 3 }, pool).map((i) => i.id)).toEqual(["a", "b", "c"]);
  });
  it("fiches (biens, offres…) ; une fiche sans page publique reste sans lien", () => {
    const items = selectShowcaseItems({ ...base, source: "listings" }, pool);
    expect(items.map((i) => i.href)).toEqual(["/biens/villa", undefined]);
  });
  it("prix masqué à la demande (secteurs sans prix affiché)", () => {
    expect(selectShowcaseItems({ ...base, showPrice: false }, pool).every((i) => i.priceLabel === undefined)).toBe(true);
  });
  it("contenus manuels tels quels ; réservoir absent = rien d'inventé", () => {
    const manual = selectShowcaseItems({ ...base, source: "manual", items: [{ title: "Saint-Louis", imageUrl: "/api/media/x/file", href: "/offres/saint-louis" }] }, undefined);
    expect(manual).toEqual([expect.objectContaining({ title: "Saint-Louis", href: "/offres/saint-louis" })]);
    expect(selectShowcaseItems(base, undefined)).toEqual([]);
  });
  it("prix des fiches selon l'unité", () => {
    expect(formatListingPrice(650_000, "per_month")).toBe("650 000 FCFA / mois");
    expect(formatListingPrice(35_000, "per_night")).toBe("35 000 FCFA / nuit");
    expect(formatListingPrice(10, "on_request")).toBe("Prix sur demande");
    expect(formatListingPrice(null, "total")).toBeUndefined();
  });
});
