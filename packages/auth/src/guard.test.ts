import { describe, expect, it } from "vitest";
import { assertPermission, hasPermission, PermissionDeniedError } from "./guard";
import { SYSTEM_ROLE_PERMISSIONS } from "./permissions";

describe("hasPermission", () => {
  it("autorise une permission présente dans la liste", () => {
    expect(hasPermission(["orders.view", "orders.update_status"], "orders.view")).toBe(true);
  });

  it("refuse une permission absente", () => {
    expect(hasPermission(["orders.view"], "settings.domain")).toBe(false);
  });
});

describe("assertPermission", () => {
  it("ne lève pas si la permission est présente", () => {
    expect(() => assertPermission(["invoices.view"], "invoices.view")).not.toThrow();
  });

  it("lève une PermissionDeniedError si la permission est absente", () => {
    expect(() => assertPermission([], "settings.domain")).toThrow(PermissionDeniedError);
  });
});

describe("SYSTEM_ROLE_PERMISSIONS", () => {
  it("le rôle OWNER a toutes les permissions", () => {
    expect(SYSTEM_ROLE_PERMISSIONS.OWNER.length).toBeGreaterThan(20);
  });

  it("le rôle DELIVERY_STAFF n'a pas de permission de configuration des paiements", () => {
    expect(hasPermission(SYSTEM_ROLE_PERMISSIONS.DELIVERY_STAFF, "payments.configure")).toBe(false);
  });

  it("le rôle MANAGER n'a pas la permission settings.domain (réservée au propriétaire)", () => {
    expect(hasPermission(SYSTEM_ROLE_PERMISSIONS.MANAGER, "settings.domain")).toBe(false);
  });
});
