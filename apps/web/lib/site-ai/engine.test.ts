import { describe, expect, it } from "vitest";
import { compileDirection, distinctArchetypes } from "./compile";
import { applyOperations, type SiteState } from "./operations";
import { auditPhotos } from "./photo-audit";
import { ARCHETYPE_KEYS, directionsOutputSchema, editOutputSchema } from "./schemas";
import { simulateDirections, simulateEdit } from "./simulate";
import type { CatalogProduct, SiteAiContext } from "./types";

const product = (i: number, over: Partial<CatalogProduct> = {}): CatalogProduct => ({
  id: `p${i}`, slug: `produit-${i}`, name: `Produit ${i}`, category: "Maison", priceLabel: "10 000 FCFA", description: `Description du produit ${i}. Deuxième phrase.`,
  createdAt: `2026-09-${String(10 + i).padStart(2, "0")}T00:00:00.000Z`, imageUrl: `/img/${i}.webp`, imageAlt: `Photo ${i}`, imageWidth: 1400, imageCount: 1, ...over,
});

const context: SiteAiContext = {
  tenantName: "Maison Ndiaye",
  sectorKey: "ecommerce",
  logoUrl: null,
  products: [product(1), product(2), product(3), product(4), product(5, { imageUrl: null, imageAlt: null, imageWidth: null, imageCount: 0 })],
  categories: [{ id: "c1", name: "Maison", slug: "maison", productCount: 5 }],
  libraryImages: [],
};
const brief = { activity: "Objets de décoration faits main à Dakar.", audience: "Jeunes actifs", styles: ["épuré"], likes: "" };

describe("création assistée : trois directions vraiment différentes", () => {
  const directions = directionsOutputSchema.parse(simulateDirections(brief, context)).directions;
  const structure = (d: (typeof directions)[number]) => compileDirection(d, context).blocks.map((b) => `${b.sectionKey}:${b.variant}`).join(" > ");

  it("trois archétypes, trois structures de page, trois typographies", () => {
    expect(new Set(directions.map((d) => d.archetype)).size).toBe(3);
    expect(new Set(directions.map(structure)).size).toBe(3);
    expect(new Set(directions.map((d) => d.typography)).size).toBeGreaterThanOrEqual(2);
    for (const d of directions) {
      const site = compileDirection(d, context);
      expect(site.blocks.length).toBeGreaterThanOrEqual(4);
      expect(site.identity.fontPair).toBe(d.typography);
      expect(site.identity.shape).toBe(d.shape);
    }
  });

  it("chacun des six archétypes se compose en sections valides avec ce catalogue", () => {
    for (const archetype of ARCHETYPE_KEYS) {
      const site = compileDirection({ ...directions[0]!, archetype }, context);
      expect(site.blocks.length, archetype).toBeGreaterThanOrEqual(3);
      expect(new Set(site.blocks.map((b) => b.id)).size).toBe(site.blocks.length);
    }
  });

  it("un archétype en double est réaffecté : jamais deux fois la même structure", () => {
    const same = distinctArchetypes([directions[0]!, { ...directions[1]!, archetype: directions[0]!.archetype }, directions[2]!]);
    expect(new Set(same.map((d) => d.archetype)).size).toBe(3);
  });

  it("n'utilise que les produits de l'entreprise, et jamais un produit sans photo en scène", () => {
    const d = { ...directions[0]!, archetype: "vitrine" as const, heroProductId: "p5", featuredProductIds: ["inconnu", "p5", "p1", "p2", "p3"] };
    const site = compileDirection(d, context);
    const hero = site.blocks.find((b) => b.sectionKey === "immersive_hero")!;
    expect((hero.params as { subjectImage?: string }).subjectImage).not.toContain("/img/5");
    const showcase = site.blocks.find((b) => b.sectionKey === "immersive_showcase")!;
    const ids = (showcase.params as { productIds: string[] }).productIds;
    expect(ids.slice(0, 3)).toEqual(["p1", "p2", "p3"]);
    expect(ids).not.toContain("p5");
    expect(ids).not.toContain("inconnu");
    expect(site.notes.join(" ")).toMatch(/pas de photo/);
    const signature = compileDirection({ ...d, archetype: "maison", signatureProductId: "p2" }, context).blocks.find((b) => b.sectionKey === "signature_product")!;
    // La pièce signature reprend le nom et la description RÉELS du produit.
    expect((signature.params as { title: string; description: string }).title).toBe("Produit 2");
    expect((signature.params as { description: string }).description).toContain("Description du produit 2");
  });

  it("retire les promesses non vérifiables et les couleurs illisibles", () => {
    const d = { ...directions[0]!, copy: { ...directions[0]!.copy, heroSubtitle: "Produits certifiés bio, livraison gratuite !", manifesto: "Plus de 1 000 avis 5 étoiles" }, palette: { primary: "#FFE9A8", accent: "#8A6A3D", background: "#222222" } };
    const site = compileDirection(d, context);
    const all = JSON.stringify(site.blocks);
    expect(all).not.toMatch(/certifi|gratuite|avis/);
    expect(site.identity.primaryColor).toBeNull();
    expect(site.identity.backgroundColor).toBeNull();
    expect(site.notes.length).toBeGreaterThanOrEqual(3);
  });
});

