import { afterEach, describe, expect, it } from "vitest";
import { isInternalCallAuthorized } from "./internal-secret";

describe("appels internes worker → web", () => {
  afterEach(() => { delete process.env.INTERNAL_WORKER_SECRET; });
  it("refusés sans secret configuré, sans en-tête ou avec un mauvais secret ; acceptés avec le bon", () => {
    expect(isInternalCallAuthorized("x")).toBe(false);
    process.env.INTERNAL_WORKER_SECRET = "s3cret-long";
    expect(isInternalCallAuthorized(null)).toBe(false);
    expect(isInternalCallAuthorized("s3cret-lon")).toBe(false);
    expect(isInternalCallAuthorized("s3cret-long")).toBe(true);
  });
});
