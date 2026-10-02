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
  categories: [{ id: "c1", name: "Maison", slug: "maison", productCount: 5, hasVisual: true }],
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

  it("boutique photographiée : le trio éditorial, sculptural, studio — cadres, styles et palettes distincts", () => {
    expect(directions.map((d) => d.archetype)).toEqual(["editorial", "sculptural", "studio"]);
    const sites = directions.map((d) => compileDirection(d, context));
    expect(sites.map((s) => s.identity.frame)).toEqual(["editorial", "sculptural", "studio"]);
    expect(new Set(sites.map((s) => s.identity.style)).size).toBe(3);
    expect(new Set(directions.map((d) => d.palette.primary)).size).toBe(3);
    expect(sites.map((s) => `${s.blocks[0]!.sectionKey}:${s.blocks[0]!.variant}`)).toEqual(["collection_hero:cover", "collection_hero:stage", "collection_hero:wordmark"]);
    for (const site of sites) {
      const lineup = site.blocks.find((b) => b.sectionKey === "product_lineup");
      expect(lineup, "sélection de pièces").toBeTruthy();
      expect(JSON.stringify(site.blocks)).not.toContain("/img/5");
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

describe("assistant : nouvelles capacités, toujours limitées à la demande", () => {
  const base = compileDirection({ ...directionsOutputSchema.parse(simulateDirections(brief, context)).directions[0]!, archetype: "vitrine" }, context);
  const state: SiteState = { blocks: base.blocks, identity: base.identity, motion: { level: "dynamic", mobile: "same" } };

  it("ajoute une galerie composée avec les photos de l'entreprise, sans toucher au reste", () => {
    const { state: next, changes } = applyOperations(state, [{ op: "add_section", kind: "gallery", variant: "", position: "after", relativeTo: "hero", title: "", text: "", productIds: [] }], context);
    expect(next.blocks).toHaveLength(state.blocks.length + 1);
    const added = next.blocks[1]!;
    expect(added.sectionKey).toBe("gallery");
    const urls = (added.params as { images: { url: string }[] }).images.map((i) => i.url);
    expect(urls.every((u) => context.products.some((p) => p.imageUrl === u))).toBe(true);
    expect(next.blocks.filter((b) => b.id !== added.id).map(({ order: _o, ...b }) => b)).toEqual(state.blocks.map(({ order: _o, ...b }) => b));
    expect(changes[0]).toMatch(/ajoutée/);
  });

  it("refuse un manifeste sans phrase : rien n'est inventé pour le remplir", () => {
    const { state: next, rejected } = applyOperations(state, [{ op: "add_section", kind: "manifesto", variant: "", position: "last", relativeTo: "", title: "", text: "", productIds: [] }], context);
    expect(next.blocks).toHaveLength(state.blocks.length);
    expect(rejected).toHaveLength(1);
  });

  it("typographie, formes, espacement et alignement : seule la cible change", () => {
    const { state: next } = applyOperations(
      state,
      [
        { op: "set_typography", fontPair: "couture" },
        { op: "set_shape", shape: "round" },
        { op: "set_spacing", sectionId: "vitrine", density: "airy" },
        { op: "set_alignment", sectionId: "cloture", align: "center" },
      ],
      context,
    );
    expect(next.identity).toEqual({ ...state.identity, fontPair: "couture", shape: "round" });
    expect(next.blocks.find((b) => b.id === "vitrine")!.spacingOverride?.desktop?.paddingY).toBe("160px");
    expect(next.blocks.find((b) => b.id === "cloture")!.styleOverride?.textAlign).toBe("center");
    expect(next.blocks.find((b) => b.id === "hero")).toEqual(state.blocks.find((b) => b.id === "hero"));
  });

  it("mode simulé : « Ajoute une galerie » et un texte entre guillemets deviennent des opérations valides", () => {
    const add = editOutputSchema.parse(simulateEdit("Ajoute une galerie de mes produits", state, null));
    expect(add.operations[0]).toMatchObject({ op: "add_section", kind: "gallery" });
    const rename = editOutputSchema.parse(simulateEdit("Mets le titre « Nos pièces du moment »", state, "vitrine"));
    const { state: next } = applyOperations(state, rename.operations, context);
    expect((next.blocks.find((b) => b.id === "vitrine")!.params as { title: string }).title).toBe("Nos pièces du moment");
  });
});

describe("création assistée : restaurant (la carte tient lieu de catalogue)", () => {
  const dish = (i: number, over: Partial<CatalogProduct> = {}) => product(i, { slug: "", name: `Plat ${i}`, category: i < 3 ? "Grillades" : "Plats du jour", priceLabel: `${3000 + i * 500} FCFA`, ...over });
  const resto: SiteAiContext = {
    tenantName: "Braise & Bissap",
    sectorKey: "restaurant",
    mode: "restaurant",
    logoUrl: null,
    products: [dish(1), dish(2), dish(3), dish(4), dish(5), dish(6, { imageUrl: null, imageAlt: null, imageWidth: null, imageCount: 0 })],
    categories: [{ id: "s1", name: "Grillades", slug: "s1", productCount: 2, hasVisual: true }, { id: "s2", name: "Plats du jour", slug: "s2", productCount: 4, hasVisual: true }],
    libraryImages: [],
  };
  const restoBrief = { activity: "Dibiterie à Ouakam : grillades au feu de bois et plats du jour.", audience: "Familles et bureaux", styles: ["chaleureux"], likes: "" };
  const directions = directionsOutputSchema.parse(simulateDirections(restoBrief, resto)).directions;
  const hrefs = (params: unknown): string[] => JSON.stringify(params).match(/"(?:[a-zA-Z]*Href|href)":"([^"]+)"/g)?.map((m) => m.split(":")[1]!.replace(/"/g, "")) ?? [];

  it("les six archétypes se composent sans section du catalogue boutique (proposition métier : style Braise)", () => {
    for (const archetype of ARCHETYPE_KEYS) {
      const site = compileDirection({ ...directions[0]!, archetype }, resto);
      expect(site.blocks.length, archetype).toBeGreaterThanOrEqual(2);
      expect(site.identity.style).toBe("braise");
      for (const b of site.blocks) {
        expect(["featured_products", "new_arrivals", "categories", "catalog_search"], `${archetype} ${b.sectionKey}`).not.toContain(b.sectionKey);
        for (const h of hrefs(b.params)) expect(["/carte", "/reserver-une-table"], `${archetype} ${b.sectionKey}`).toContain(h);
        if (b.sectionKey === "immersive_showcase") expect((b.params as { source: string }).source).toBe("manual");
      }
    }
  });

  it("le carrousel reprend le nom et le prix de la carte, sans plat sans photo", () => {
    const site = compileDirection({ ...directions[0]!, archetype: "vitrine" }, resto);
    const showcase = site.blocks.find((b) => b.sectionKey === "immersive_showcase")!;
    const items = (showcase.params as { items: { title: string; subtitle: string }[] }).items;
    expect(items.map((i) => i.title)).not.toContain("Plat 6");
    expect(items.find((i) => i.title === "Plat 1")?.subtitle).toBe("3500 FCFA · Grillades");
  });

  it("trois propositions de styles différents, dont le style métier Braise", () => {
    const styles = directions.map((d) => compileDirection(d, resto).identity.style);
    expect(new Set(styles).size).toBe(3);
    expect(styles).toContain("braise");
    expect(styles).not.toContain("piste");
  });

  it("conversation : le client peut changer de style (sauf celui d'un autre métier), la mise en avant choisit des plats", () => {
    const site = compileDirection({ ...directions[0]!, archetype: "vitrine" }, resto);
    const state: SiteState = { blocks: site.blocks, identity: site.identity, motion: site.motion };
    const style = applyOperations(state, [{ op: "set_style", style: "luxury-minimal" }], resto);
    expect(style.state.identity.style).toBe("luxury-minimal");
    const other = applyOperations(state, [{ op: "set_style", style: "piste" }], resto);
    expect(other.state.identity.style).toBe("braise");
    expect(other.rejected[0]).toMatch(/autre métier/);
    const showcase = site.blocks.find((b) => b.sectionKey === "immersive_showcase")!;
    const pick = applyOperations(state, [{ op: "feature_products", sectionId: showcase.id, strategy: "list", productIds: ["p4", "p3", "p2", "p6"] }], resto);
    const items = (pick.state.blocks.find((b) => b.id === showcase.id)!.params as { items: { title: string }[] }).items;
    expect(items.map((i) => i.title)).toEqual(["Plat 4", "Plat 3", "Plat 2"]);
  });
});