describe("modification par conversation : opérations limitées à la demande", () => {
  const base = compileDirection({ ...directionsOutputSchema.parse(simulateDirections(brief, context)).directions[0]!, archetype: "vitrine" }, context);
  const state: SiteState = { blocks: base.blocks, identity: base.identity, motion: { level: "immersive", mobile: "same" } };

  it("« Mets mes nouveautés en premier » : vitrine triée par date, placée après l'ouverture, rien d'autre ne change", () => {
    const edit = editOutputSchema.parse(simulateEdit("Mets mes nouveautés en premier.", state, null));
    const { state: next, changes } = applyOperations(state, edit.operations, context);
    const showcase = next.blocks.find((b) => b.sectionKey === "immersive_showcase")!;
    expect((showcase.params as { productIds: string[] }).productIds.slice(0, 3)).toEqual(["p4", "p3", "p2"]);
    expect(next.blocks[1]!.id).toBe(showcase.id);
    expect(next.identity).toEqual(state.identity);
    expect(next.blocks.find((b) => b.id === "hero")).toEqual(state.blocks.find((b) => b.id === "hero"));
    expect(changes.length).toBeGreaterThan(0);
  });

  it("« Réduis les animations sur téléphone » : seul le réglage mobile change", () => {
    const edit = simulateEdit("Réduis les animations sur téléphone", state, null);
    const { state: next } = applyOperations(state, edit.operations, context);
    expect(next.motion).toEqual({ level: "immersive", mobile: "reduced" });
    expect(next.blocks).toEqual(state.blocks);
  });

  it("« fond crème » sur la section sélectionnée : seule cette section change", () => {
    const { state: next } = applyOperations(state, simulateEdit("Remplace ce fond par une couleur crème", state, "hero").operations, context);
    expect((next.blocks[0]!.params as { backgroundColor?: string }).backgroundColor).toBe("#F4EDE1");
    expect(next.blocks.slice(1)).toEqual(state.blocks.slice(1).map((b, i) => ({ ...b, order: i + 1 })));
    expect(next.identity.backgroundColor).toBe(state.identity.backgroundColor);
  });

  it("opérations invalides écartées sans rien casser (section inconnue, produit d'une autre entreprise, texte trompeur)", () => {
    const { state: next, rejected } = applyOperations(
      state,
      [
        { op: "set_text", sectionId: "inexistante", field: "title", value: "X" },
        { op: "feature_products", sectionId: "vitrine", strategy: "list", productIds: ["autre-entreprise-1", "autre-entreprise-2"] },
        { op: "set_text", sectionId: "hero", field: "subtitle", value: "Plus de 1 000 avis clients 5 étoiles" },
      ],
      context,
    );
    expect(next).toEqual(state);
    expect(rejected).toHaveLength(3);
  });

  it("le bilan photo dit ce qui manque sans rien inventer", () => {
    const audit = auditPhotos(context);
    expect(audit.withoutImage).toEqual(["Produit 5"]);
    expect(audit.advice.join(" ")).toMatch(/logo/);
  });
});

describe("empreinte du brouillon", () => {
  it("identique quel que soit l'ordre des clés (JSONB) et sans les valeurs absentes", async () => {
    const { canonicalJson } = await import("./canonical-json");
    expect(canonicalJson({ b: 1, a: { d: undefined, c: [1, { y: 2, x: 1 }] } })).toBe(canonicalJson({ a: { c: [1, { x: 1, y: 2 }] }, b: 1 }));
  });
});

describe("filtre des promesses non vérifiables", () => {
  it("écarte les preuves et promesses, y compris devant une lettre accentuée", async () => {
    const { guardText } = await import("./compile");
    for (const claim of ["Noté 5 étoiles", "Livraison offerte", "Jusqu'à -20 % ce mois", "Plus de 1 000 avis", "Produits bio", "Qualité garantie", "Soldes d'hiver"]) {
      expect(guardText(claim, [], "test"), claim).toBeUndefined();
    }
    for (const fine of ["Céramiques tournées à la main à Ngor.", "Des bols pour tous les jours.", "Émaux inspirés de la mer."]) {
      expect(guardText(fine, [], "test"), fine).toBe(fine);
    }
  });
});
