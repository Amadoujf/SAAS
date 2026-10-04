import { describe, expect, it } from "vitest";
import { readBodyWithLimit } from "./read-body-limit";

describe("lecture de corps de requête bornée", () => {
  it("rend les octets sous la limite, null au-delà (lecture interrompue)", async () => {
    const small = new Request("http://x", { method: "PUT", body: "abcd" });
    expect(new TextDecoder().decode((await readBodyWithLimit(small, 4))!)).toBe("abcd");
    const big = new Request("http://x", { method: "PUT", body: "x".repeat(5000) });
    expect(await readBodyWithLimit(big, 1024)).toBeNull();
  });
});
