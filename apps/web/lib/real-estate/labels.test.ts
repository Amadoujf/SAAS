import { describe, expect, it } from "vitest";
import { formatPropertyPrice, propertyFacts } from "./labels";

describe("libellés immobilier", () => {
  it("affiche le prix selon l'unité : vente, loyer mensuel, sur demande", () => {
    expect(formatPropertyPrice(850_000_000, "total")).toBe("850 000 000 FCFA");
    expect(formatPropertyPrice(450_000, "per_month")).toBe("450 000 FCFA / mois");
    expect(formatPropertyPrice(null, "on_request")).toBe("Prix sur demande");
    expect(formatPropertyPrice(10, "on_request")).toBe("Prix sur demande");
  });

  it("résume les caractéristiques, sans chambres pour un terrain", () => {
    expect(propertyFacts({ bedrooms: 5, bathrooms: 4, surfaceM2: 420, propertyType: "villa" })).toBe("5 ch. · 4 sdb · 420 m²");
    expect(propertyFacts({ bedrooms: null, bathrooms: null, surfaceM2: null, landSurfaceM2: 500, propertyType: "land" })).toBe("500 m² de terrain");
  });
});
