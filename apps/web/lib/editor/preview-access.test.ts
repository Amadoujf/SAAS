import { describe, expect, it } from "vitest";
import { canAccessDraftPreview, type PreviewAccessSubject } from "./preview-access";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

function subject(overrides: Partial<PreviewAccessSubject> = {}): PreviewAccessSubject {
  return { userId: "user-1", isSuperAdmin: false, memberships: [], ...overrides };
}

describe("canAccessDraftPreview", () => {
  it("autorise un Super Admin même sans aucune adhésion", () => {
    expect(canAccessDraftPreview(subject({ isSuperAdmin: true }), TENANT_A)).toBe(true);
  });

  it("autorise une adhésion ACTIVE avec la permission site.edit", () => {
    const s = subject({
      memberships: [{ tenantId: TENANT_A, status: "ACTIVE", permissions: ["site.edit"] }],
    });
    expect(canAccessDraftPreview(s, TENANT_A)).toBe(true);
  });

  it("autorise aussi une adhésion ACTIVE avec SEULEMENT la permission site.preview (l'une ou l'autre suffit)", () => {
    const s = subject({
      memberships: [{ tenantId: TENANT_A, status: "ACTIVE", permissions: ["site.preview"] }],
    });
    expect(canAccessDraftPreview(s, TENANT_A)).toBe(true);
  });

  it("refuse une adhésion ACTIVE SANS la permission requise", () => {
    const s = subject({
      memberships: [{ tenantId: TENANT_A, status: "ACTIVE", permissions: ["products.view"] }],
    });
    expect(canAccessDraftPreview(s, TENANT_A)).toBe(false);
  });

  it("refuse une adhésion INVITED (pas encore active), même avec la permission", () => {
    const s = subject({
      memberships: [{ tenantId: TENANT_A, status: "INVITED", permissions: ["site.edit"] }],
    });
    expect(canAccessDraftPreview(s, TENANT_A)).toBe(false);
  });

  it("refuse une adhésion SUSPENDED, même avec la permission", () => {
    const s = subject({
      memberships: [{ tenantId: TENANT_A, status: "SUSPENDED", permissions: ["site.edit"] }],
    });
    expect(canAccessDraftPreview(s, TENANT_A)).toBe(false);
  });

  it("refuse un utilisateur sans aucune adhésion", () => {
    expect(canAccessDraftPreview(subject(), TENANT_A)).toBe(false);
  });

  it("ISOLATION TENANT : une adhésion ACTIVE + la permission pour le tenant A n'autorise jamais le tenant B", () => {
    const s = subject({
      memberships: [{ tenantId: TENANT_A, status: "ACTIVE", permissions: ["site.edit"] }],
    });
    expect(canAccessDraftPreview(s, TENANT_B)).toBe(false);
  });

  it("autorise seulement le tenant correspondant parmi plusieurs adhésions", () => {
    const s = subject({
      memberships: [
        { tenantId: TENANT_A, status: "ACTIVE", permissions: ["site.edit"] },
        { tenantId: TENANT_B, status: "ACTIVE", permissions: [] },
      ],
    });
    expect(canAccessDraftPreview(s, TENANT_A)).toBe(true);
    expect(canAccessDraftPreview(s, TENANT_B)).toBe(false);
  });
});
