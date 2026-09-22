import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient, prisma, withSuperAdminAccess, withTenant } from "@yamacommerce/database";

/** Client élevé (rôle propriétaire), réservé au nettoyage de test — voir
 *  `packages/database/tests/test-owner-client.ts` pour la même justification :
 *  `StockMovement` a perdu UPDATE/DELETE pour le rôle applicatif (immutabilité de
 *  l'historique, voir la migration `20260925000000_catalog_security_hardening`). */
function testOwnerClient(): PrismaClient {
  return new PrismaClient({ datasources: { db: { url: process.env.MIGRATE_DATABASE_URL } } });
}

/**
 * Vérifie que TOUTE mutation catalogue visible côté site public invalide bien le
 * cache de son tenant — voir la revue du 18 septembre 2026 : « ajoute et teste
 * l'invalidation du cache après création, modification, publication, dépublication,
 * changement de prix, image ou stock ». Injecte un `invalidateCache` espionné (voir
 * `CatalogCacheDeps` dans product-pipeline.ts, même pattern que
 * `PublishSiteDeps`/`DnsCheckDeps`) plutôt que le vrai `invalidateSiteCache`, qui
 * exige un contexte Next.js réel absent d'un test Vitest.
 *
 * `auth()` (NextAuth) exige lui aussi un contexte de requête Next.js réel — simulé
 * ici par un mock renvoyant une session Super Admin, qui satisfait
 * `requireTenantPermission` sans dépendre d'une adhésion `TenantUser` réelle (voir
 * `lib/tenant-permissions.ts` : un Super Admin passe toujours).
 *
 * Même politique que les autres suites DB : ignorée en local sans PostgreSQL,
 * obligatoire en CI via REQUIRE_DB_TESTS.
 */
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "super-admin-test-user", isSuperAdmin: true } })),
}));
const { auth } = await import("@/lib/auth");
function mockSuperAdminSession() {
  vi.mocked(auth).mockResolvedValue({ user: { id: "super-admin-test-user", isSuperAdmin: true } } as never);
}
function mockRestrictedSession(userId: string) {
  vi.mocked(auth).mockResolvedValue({ user: { id: userId, isSuperAdmin: false } } as never);
}

let databaseAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch (error) {
  if (process.env.REQUIRE_DB_TESTS === "true") {
    throw new Error(
      "REQUIRE_DB_TESTS=true mais PostgreSQL est injoignable : la suite d'invalidation " +
        `du cache catalogue DOIT s'exécuter en CI. Cause : ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  databaseAvailable = false;
  // eslint-disable-next-line no-console
  console.warn("[product-pipeline.test] Base de données injoignable — suite ignorée (skip).");
}

describe.skipIf(!databaseAvailable)("Invalidation du cache — pipeline catalogue", () => {
  const suffix = Date.now();
  const sectorKey = `test-sector-cache-${suffix}`;
  let tenantId: string;
  let otherTenantId: string;

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.sector.create({
        data: { key: sectorKey, name: "Secteur de test", defaultModuleKeys: [], isSystem: false },
      });
      const tenant = await tx.tenant.create({
        data: {
          slug: `test-cache-${suffix}`,
          name: "Boutique cache",
          businessType: "ECOMMERCE",
          sectorKey,
          status: "ACTIVE",
        },
      });
      const other = await tx.tenant.create({
        data: {
          slug: `test-cache-other-${suffix}`,
          name: "Autre boutique",
          businessType: "ECOMMERCE",
          sectorKey,
          status: "ACTIVE",
        },
      });
      tenantId = tenant.id;
      otherTenantId = other.id;
    });
  });

  afterAll(async () => {
    const owner = testOwnerClient();
    try {
      await owner.stockMovement.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
    } finally {
      await owner.$disconnect();
    }

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_super_admin', 'true', true)`;
      await tx.inventoryItem.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
      await tx.productVariant.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
      await tx.productImage.deleteMany({ where: { product: { tenantId: { in: [tenantId, otherTenantId] } } } });
      await tx.product.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
      await tx.category.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
      await tx.mediaAsset.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
      await tx.shop.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
      await tx.user.deleteMany({ where: { email: { contains: `owner-cache-${suffix}` } } });
      await tx.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } });
      await tx.sector.deleteMany({ where: { key: sectorKey } });
    });
  });

  let invalidateCache: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    invalidateCache = vi.fn();
    mockSuperAdminSession(); // réinitialisé avant chaque test — voir "Permissions distinctes" plus bas, qui le remplace ponctuellement.
  });

  it("createCategoryAction / updateCategoryAction / deleteCategoryAction invalident le cache du BON tenant", async () => {
    const { createCategoryAction, updateCategoryAction, deleteCategoryAction } = await import("./product-pipeline");

    const category = await createCategoryAction(tenantId, { name: "Sacs", slug: `sacs-${suffix}` }, { invalidateCache });
    expect(invalidateCache).toHaveBeenLastCalledWith(tenantId);

    await updateCategoryAction(tenantId, category!.id, { name: "Sacs à main" }, { invalidateCache });
    expect(invalidateCache).toHaveBeenLastCalledWith(tenantId);

    await deleteCategoryAction(tenantId, category!.id, { invalidateCache });
    expect(invalidateCache).toHaveBeenLastCalledWith(tenantId);
    expect(invalidateCache).toHaveBeenCalledTimes(3);
  });

  it("createProductAction / updateProductAction (changement de prix) / setProductStatusAction (publication ET dépublication) invalident le cache", async () => {
    const { createProductAction, updateProductAction, setProductStatusAction, deleteProductAction } = await import(
      "./product-pipeline"
    );

    const product = await createProductAction(
      tenantId,
      { name: "Robe wax", slug: `robe-wax-cache-${suffix}`, basePrice: 15_000 },
      { invalidateCache },
    );
    expect(invalidateCache).toHaveBeenLastCalledWith(tenantId);

    await updateProductAction(tenantId, product!.id, { basePrice: 17_000 }, { invalidateCache });
    expect(invalidateCache).toHaveBeenLastCalledWith(tenantId);

    await setProductStatusAction(tenantId, product!.id, "PUBLISHED", { invalidateCache });
    expect(invalidateCache).toHaveBeenLastCalledWith(tenantId);

    await setProductStatusAction(tenantId, product!.id, "ARCHIVED", { invalidateCache });
    expect(invalidateCache).toHaveBeenLastCalledWith(tenantId);

    await deleteProductAction(tenantId, product!.id, { invalidateCache });
    expect(invalidateCache).toHaveBeenLastCalledWith(tenantId);
    expect(invalidateCache).toHaveBeenCalledTimes(5);
  });

  it("images (ajout/retrait/réordonnancement) et variantes invalident le cache", async () => {
    const {
      createProductAction,
      addProductImageAction,
      removeProductImageAction,
      createVariantAction,
      updateVariantAction,
      deleteVariantAction,
    } = await import("./product-pipeline");

    const product = await createProductAction(
      tenantId,
      { name: "T-shirt", slug: `t-shirt-cache-${suffix}`, basePrice: 8_000 },
      { invalidateCache: vi.fn() }, // pas mesuré ici, juste un prérequis.
    );

    const owner = await withSuperAdminAccess((tx) =>
      tx.user.create({ data: { email: `owner-cache-${suffix}@test.local`, passwordHash: "x", fullName: "Owner" } }),
    );
    const mediaAsset = await withSuperAdminAccess((tx) =>
      tx.mediaAsset.create({
        data: {
          tenantId,
          ownerId: owner.id,
          originalName: "p.jpg",
          storageKey: `test-cache/${suffix}/p.jpg`,
          type: "IMAGE",
          mimeType: "image/jpeg",
          sizeBytes: 100,
          status: "READY",
          checksumSha256: "abc",
        },
      }),
    );

    const image = await addProductImageAction(
      tenantId,
      { productId: product!.id, mediaAssetId: mediaAsset.id },
      { invalidateCache },
    );
    expect(invalidateCache).toHaveBeenLastCalledWith(tenantId);

    await removeProductImageAction(tenantId, image!.id, { invalidateCache });
    expect(invalidateCache).toHaveBeenLastCalledWith(tenantId);

    const variant = await createVariantAction(
      tenantId,
      product!.id,
      { name: "M", price: 8_000 },
      { invalidateCache },
    );
    expect(invalidateCache).toHaveBeenLastCalledWith(tenantId);

    await updateVariantAction(tenantId, variant!.id, { price: 9_000 }, { invalidateCache });
    expect(invalidateCache).toHaveBeenLastCalledWith(tenantId);

    await deleteVariantAction(tenantId, variant!.id, { invalidateCache });
    expect(invalidateCache).toHaveBeenLastCalledWith(tenantId);
    expect(invalidateCache).toHaveBeenCalledTimes(5);
  });

  it("upsertInventoryItemAction / adjustStockAction invalident le cache du tenant qui possède RÉELLEMENT le stock", async () => {
    const { createProductAction, createVariantAction } = await import("./product-pipeline");
    const { upsertInventoryItemAction, adjustStockAction } = await import("./stock-pipeline");

    const product = await createProductAction(
      tenantId,
      { name: "Chaussures", slug: `chaussures-cache-${suffix}`, basePrice: 20_000 },
      { invalidateCache: vi.fn() },
    );
    const variant = await createVariantAction(
      tenantId,
      product!.id,
      { name: "42", price: 20_000 },
      { invalidateCache: vi.fn() },
    );

    const item = await upsertInventoryItemAction(
      tenantId,
      { variantId: variant!.id, initialQuantity: 5 },
      { invalidateCache },
    );
    expect(invalidateCache).toHaveBeenLastCalledWith(tenantId);

    await adjustStockAction(tenantId, { inventoryItemId: item!.id, type: "in", quantity: 3 }, { invalidateCache });
    expect(invalidateCache).toHaveBeenLastCalledWith(tenantId);
    // JAMAIS le tenant d'un autre — voir la revue du 18 septembre 2026 sur
    // l'isolation, transposée ici à l'invalidation de cache.
    expect(invalidateCache).not.toHaveBeenCalledWith(otherTenantId);
    expect(invalidateCache).toHaveBeenCalledTimes(2);
  });

  describe("PERMISSIONS DISTINCTES — consulter le stock n'autorise pas de l'ajuster", () => {
    it("un acteur avec SEULEMENT products.view peut consulter mais jamais ajuster le stock", async () => {
      const { createProductAction, createVariantAction } = await import("./product-pipeline");
      const { upsertInventoryItemAction, adjustStockAction, listStockMovementsAction, listLowStockItemsAction } =
        await import("./stock-pipeline");

      mockSuperAdminSession();
      const product = await createProductAction(
        tenantId,
        { name: "Sac permissions", slug: `sac-permissions-${suffix}`, basePrice: 10_000 },
        { invalidateCache: vi.fn() },
      );
      const variant = await createVariantAction(
        tenantId,
        product!.id,
        { name: "Unique", price: 10_000 },
        { invalidateCache: vi.fn() },
      );
      const item = await upsertInventoryItemAction(
        tenantId,
        { variantId: variant!.id, initialQuantity: 5 },
        { invalidateCache: vi.fn() },
      );

      // Adhésion RÉELLE, restreinte à `products.view` seul — jamais super admin, pour
      // exercer VRAIMENT `requireTenantPermission` (voir lib/tenant-permissions.ts),
      // pas seulement son raccourci super admin. `tenantId: null` sur le rôle (comme
      // un VRAI rôle système, voir SYSTEM_ROLES/seed.ts) : `requireTenantPermission`
      // résout le rôle via `withUser`, qui positionne `app.current_user_id` mais
      // JAMAIS `app.current_tenant_id` — la policy RLS Pattern B de `Role`
      // (« tenantId IS NULL OR yamacommerce_tenant_isolation_check(tenantId) ») ne
      // rendrait donc jamais visible un rôle propre à CE tenant précis dans ce
      // contexte (trouvé en écrivant ce test pour de vrai) : limite préexistante de
      // ce mécanisme, hors périmètre de cette revue, mais qui explique pourquoi ce
      // test utilise un rôle global plutôt qu'un rôle propre au tenant.
      const viewOnlyUserId = await withSuperAdminAccess(async (tx) => {
        const user = await tx.user.create({
          data: { email: `view-only-${suffix}@test.local`, passwordHash: "x", fullName: "Vue seule" },
        });
        const role = await tx.role.create({
          data: { tenantId: null, name: `Vue seule ${suffix}`, permissions: ["products.view"], isSystem: false },
        });
        await tx.tenantUser.create({
          data: { tenantId, userId: user.id, roleId: role.id, status: "ACTIVE", joinedAt: new Date() },
        });
        return user.id;
      });

      mockRestrictedSession(viewOnlyUserId);

      // Consultation : AUTORISÉE.
      const movements = await listStockMovementsAction(tenantId, item!.id);
      expect(movements).not.toBeNull();
      const lowStock = await listLowStockItemsAction(tenantId);
      expect(lowStock).not.toBeNull();

      // Ajustement : REFUSÉ (retourne `null`, jamais une exception qui laisserait
      // deviner l'existence de la ressource — même convention que le reste du projet).
      const adjustResult = await adjustStockAction(tenantId, {
        inventoryItemId: item!.id,
        type: "in",
        quantity: 1,
      });
      expect(adjustResult).toBeNull();

      const stillFive = await withSuperAdminAccess((tx) =>
        tx.inventoryItem.findUniqueOrThrow({ where: { id: item!.id } }),
      );
      expect(stillFive.availableQuantity).toBe(5); // inchangé — la tentative refusée n'a rien modifié.

      await withSuperAdminAccess((tx) => tx.tenantUser.deleteMany({ where: { userId: viewOnlyUserId } }));
      await withSuperAdminAccess((tx) => tx.role.deleteMany({ where: { name: `Vue seule ${suffix}` } }));
      await withSuperAdminAccess((tx) => tx.user.deleteMany({ where: { id: viewOnlyUserId } }));
    });
  });
});
