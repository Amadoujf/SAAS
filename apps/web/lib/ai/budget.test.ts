import { afterEach, describe, expect, it } from "vitest";
import { platformAiCapXOF } from "./budget";
import { worstCaseCostXOF } from "./cost";

describe("plafond IA de la plateforme", () => {
  afterEach(() => {
    delete process.env.AI_PLATFORM_MONTHLY_CAP_XOF;
  });

  it("absent, nul, négatif ou illisible : aucun plafond global", () => {
    for (const value of [undefined, "", "0", "-5", "abc"]) {
      if (value === undefined) delete process.env.AI_PLATFORM_MONTHLY_CAP_XOF;
      else process.env.AI_PLATFORM_MONTHLY_CAP_XOF = value;
      expect(platformAiCapXOF()).toBeNull();
    }
  });

  it("valeur positive lue en FCFA entiers", () => {
    process.env.AI_PLATFORM_MONTHLY_CAP_XOF = "15000.9";
    expect(platformAiCapXOF()).toBe(15_000);
  });

  it("réservation maximale par appel : Sonnet 5.5 environ deux fois moins qu'Opus 5.5", () => {
    // 30 000 jetons en entrée + 16 000 en sortie, au taux par défaut de 610 FCFA/$.
    expect(worstCaseCostXOF("claude-sonnet-5-5")).toBe(135);
    expect(worstCaseCostXOF("claude-opus-5-5")).toBe(269);
  });
});
