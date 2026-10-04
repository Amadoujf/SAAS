import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";
import { testOwnerClient } from "./test-owner-client";
import { LegalProfileError, getLegalProfile, normalizeLegalProfile, saveLegalProfile } from "../src/legal-profile-registry";
import { writeAuditLog } from "../src/audit-log-registry";

/**
 * Informations légales d'une entreprise sur PostgreSQL RÉEL : validation, enregistrement
 * (création puis mise à jour), effacement d'un champ, isolation entre entreprises (RLS).
 */
let databaseAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch (error) {
  if (process.env.REQUIRE_DB_TESTS === "true") {
    throw new Error(`REQUIRE_DB_TESTS=true mais PostgreSQL est injoignable : ${error instanceof Error ? error.message : String(error)}`);
  }
  databaseAvailable = false;
  // eslint-disable-next-line no-console
  console.warn("[legal-profile.test] Base de données injoignable — suite ignorée (skip).");
}

describe("normalisation des informations légales", () => {
  it("nettoie les espaces, vide en null, garde les paragraphes des textes longs", () => {
    const p = normalizeLegalProfile({ legalName: "  Atelier   Naya  SARL ", ninea: " ", returnPolicy: "Échange sous 7 jours.\r\n\r\n\r\n\r\nArticle   non porté." });
    expect(p.legalName).toBe("Atelier Naya SARL");
    expect(p.ninea).toBeNull();
    expect(p.email).toBeNull();
    expect(p.returnPolicy).toBe("Échange sous 7 jours.\n\nArticle non porté.");
  });
  it("refuse un e-mail ou un téléphone invalide, un texte trop long, une valeur non textuelle", () => {
    expect(() => normalizeLegalProfile({ email: "pas-un-email" })).toThrow(/e-mail/);
    expect(() => normalizeLegalProfile({ phone: "appelez-moi" })).toThrow(/téléphone/);
    expect(() => normalizeLegalProfile({ legalName: "x".repeat(121) })).toThrow(/120 caractères/);
    expect(() => normalizeLegalProfile({ ninea: 12 as unknown as string })).toThrow(LegalProfileError);
    expect(normalizeLegalProfile({ email: "contact@naya.sn", phone: "+221 77 123 45 67" })).toMatchObject({ email: "contact@naya.sn", phone: "+221 77 123 45 67" });
  });
});

describe.skipIf(!databaseAvailable)("informations légales (PostgreSQL)", () => {
  const suffix = Math.random().toString(36).slice(2, 10);
  const tenantIds: string[] = [];
  let a = "";
  let b = "";

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      for (const k of ["a", "b"]) {
        const t = await tx.tenant.create({ data: { slug: `test-legal-${k}-${suffix}`, name: `Maison ${k}`, businessType: "ECOMMERCE", status: "ACTIVE" } });
        tenantIds.push(t.id);
      }
    });
    [a, b] = tenantIds as [string, string];
  });

  afterAll(async () => {
    const o = testOwnerClient();
    await o.auditLog.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await o.tenantLegalProfile.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await o.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await o.$disconnect();
  });

  it("sans fiche : tout est vide, rien n'est inventé", async () => {
    const view = await withTenant(a, (tx) => getLegalProfile(tx, a));
    expect(view.legalName).toBeNull();
    expect(view.updatedAt).toBeNull();
  });

  it("création, mise à jour, effacement d'un champ", async () => {
    await withTenant(a, async (tx) => {
      const first = await saveLegalProfile(tx, a, { legalName: "Maison A SARL", ninea: "001234567", returnPolicy: "Échange sous 7 jours." });
      expect(first).toMatchObject({ legalName: "Maison A SARL", ninea: "001234567" });
      expect(first.updatedAt).toBeInstanceOf(Date);
      const second = await saveLegalProfile(tx, a, { legalName: "Maison A SARL", ninea: "", address: "Rue 10, Dakar" });
      expect(second).toMatchObject({ ninea: null, address: "Rue 10, Dakar", returnPolicy: null });
      expect(await tx.tenantLegalProfile.count({ where: { tenantId: a } })).toBe(1);
    });
  });

  it("isolation : une autre entreprise ne lit ni ne modifie la fiche", async () => {
    await withTenant(a, (tx) => saveLegalProfile(tx, a, { legalName: "Secret A" }));
    expect(await withTenant(b, (tx) => tx.tenantLegalProfile.findMany())).toHaveLength(0);
    expect((await withTenant(b, (tx) => getLegalProfile(tx, a))).legalName).toBeNull();
    // Écriture pour le compte d'une autre entreprise : refusée par la RLS.
    await expect(withTenant(b, (tx) => saveLegalProfile(tx, a, { legalName: "Piratage" }))).rejects.toThrow();
    expect((await withTenant(a, (tx) => getLegalProfile(tx, a))).legalName).toBe("Secret A");
  });

  it("fiche et journal d'audit dans la même transaction : tout ou rien", async () => {
    const audit = (tx: Parameters<Parameters<typeof withTenant>[1]>[0]) =>
      writeAuditLog(tx, { tenantId: b, actorUserId: null, actorType: "owner", action: "legal_profile.update", entityType: "TenantLegalProfile", entityId: b });
    await withTenant(b, async (tx) => {
      await saveLegalProfile(tx, b, { legalName: "Maison B" });
      await audit(tx);
    });
    expect(await withTenant(b, (tx) => tx.auditLog.count({ where: { tenantId: b, action: "legal_profile.update" } }))).toBe(1);
    // Échec après l'écriture : ni la modification ni sa trace ne subsistent.
    await expect(withTenant(b, async (tx) => {
      await saveLegalProfile(tx, b, { legalName: "Jamais visible" });
      await audit(tx);
      throw new Error("échec simulé");
    })).rejects.toThrow("échec simulé");
    expect((await withTenant(b, (tx) => getLegalProfile(tx, b))).legalName).toBe("Maison B");
    expect(await withTenant(b, (tx) => tx.auditLog.count({ where: { tenantId: b, action: "legal_profile.update" } }))).toBe(1);
  });
});
