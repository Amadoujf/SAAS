import { afterEach, describe, expect, it } from "vitest";
import { platformAiCapXOF, platformCapReached } from "./budget";

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

  it("valeur positive lue en FCFA entiers ; atteint dès que la dépense l'égale", () => {
    process.env.AI_PLATFORM_MONTHLY_CAP_XOF = "15000.9";
    expect(platformAiCapXOF()).toBe(15_000);
    expect(platformCapReached(14_999, 15_000)).toBe(false);
    expect(platformCapReached(15_000, 15_000)).toBe(true);
    expect(platformCapReached(1_000_000, null)).toBe(false);
  });
});
