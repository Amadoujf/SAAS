import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";
import { testOwnerClient } from "./test-owner-client";
import { assertTenantLinks, linkSyntaxError, SiteLinkError } from "../src/site-links";
import { saveStorefrontContent } from "../src/storefront-registry";

/**
 * Liens du site contrôlés côté serveur, sur PostgreSQL RÉEL : forme, zones privées,
 * et jamais vers le site d'une autre entreprise (sous-domaine ou domaine personnalisé).
 */
let databaseAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch (error) {
  if (process.env.REQUIRE_DB_TESTS === "true") throw new Error(`REQUIRE_DB_TESTS=true mais PostgreSQL est injoignable : ${error instanceof Error ? error.message : String(error)}`);
  databaseAvailable = false;
}

describe("liens : forme", () => {
  it.each([
    ["/vehicules?stock=arrivage", null],
    ["#services", null],
    ["tel:+221 33 820 17 40", null],
    ["mailto:contact@exemple.sn", null],
    ["https://www.exemple.com/page", null],
  ])("accepte %s", (href, expected) => expect(linkSyntaxError(href)).toBe(expected));

  it.each(["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<b>x</b>", "http://exemple.com", "//evil.com", "/\\evil.com", "https://exemple.com/a b", "/dashboard", "/api/media/x", "/./dashboard/produits", "/a/../admin", "/%64ashboard", "vbscript:x", "ftp://x"])("refuse %s", (href) => {
    expect(linkSyntaxError(href)).not.toBeNull();
  });
});

describe.skipIf(!databaseAvailable)("liens : autres entreprises (réel, PostgreSQL)", () => {
  const suffix = Date.now();
  const sectorKey = `test-sector-links-${suffix}`;
  let a: string;
  let b: string;
  const aHost = `lien-a-${suffix}.yamacommerce.ai`;
  const bHost = `lien-b-${suffix}.yamacommerce.ai`;
  const bCustom = `boutique-b-${suffix}.sn`;

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.sector.create({ data: { key: sectorKey, name: "Secteur de test", defaultModuleKeys: [], isSystem: false } });
      const t = (s: string) => ({ slug: `test-liens-${s}-${suffix}`, name: `Liens ${s}`, businessType: "ECOMMERCE" as const, sectorKey, status: "ACTIVE" as const, billingExemptedAt: new Date() });
      a = (await tx.tenant.create({ data: t("a") })).id;
      b = (await tx.tenant.create({ data: t("b") })).id;
      await tx.domain.createMany({
        data: [
          { tenantId: a, domain: aHost, type: "subdomain", isPrimary: true, lifecycleStatus: "ACTIVE" },
          { tenantId: b, domain: bHost, type: "subdomain", isPrimary: true, lifecycleStatus: "ACTIVE" },
          { tenantId: b, domain: bCustom, type: "custom", isPrimary: false, lifecycleStatus: "ACTIVE" },
        ],
      });
    });
  });

  afterAll(async () => {
    const o = testOwnerClient();
    await o.storefrontContent.deleteMany({ where: { tenantId: { in: [a, b] } } });
    await o.domain.deleteMany({ where: { tenantId: { in: [a, b] } } });
    await o.tenant.deleteMany({ where: { id: { in: [a, b] } } });
    await o.sector.deleteMany({ where: { key: sectorKey } });
    await o.$disconnect();
  });

  const check = (value: unknown) => withTenant(a, (tx) => assertTenantLinks(tx, a, value));

  it("accepte ses propres domaines et les sites extérieurs", async () => {
    await expect(check({ ctaHref: `https://${aHost}/vehicules`, items: [{ href: "https://www.instagram.com/baobab" }] })).resolves.toBeUndefined();
  });

  it("refuse le sous-domaine et le domaine personnalisé d'une autre entreprise, et un sous-domaine de la plateforme non attribué", async () => {
    await expect(check({ primaryCtaHref: `https://${bHost}/` })).rejects.toThrow(SiteLinkError);
    await expect(check({ blocks: [{ params: { items: [{ href: `https://${bCustom}/promo` }] } }] })).rejects.toThrow(/autre entreprise/);
    await expect(check({ ctaHref: `https://inconnu-${suffix}.yamacommerce.ai/` })).rejects.toThrow(/autre entreprise/);
  });

  it("l'enregistrement de l'accueil refuse un lien dangereux (rien n'est écrit)", async () => {
    await expect(withTenant(a, (tx) => saveStorefrontContent(tx, a, { announcement: { text: "Promo", href: "javascript:alert(1)" } }, null))).rejects.toThrow(SiteLinkError);
    await expect(withTenant(a, (tx) => saveStorefrontContent(tx, a, { announcement: { text: "Promo", href: `https://${bHost}/` } }, null))).rejects.toThrow(SiteLinkError);
    expect(await withTenant(a, (tx) => tx.storefrontContent.findUnique({ where: { tenantId: a } }))).toBeNull();
    await withTenant(a, (tx) => saveStorefrontContent(tx, a, { announcement: { text: "Promo", href: "/vehicules" } }, null));
    expect(await withTenant(a, (tx) => tx.storefrontContent.findUnique({ where: { tenantId: a } }))).not.toBeNull();
  });
});
