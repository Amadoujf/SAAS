import { describe, expect, it } from "vitest";
import { failedCallCharge } from "./charge";

describe("coût imputé d'une génération en échec", () => {
  const base = { receivedCostXOF: null, billing: null, knownCostXOF: 0, reservedXOF: 135 } as const;

  it("réponse reçue puis échec de l'étape suivante : coût réel", () => {
    expect(failedCallCharge({ ...base, receivedCostXOF: 42 })).toBe(42);
  });
  it("refus ou réponse incomplète : jetons connus", () => {
    expect(failedCallCharge({ ...base, billing: "known", knownCostXOF: 17 })).toBe(17);
  });
  it("erreur de l'API (clé, surcharge, quota) : rien", () => {
    expect(failedCallCharge({ ...base, billing: "none" })).toBe(0);
  });
  it("coupure, réponse illisible ou erreur inattendue : maximum réservé", () => {
    expect(failedCallCharge({ ...base, billing: "unknown" })).toBe(135);
    expect(failedCallCharge(base)).toBe(135);
  });
});
