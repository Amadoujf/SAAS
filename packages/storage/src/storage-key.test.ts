import { describe, expect, it } from "vitest";
import { StorageIsolationError, assertOwnedKey, buildStorageKey, tenantPrefix } from "./storage-key";

const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";

describe("tenantPrefix", () => {
  it("construit un préfixe stable pour un tenant", () => {
    expect(tenantPrefix(TENANT_A)).toBe(`tenants/${TENANT_A}`);
  });

  it("refuse un tenantId vide", () => {
    expect(() => tenantPrefix("")).toThrow(StorageIsolationError);
  });
});

describe("buildStorageKey", () => {
  it("construit une clé sous le préfixe du tenant", () => {
    expect(buildStorageKey(TENANT_A, "originals", "photo.jpg")).toBe(
      `tenants/${TENANT_A}/originals/photo.jpg`,
    );
  });

  it("refuse un segment '..' (tentative de remontée de chemin)", () => {
    expect(() => buildStorageKey(TENANT_A, "..", "etc", "passwd")).toThrow(StorageIsolationError);
  });

  it("refuse un segment contenant un '/' (tentative d'injection de chemin)", () => {
    expect(() => buildStorageKey(TENANT_A, `${TENANT_B}/originals`)).toThrow(StorageIsolationError);
  });

  it("refuse un appel sans aucun segment", () => {
    expect(() => buildStorageKey(TENANT_A)).toThrow(StorageIsolationError);
  });

  it("ignore les segments vides sans planter", () => {
    expect(buildStorageKey(TENANT_A, "", "photo.jpg")).toBe(`tenants/${TENANT_A}/photo.jpg`);
  });
});

describe("assertOwnedKey — ISOLATION ENTRE TENANTS", () => {
  it("accepte une clé appartenant réellement au tenant", () => {
    expect(() => assertOwnedKey(TENANT_A, `tenants/${TENANT_A}/originals/x.jpg`)).not.toThrow();
  });

  it("refuse une clé appartenant à un AUTRE tenant", () => {
    expect(() => assertOwnedKey(TENANT_A, `tenants/${TENANT_B}/originals/x.jpg`)).toThrow(
      StorageIsolationError,
    );
  });

  it("refuse un id de tenant qui n'est qu'un préfixe littéral d'un autre (ex. 'abc' vs 'abcdef')", () => {
    expect(() => assertOwnedKey("abc", "tenants/abcdef/originals/x.jpg")).toThrow(StorageIsolationError);
  });

  it("refuse une clé contenant '..' même si le préfixe correspond", () => {
    expect(() =>
      assertOwnedKey(TENANT_A, `tenants/${TENANT_A}/../${TENANT_B}/originals/x.jpg`),
    ).toThrow(StorageIsolationError);
  });

  it("refuse une clé totalement étrangère (racine différente)", () => {
    expect(() => assertOwnedKey(TENANT_A, "public/x.jpg")).toThrow(StorageIsolationError);
  });
});
