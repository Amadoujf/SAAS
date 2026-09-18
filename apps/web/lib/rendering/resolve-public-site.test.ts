import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  prisma,
  withSuperAdminAccess,
  withTenant,
  upsertTemplate,
  assignTemplateToTenant,
  publishTemplate,
} from "@yamacommerce/database";
import { DEFAULT_DESIGN_TOKENS } from "@yamacommerce/design-tokens";
import { resolvePublicSite, type ResolvePublicSiteDeps } from "./resolve-public-site";
import { resolveTenantSiteForRendering } from "./resolve-tenant-site";

/**
 * Faux cache DÉLIBÉRÉMENT jamais invalidé (contrairement à `cachedLiveSiteResolver`
 * réel, qui n'est de toute façon pas appelable hors d'un contexte Next.js réel, voir
 * la note de `ResolvePublicSiteDeps` dans resolve-public-site.ts) : mémorise le
 * contenu par tenant pour de bon, exactement comme une entrée de cache resterait
 * chaude indéfiniment sans republication. Si `resolvePublicSite` vérifiait le statut
 * domaine/tenant APRÈS avoir consulté ce cache au lieu d'avant, ce test le
 * détecterait — le contenu mis en cache une fois resterait servi malgré la
 * suspension.
 */
function warmingNeverInvalidatedCacheDeps(): ResolvePublicSiteDeps {
  const memo = new Map<string, Awaited<ReturnType<typeof resolveTenantSiteForRendering>>>();
  return {
    resolveSiteContent: async (tenantId) => {
      if (!memo.has(tenantId)) {
        memo.set(tenantId, await resolveTenantSiteForRendering(tenantId, "live"));
      }
      return memo.get(tenantId)!;
    },
  };
}

/**
 * Vérifie le point d'entrée UNIQUE du rendu public contre de VRAIES données
 * (PostgreSQL + RLS) — voir la revue du 18 septembre 2026 : « il faut ajouter un
 * contrôle côté application sur chaque requête publique : si le domaine ou
 * l'entreprise est suspendu, supprimé ou non autorisé, aucun contenu du tenant ne
 * doit être servi, même avec un certificat en cache » et « vérifier ce scénario sans
 * redémarrer Caddy, y compris avec des pages déjà en cache ».
 *
 * `resolvePublicSite` est le SEUL rempart applicatif indépendant de Caddy/TLS — le
 * certificat peut rester valide après une suspension (voir docs/13, limite connue de
 * `CaddyDomainProvider.revokeDomain`), mais AUCUNE requête HTTP réelle ne doit
 * jamais atteindre le contenu du tenant si elle repasse par cette fonction. Le
 * contenu du site (PAS le statut domaine/tenant) est mis en cache via
 * `cachedLiveSiteResolver`/`unstable_cache` (voir lib/publishing/cache.ts) — ce test
 * réchauffe délibérément ce cache AVANT de suspendre, pour prouver que la
 * vérification de statut n'est jamais contournée par une entrée de cache déjà
 * chaude, exactement le scénario demandé.
 *
 * Même politique que les autres suites DB de ce projet : ignorée en local sans
 * PostgreSQL, obligatoire en CI via REQUIRE_DB_TESTS.
 */
let databaseAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch (error) {
  if (process.env.REQUIRE_DB_TESTS === "true") {
    throw new Error(
      "REQUIRE_DB_TESTS=true mais PostgreSQL est injoignable : la suite de résolution " +
        `du site public DOIT s'exécuter en CI. Cause : ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  databaseAvailable = false;
  // eslint-disable-next-line no-console
  console.warn("[resolve-public-site.test] Base de données injoignable — suite ignorée (skip).");
}

const manifest = {
  pages: [
    {
      slug: "accueil",
      title: "Accueil",
      isHome: true,
      sections: [
        {
          id: "cta-1",
          sectionKey: "cta" as const,
          variant: "banner",
          order: 0,
          isEnabled: true,
          animationOverride: "inherit" as const,
          params: { title: "Titre public", buttonLabel: "Go", buttonHref: "/x" },
        },
      ],
    },
  ],
};

describe.skipIf(!databaseAvailable)("resolvePublicSite", () => {
  const suffix = Date.now();
  const sectorKey = `test-sector-public-site-${suffix}`;
  const host = `public-site-test-${suffix}.example.com`;
  let tenantId: string;
  let templateId: string;

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.sector.create({
        data: { key: sectorKey, name: "Secteur de test", defaultModuleKeys: [], isSystem: false },
      });
      const tenant = await tx.tenant.create({
        data: {
          slug: `test-public-site-${suffix}`,
          name: "Boutique publique de test",
          businessType: "ECOMMERCE",
          sectorKey,
          status: "ACTIVE",
        },
      });
      tenantId = tenant.id;

      const template = await upsertTemplate(tx, {
        key: `test-public-site-template-${suffix}`,
        name: "Template de test",
        sectorKey,
        artDirectionKey: "test",
        pageManifest: manifest,
        defaultDesignTokens: DEFAULT_DESIGN_TOKENS,
      });
      templateId = template.id;
      await publishTemplate(tx, template.id);

      await assignTemplateToTenant(tx, tenantId, templateId);
      await tx.domain.create({
        data: {
          tenantId,
          domain: host,
          type: "custom",
          lifecycleStatus: "ACTIVE",
          isPrimary: true,
        },
      });
    });

    await withTenant(tenantId, (tx) => tx.tenantSite.update({ where: { tenantId }, data: { isPublished: true } }));
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_super_admin', 'true', true)`;
      await tx.domain.deleteMany({ where: { tenantId } });
      await tx.page.deleteMany({ where: { tenantId } });
      await tx.tenantSiteVersion.deleteMany({ where: { tenantId } });
      await tx.tenantSite.deleteMany({ where: { tenantId } });
      await tx.counter.deleteMany({ where: { tenantId } });
      await tx.tenant.deleteMany({ where: { id: tenantId } });
      await tx.siteTemplate.deleteMany({ where: { id: templateId } });
      await tx.sector.deleteMany({ where: { key: sectorKey } });
    });
  });

  it("sert le contenu réel du tenant pour un domaine ACTIF rattaché à un tenant ACTIF", async () => {
    const resolution = await resolvePublicSite(host, warmingNeverInvalidatedCacheDeps());
    expect(resolution.status).toBe("ok");
    if (resolution.status !== "ok") throw new Error("unreachable");
    expect(resolution.tenantId).toBe(tenantId);
    expect(resolution.site.manifest.pages[0]?.slug).toBe("accueil");
  });

  it(
    "SUSPENSION DU DOMAINE, sans toucher à Caddy ni invalider explicitement le cache de contenu : " +
      "la requête suivante ne sert plus AUCUN contenu du tenant, même si le cache de contenu était déjà chaud",
    async () => {
      // UNE SEULE instance de cache pour tout le scénario, jamais invalidée — voir
      // warmingNeverInvalidatedCacheDeps : réchauffe le cache de CONTENU avant la
      // suspension, exactement le scénario « pages déjà en cache » demandé.
      const deps = warmingNeverInvalidatedCacheDeps();
      const before = await resolvePublicSite(host, deps);
      expect(before.status).toBe("ok");

      // Suspend UNIQUEMENT le domaine en base — AUCUN appel à invalidateSiteCache,
      // AUCUN redémarrage de quoi que ce soit : exactement le scénario demandé.
      await withSuperAdminAccess((tx) =>
        tx.domain.update({ where: { domain: host }, data: { lifecycleStatus: "SUSPENDED" } }),
      );

      const after = await resolvePublicSite(host, deps);
      expect(after.status).not.toBe("ok");
      expect(after.status).toBe("not_found"); // un domaine suspendu se comporte comme non enregistré, jamais comme le tenant.

      // Réactive pour ne pas polluer les tests suivants de cette suite.
      await withSuperAdminAccess((tx) =>
        tx.domain.update({ where: { domain: host }, data: { lifecycleStatus: "ACTIVE" } }),
      );
      const restored = await resolvePublicSite(host, deps);
      expect(restored.status).toBe("ok");
    },
  );

  it(
    "SUSPENSION DE L'ENTREPRISE (domaine resté ACTIF), sans invalidation explicite du cache : " +
      "affiche l'écran « suspendu », jamais le contenu du site",
    async () => {
      const deps = warmingNeverInvalidatedCacheDeps();
      const before = await resolvePublicSite(host, deps);
      expect(before.status).toBe("ok");

      await withSuperAdminAccess((tx) => tx.tenant.update({ where: { id: tenantId }, data: { status: "SUSPENDED" } }));

      const after = await resolvePublicSite(host, deps);
      expect(after.status).toBe("suspended");
      if (after.status !== "suspended") throw new Error("unreachable");
      expect(after.tenantName).toBe("Boutique publique de test");
      // La réponse "suspended" ne porte JAMAIS le contenu du site, contrairement à "ok".
      expect(after).not.toHaveProperty("site");

      await withSuperAdminAccess((tx) => tx.tenant.update({ where: { id: tenantId }, data: { status: "ACTIVE" } }));
      const restored = await resolvePublicSite(host, deps);
      expect(restored.status).toBe("ok");
    },
  );

  it("RETRAIT DU DOMAINE (REMOVED) : ne sert plus jamais aucun contenu, même après avoir déjà servi ce tenant", async () => {
    const deps = warmingNeverInvalidatedCacheDeps();
    const before = await resolvePublicSite(host, deps);
    expect(before.status).toBe("ok");

    await withSuperAdminAccess((tx) =>
      tx.domain.update({ where: { domain: host }, data: { lifecycleStatus: "REMOVED" } }),
    );

    const after = await resolvePublicSite(host, deps);
    expect(after.status).toBe("not_found");
  });
});
