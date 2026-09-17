import { describe, expect, it } from "vitest";
import {
  VERIFICATION_TOKEN_TTL_MS,
  computeVerificationTokenExpiry,
  generateVerificationToken,
  isVerificationTokenExpired,
} from "./verification-token";

describe("generateVerificationToken", () => {
  it("génère un jeton unique à chaque appel", () => {
    const a = generateVerificationToken();
    const b = generateVerificationToken();
    expect(a).not.toBe(b);
  });

  it("génère un jeton suffisamment long pour être difficile à deviner", () => {
    expect(generateVerificationToken().length).toBeGreaterThan(30);
  });
});

describe("computeVerificationTokenExpiry / isVerificationTokenExpired", () => {
  it("expire après VERIFICATION_TOKEN_TTL_MS", () => {
    const now = new Date("2026-09-16T00:00:00.000Z");
    const expiry = computeVerificationTokenExpiry(now);
    expect(expiry.getTime() - now.getTime()).toBe(VERIFICATION_TOKEN_TTL_MS);
  });

  it("JETON EXPIRÉ : est considéré expiré après sa date d'expiration", () => {
    const expiry = new Date("2026-09-16T00:00:00.000Z");
    const later = new Date("2026-09-17T00:00:00.000Z");
    expect(isVerificationTokenExpired(expiry, later)).toBe(true);
  });

  it("n'est pas expiré avant sa date d'expiration", () => {
    const expiry = new Date("2026-09-20T00:00:00.000Z");
    const now = new Date("2026-09-16T00:00:00.000Z");
    expect(isVerificationTokenExpired(expiry, now)).toBe(false);
  });

  it("un jeton sans date d'expiration est considéré expiré (fail-safe)", () => {
    expect(isVerificationTokenExpired(null)).toBe(true);
  });
});
