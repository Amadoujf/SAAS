import { describe, expect, it } from "vitest";
import { compileDirection } from "./compile";
import { applyOperations, type SiteState } from "./operations";
import { auditPhotos } from "./photo-audit";
import { directionsOutputSchema, editOutputSchema } from "./schemas";
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
  categories: [{ id: "c1", name: "Maison", productCount: 5 }],
  libraryImages: [],
};
const brief = { activity: "Objets de décoration faits main à Dakar.", audience: "Jeunes actifs", styles: ["épuré"], likes: "" };

describe("création assistée : compilation d'une direction", () => {
  const directions = directionsOutputSchema.parse(simulateDirections(brief, context)).directions;

  it("trois directions distinctes, chacune compilée en sections valides du registre", () => {
    expect(new Set(directions.map((d) => d.style)).size).toBe(3);
    for (const d of directions) {
      const site = compileDirection(d, context);
      expect(site.blocks[0]!.sectionKey).toBe("immersive_hero");
      expect(site.blocks.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("n'utilise que les produits de l'entreprise, et jamais un produit sans photo en scène", () => {
    const d = { ...directions[0]!, hero: { ...directions[0]!.hero, subjectProductId: "p5" }, showcase: { ...directions[0]!.showcase, productIds: ["inconnu", "p5", "p1", "p2", "p3"] } };
    const site = compileDirection(d, context);
    const hero = site.blocks.find((b) => b.sectionKey === "immersive_hero")!;
    expect((hero.params as { subjectImage?: string }).subjectImage).toBeUndefined();
    expect(hero.variant).toBe("centered");
    const showcase = site.blocks.find((b) => b.sectionKey === "immersive_showcase")!;
    expect((showcase.params as { productIds: string[] }).productIds).toEqual(["p1", "p2", "p3"]);
    expect(site.notes.join(" ")).toMatch(/pas de photo/);
  });

  it("retire les promesses non vérifiables et les couleurs illisibles", () => {
    const d = { ...directions[0]!, hero: { ...directions[0]!.hero, subtitle: "Produits certifiés bio, livraison gratuite !" }, palette: { primary: "#FFE9A8", accent: "#8A6A3D", background: "#222222" } };
    const site = compileDirection(d, context);
    const hero = site.blocks[0]!;
    expect((hero.params as { subtitle?: string }).subtitle).toBeUndefined();
    expect(site.identity.primaryColor).toBeNull();
    expect(site.identity.backgroundColor).toBeNull();
    expect(site.notes.length).toBeGreaterThanOrEqual(3);
  });
});

describe("modification par conversation : opérations limitées à la demande", () => {
  const base = compileDirection(directionsOutputSchema.parse(simulateDirections(brief, context)).directions[0]!, context);
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
