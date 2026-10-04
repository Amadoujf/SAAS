import { describe, expect, it } from "vitest";
import { applyBranding, defaultHomeContent, homeContentSchema, parseHomeContent, validateBrandColor } from "./home-content";
import { SUNU_MARCHE_TOKENS } from "./commerce-templates";

const slide = { id: "a", imageUrl: "/demo-templates/sunu-marche/hero-objets.webp", title: "Titre" };

describe("Contenus de la boutique — validation", () => {
  it("refuse les liens dangereux (javascript:, //hôte externe)", () => {
    for (const bad of ["javascript:alert(1)", "//evil.example/x.png", "http://non-securise.sn/a.png"]) {
      expect(homeContentSchema.safeParse({ hero: { slides: [{ ...slide, imageUrl: bad }] } }).success).toBe(false);
      expect(homeContentSchema.safeParse({ hero: { slides: [{ ...slide, ctaHref: bad }] } }).success).toBe(false);
    }
    expect(homeContentSchema.safeParse({ hero: { slides: [{ ...slide, ctaHref: "/catalogue?categorie=mode" }] } }).success).toBe(true);
    expect(homeContentSchema.safeParse({ hero: { slides: [{ ...slide, imageUrl: "https://cdn.exemple.sn/a.webp" }] } }).success).toBe(true);
  });

  it("borne les quantités : 1 à 6 diapositives, 12 produits, 4 collections", () => {
    expect(homeContentSchema.safeParse({ hero: { slides: [] } }).success).toBe(false);
    expect(homeContentSchema.safeParse({ hero: { slides: Array.from({ length: 7 }, (_, i) => ({ ...slide, id: `s${i}` })) } }).success).toBe(false);
    expect(homeContentSchema.safeParse({ hero: { slides: [slide] }, featuredProductIds: Array.from({ length: 13 }, (_, i) => `p${i}`) }).success).toBe(false);
  });

  it("un contenu enregistré invalide ne casse jamais la boutique", () => {
    expect(parseHomeContent({ hero: "cassé" }, "Ma Boutique")).toEqual(defaultHomeContent("Ma Boutique"));
    expect(defaultHomeContent("Ma Boutique").hero.slides[0]!.imageUrl).toBeNull(); // jamais de photo de démonstration pour une vraie entreprise
  });

  it("couleur principale : lisible sous un texte blanc (WCAG AA)", () => {
    expect(validateBrandColor("#10224F")).toBeNull();
    expect(validateBrandColor("#F5E663")).toMatch(/trop claire/);
    expect(validateBrandColor("bleu")).toMatch(/invalide/);
  });

  it("les couleurs de l'entreprise remplacent celles du template", () => {
    const t = applyBranding(SUNU_MARCHE_TOKENS, { primaryColor: "#7A1F2B", accentColor: "#0B6E4F" });
    expect(t.colors.primary).toBe("#7A1F2B");
    expect(t.colors.accentPrimary).toBe("#0B6E4F");
    expect(applyBranding(SUNU_MARCHE_TOKENS, { primaryColor: "rouge" }).colors.primary).toBe(SUNU_MARCHE_TOKENS.colors.primary);
  });
});