describe("création assistée : concession automobile (le stock tient lieu de catalogue)", () => {
  const car = (i: number, over: Partial<CatalogProduct> = {}) => product(i, { slug: `vehicule-${i}`, name: `Véhicule ${i}`, category: i < 3 ? "SUV" : "Berlines", priceLabel: `${10_000_000 + i} FCFA`, ...over });
  const auto: SiteAiContext = {
    tenantName: "Baobab Motors",
    sectorKey: "automobile",
    mode: "automobile",
    logoUrl: null,
    products: [car(1), car(2), car(3), car(4), car(5), car(6, { imageUrl: null, imageAlt: null, imageWidth: null, imageCount: 0 })],
    categories: [{ id: "suv", name: "SUV", slug: "suv", productCount: 2, hasVisual: true }, { id: "berline", name: "Berlines", slug: "berline", productCount: 4, hasVisual: true }],
    libraryImages: [],
  };
  const brief = { activity: "Concession à Dakar : occasions contrôlées et importation sur commande.", audience: "Familles et entreprises", styles: ["sobre"], likes: "" };
  const directions = directionsOutputSchema.parse(simulateDirections(brief, auto)).directions;
  const hrefs = (params: unknown): string[] => JSON.stringify(params).match(/"(?:[a-zA-Z]*Href|href)":"([^"]+)"/g)?.map((m) => m.split(":")[1]!.replace(/"/g, "")) ?? [];

  it("les six archétypes se composent (proposition métier : style Piste) avec des liens vers le stock ou les fiches", () => {
    for (const archetype of ARCHETYPE_KEYS) {
      const site = compileDirection({ ...directions[0]!, archetype }, auto);
      expect(site.blocks.length, archetype).toBeGreaterThanOrEqual(2);
      expect(site.identity.style).toBe("piste");
      for (const b of site.blocks) {
        expect(["featured_products", "new_arrivals", "categories", "catalog_search"], `${archetype} ${b.sectionKey}`).not.toContain(b.sectionKey);
        for (const h of hrefs(b.params)) expect(h === "/vehicules" || h === "/vehicules?stock=arrivage" || /^\/vehicules\/vehicule-\d$/.test(h), `${archetype} ${b.sectionKey} ${h}`).toBe(true);
      }
    }
  });

  it("le carrousel mène à la fiche du véhicule et garde le prix réel", () => {
    const site = compileDirection({ ...directions[0]!, archetype: "vitrine" }, auto);
    const items = (site.blocks.find((b) => b.sectionKey === "immersive_showcase")!.params as { items: { title: string; subtitle: string; href: string }[] }).items;
    expect(items.map((i) => i.title)).not.toContain("Véhicule 6");
    const first = items.find((i) => i.title === "Véhicule 1")!;
    expect(first.href).toBe("/vehicules/vehicule-1");
    expect(first.subtitle).toBe("10000001 FCFA · SUV");
  });

  it("trois propositions de styles différents, dont le style métier Piste ; un style d'un autre métier est remplacé", () => {
    const styles = directions.map((d) => compileDirection(d, auto).identity.style);
    expect(new Set(styles).size).toBe(3);
    expect(styles).toContain("piste");
    expect(compileDirection({ ...directions[1]!, style: "braise" }, auto).identity.style).toBe("piste");
  });

  it("conversation : le client peut changer de style, la mise en avant garde les fiches", () => {
    const site = compileDirection({ ...directions[0]!, archetype: "vitrine" }, auto);
    const state: SiteState = { blocks: site.blocks, identity: site.identity, motion: site.motion };
    const style = applyOperations(state, [{ op: "set_style", style: "luxury-minimal" }], auto);
    expect(style.state.identity.style).toBe("luxury-minimal");
    expect(applyOperations(state, [{ op: "set_style", style: "braise" }], auto).rejected[0]).toMatch(/autre métier/);
    const showcase = site.blocks.find((b) => b.sectionKey === "immersive_showcase")!;
    const pick = applyOperations(state, [{ op: "feature_products", sectionId: showcase.id, strategy: "list", productIds: ["p4", "p3", "p2"] }], auto);
    const items = (pick.state.blocks.find((b) => b.id === showcase.id)!.params as { items: { href: string }[] }).items;
    expect(items.map((i) => i.href)).toEqual(["/vehicules/vehicule-4", "/vehicules/vehicule-3", "/vehicules/vehicule-2"]);
  });
});

