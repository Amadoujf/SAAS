import { describe, expect, it } from "vitest";
import { DEFAULT_JOB_OPTIONS, QUEUE_NAMES } from "./definitions";

describe("QUEUE_NAMES", () => {
  it("n'a aucun nom de file dupliqué", () => {
    const values = Object.values(QUEUE_NAMES);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("DEFAULT_JOB_OPTIONS", () => {
  it("configure un backoff exponentiel avec au moins 3 tentatives", () => {
    expect(DEFAULT_JOB_OPTIONS.attempts).toBeGreaterThanOrEqual(3);
    expect(DEFAULT_JOB_OPTIONS.backoff.type).toBe("exponential");
  });
});
