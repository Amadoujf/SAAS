import { describe, expect, it } from "vitest";
import { domainToASCII } from "node:url";
import { detectHomographRisk } from "./homograph-detection";

describe("detectHomographRisk", () => {
  it("n'alerte jamais sur un domaine purement ASCII", () => {
    expect(detectHomographRisk("boutiquefatou.com").risky).toBe(false);
  });

  it("n'alerte pas sur un domaine IDN à UNE seule écriture (arabe, cyrillique, etc.)", () => {
    const cyrillicOnly = domainToASCII("сайт.com"); // "site" en cyrillique, une seule écriture.
    expect(detectHomographRisk(cyrillicOnly).risky).toBe(false);
  });

  it("TENTATIVE D'HOMOGRAPHE : alerte quand un label mélange latin et cyrillique", () => {
    // "а" (U+0430, cyrillique) remplaçant le "a" latin dans "apple".
    const mixed = domainToASCII("аpple.com");
    const result = detectHomographRisk(mixed);
    expect(result.risky).toBe(true);
    expect(result.reason).toMatch(/mélange/);
  });
});
