import { describe, expect, it } from "vitest";
import {
  generateSubdomainAlternatives,
  normalizeSubdomain,
  suggestSubdomainFromName,
  validateSubdomainFormat,
} from "./subdomain-validation";

describe("normalizeSubdomain", () => {
  it("met en minuscules, remplace espaces/underscores par des tirets, retire les accents", () => {
    expect(normalizeSubdomain("Boutique Fatou_Diop")).toBe("boutique-fatou-diop");
    expect(normalizeSubdomain("Café Écolo")).toBe("cafe-ecolo");
  });

  it("retire les caractères hors [a-z0-9-]", () => {
    expect(normalizeSubdomain("boutique!!fatou@#2026")).toBe("boutiquefatou2026");
  });
});

describe("validateSubdomainFormat", () => {
  it("accepte un sous-domaine valide", () => {
    expect(validateSubdomainFormat("boutique-fatou").valid).toBe(true);
  });

  it("rejette les majuscules ou caractères invalides", () => {
    expect(validateSubdomainFormat("Boutique").valid).toBe(false);
    expect(validateSubdomainFormat("boutique_fatou").valid).toBe(false);
  });

  it("rejette un tiret au début ou à la fin", () => {
    expect(validateSubdomainFormat("-boutique").issues).toContain("leading_or_trailing_hyphen");
    expect(validateSubdomainFormat("boutique-").issues).toContain("leading_or_trailing_hyphen");
  });

  it("rejette une longueur trop courte ou trop longue", () => {
    expect(validateSubdomainFormat("ab").issues).toContain("too_short");
    expect(validateSubdomainFormat("a".repeat(64)).issues).toContain("too_long");
  });

  it("TERMES RÉSERVÉS : bloque admin/api/dashboard/etc.", () => {
    for (const reserved of ["admin", "api", "dashboard", "support", "billing", "security"]) {
      expect(validateSubdomainFormat(reserved).issues).toContain("reserved");
    }
  });

  it("rapporte plusieurs problèmes à la fois", () => {
    const result = validateSubdomainFormat("-Admin_");
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(1);
  });
});

describe("suggestSubdomainFromName", () => {
  it("normalise le nom de l'entreprise en sous-domaine candidat", () => {
    expect(suggestSubdomainFromName("Boutique Fatou")).toBe("boutique-fatou");
  });

  it("garantit une longueur minimale même pour un nom très court", () => {
    const suggestion = suggestSubdomainFromName("Ai");
    expect(validateSubdomainFormat(suggestion).valid).toBe(true);
  });
});

describe("generateSubdomainAlternatives", () => {
  it("génère des variantes numérotées distinctes", () => {
    const alternatives = generateSubdomainAlternatives("boutique-fatou", 3);
    expect(alternatives).toEqual(["boutique-fatou-2", "boutique-fatou-3", "boutique-fatou-4"]);
  });
});