describe("produit principal de l'ouverture « stage »", () => {
  const directions = directionsOutputSchema.parse(simulateDirections(brief, context)).directions;
  const sculptural = directions.find((d) => d.archetype === "sculptural")!;
  const hero = (ctx: SiteAiContext, d = sculptural) => compileDirection(d, ctx).blocks.find((b) => b.sectionKey === "collection_hero")!.params as { productId?: string; ctaHref?: string; secondaryCtaHref?: string; media: { url: string } };

  it("vrai site : le produit choisi par l'IA, et le bouton ouvre SA fiche", () => {
    const p = hero(context, { ...sculptural, heroProductId: "p3" });
    expect(p.productId).toBe("p3");
    expect(p.ctaHref).toBe("/p/produit-3");
    expect(p.media.url).toBe("/img/3.webp");
    expect(p.secondaryCtaHref).toBe("/catalogue");
  });

  it("démonstration : le produit imposé pour CETTE direction l'emporte, pas pour les autres", () => {
    const demo = { ...context, demoHeroProducts: { sculptural: "p4" } };
    expect(hero(demo, { ...sculptural, heroProductId: "p3" }).productId).toBe("p4");
    const editorial = directions.find((d) => d.archetype === "editorial")!;
    const cover = compileDirection({ ...editorial, heroProductId: "p2" }, demo).blocks[0]!.params as { productId?: string };
    expect(cover.productId).toBe("p2");
  });

  it("aucun choix, ou produit sans photo : repli sur un produit publié photographié", () => {
    const none = hero(context, { ...sculptural, heroProductId: "" });
    expect(none.productId).toMatch(/^p[1-4]$/);
    expect(hero(context, { ...sculptural, heroProductId: "p5" }).productId).not.toBe("p5");
  });
});
