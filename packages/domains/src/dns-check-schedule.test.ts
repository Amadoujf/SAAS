import { describe, expect, it } from "vitest";
import { MAX_QUICK_ATTEMPTS, nextDnsCheckDelayMs, shouldContinueQuickRetries } from "./dns-check-schedule";

describe("nextDnsCheckDelayMs", () => {
  it("croît à chaque tentative", () => {
    const delays = [1, 2, 3, 4, 5, 6].map(nextDnsCheckDelayMs);
    for (let i = 1; i < delays.length; i += 1) {
      expect(delays[i]).toBeGreaterThan(delays[i - 1]!);
    }
  });

  it("plafonne au-delà des délais définis", () => {
    expect(nextDnsCheckDelayMs(50)).toBe(nextDnsCheckDelayMs(20));
  });
});

describe("shouldContinueQuickRetries", () => {
  it("continue tant que la limite n'est pas atteinte", () => {
    expect(shouldContinueQuickRetries(1)).toBe(true);
    expect(shouldContinueQuickRetries(MAX_QUICK_ATTEMPTS - 1)).toBe(true);
  });

  it("ARRÊTE LES VÉRIFICATIONS INUTILES : s'arrête une fois la limite atteinte", () => {
    expect(shouldContinueQuickRetries(MAX_QUICK_ATTEMPTS)).toBe(false);
    expect(shouldContinueQuickRetries(MAX_QUICK_ATTEMPTS + 5)).toBe(false);
  });
});
