import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";
import {
  computeStorageUsage,
  createPendingMediaAsset,
  findMediaAssetByChecksum,
  getMediaAsset,
  listMediaAssets,
  listTrashedMediaAssets,
  markMediaAssetFailed,
  markMediaAssetReady,
  permanentlyDeleteMediaAsset,
  restoreMediaAsset,
  trashMediaAsset,
  updateMediaAsset,
} from "../src/media-assets-registry";

/**
 * Vérifie la persistance de la médiathèque (docs/12 §12.2, 21 septembre 2026) :
 * cycle de vie PENDING -> READY/FAILED -> TRASHED -> suppression définitive,
 * déduplication par checksum SCOPÉE au tenant, usage de stockage, et isolation
 * multi-tenant (RLS) — un tenant ne peut jamais lire, modifier, dédupliquer contre,
 * ou supprimer le média d'un autre tenant.
 *
 * Même politique que les autres suites DB : ignorée en local sans PostgreSQL,
 * obligatoire en CI via REQUIRE_DB_TESTS.
 */
let databaseAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch (error) {
  if (process.env.REQUIRE_DB_TESTS === "true") {
    throw new Error(
      "REQUIRE_DB_TESTS=true mais PostgreSQL est injoignable : la suite médiathèque " +
        `DOIT s'exécuter en CI. Cause : ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  databaseAvailable = false;
  // eslint-disable-next-line no-console
  console.warn("[media-assets-registry.test] Base de données injoignable — suite ignorée (skip).");
}

describe.skipIf(!databaseAvailable)("Médiathèque — persistance et isolation", () => {
  const suffix = Date.now();
  const sectorKey = `test-sector-media-${suffix}`;
  let tenantAId: string;
  let tenantBId: string;
  let ownerAId: string;
  let ownerBId: string;

  beforeAll(async () => {
    await withSuperAdminAccess(async (tx) => {
      await tx.sector.create({
        data: { key: sectorKey, name: "Secteur de test", defaultModuleKeys: [], isSystem: false },
      });
      const tenantA = await tx.tenant.create({
        data: {
          slug: `test-media-a-${suffix}`,
          name: "Tenant Média A",
          businessType: "ECOMMERCE",
          sectorKey,
          status: "ACTIVE",
        },
      });
      const tenantB = await tx.tenant.create({
        data: {
          slug: `test-media-b-${suffix}`,
          name: "Tenant Média B",
          businessType: "ECOMMERCE",
          sectorKey,
          status: "ACTIVE",
        },
      });
      tenantAId = tenantA.id;
      tenantBId = tenantB.id;

      const ownerA = await tx.user.create({
        data: { fullName: "Propriétaire A", passwordHash: "test-hash", email: `owner-a-${suffix}@test.local` },
      });
      const ownerB = await tx.user.create({
        data: { fullName: "Propriétaire B", passwordHash: "test-hash", email: `owner-b-${suffix}@test.local` },
      });
      ownerAId = ownerA.id;
      ownerBId = ownerB.id;
    });
  });

  afterAll(async () => {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.is_super_admin', 'true', true)`;
      await tx.mediaAsset.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
      await tx.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
      await tx.user.deleteMany({ where: { id: { in: [ownerAId, ownerBId] } } });
      await tx.sector.deleteMany({ where: { key: sectorKey } });
    });
  });

  it("crée un média PENDING puis le passe à READY après vérification", async () => {
    const pending = await withTenant(tenantAId, (tx) =>
      createPendingMediaAsset(tx, tenantAId, {
        ownerId: ownerAId,
        originalName: "photo.png",
        storageKey: `tenants/${tenantAId}/originals/photo-${suffix}.png`,
        type: "IMAGE",
        mimeType: "image/png",
        sizeBytes: 1000,
      }),
    );
    expect(pending.status).toBe("PENDING");

    const ready = await withTenant(tenantAId, (tx) =>
      markMediaAssetReady(tx, tenantAId, pending.id, {
        sizeBytes: 1024,
        mimeType: "image/png",
        width: 800,
        height: 600,
        checksumSha256: "a".repeat(64),
      }),
    );
    expect(ready.status).toBe("READY");
    expect(ready.width).toBe(800);

    const listed = await withTenant(tenantAId, (tx) => listMediaAssets(tx, tenantAId));
    expect(listed.some((asset) => asset.id === pending.id)).toBe(true);
  });

  it("un média FAILED n'apparaît jamais dans la liste par défaut", async () => {
    const pending = await withTenant(tenantAId, (tx) =>
      createPendingMediaAsset(tx, tenantAId, {
        ownerId: ownerAId,
        originalName: "bad.png",
        storageKey: `tenants/${tenantAId}/originals/bad-${suffix}.png`,
        type: "IMAGE",
        mimeType: "image/png",
        sizeBytes: 1000,
      }),
    );
    await withTenant(tenantAId, (tx) =>
      markMediaAssetFailed(tx, tenantAId, pending.id, "unrecognized_signature"),
    );

    const listed = await withTenant(tenantAId, (tx) => listMediaAssets(tx, tenantAId));
    expect(listed.some((asset) => asset.id === pending.id)).toBe(false);
  });

  it("modifie le nom, le texte alternatif, la légende et le dossier", async () => {
    const pending = await withTenant(tenantAId, (tx) =>
      createPendingMediaAsset(tx, tenantAId, {
        ownerId: ownerAId,
        originalName: "avant.png",
        storageKey: `tenants/${tenantAId}/originals/rename-${suffix}.png`,
        type: "IMAGE",
        mimeType: "image/png",
        sizeBytes: 500,
      }),
    );
    await withTenant(tenantAId, (tx) =>
      markMediaAssetReady(tx, tenantAId, pending.id, {
        sizeBytes: 500,
        mimeType: "image/png",
        checksumSha256: "b".repeat(64),
      }),
    );
    const updated = await withTenant(tenantAId, (tx) =>
      updateMediaAsset(tx, tenantAId, pending.id, {
        originalName: "apres.png",
        altText: "Texte alternatif",
        caption: "Légende",
        folder: "collection-ete",
      }),
    );
    expect(updated.originalName).toBe("apres.png");
    expect(updated.altText).toBe("Texte alternatif");
    expect(updated.folder).toBe("collection-ete");
  });

  it("CORBEILLE : trashMediaAsset puis restoreMediaAsset restaure l'état READY", async () => {
    const pending = await withTenant(tenantAId, (tx) =>
      createPendingMediaAsset(tx, tenantAId, {
        ownerId: ownerAId,
        originalName: "corbeille.png",
        storageKey: `tenants/${tenantAId}/originals/trash-${suffix}.png`,
        type: "IMAGE",
        mimeType: "image/png",
        sizeBytes: 500,
      }),
    );
    await withTenant(tenantAId, (tx) =>
      markMediaAssetReady(tx, tenantAId, pending.id, {
        sizeBytes: 500,
        mimeType: "image/png",
        checksumSha256: "c".repeat(64),
      }),
    );

    await withTenant(tenantAId, (tx) => trashMediaAsset(tx, tenantAId, pending.id));
    let asset = await withTenant(tenantAId, (tx) => getMediaAsset(tx, tenantAId, pending.id));
    expect(asset?.status).toBe("TRASHED");
    expect(asset?.deletedAt).not.toBeNull();

    const trashed = await withTenant(tenantAId, (tx) => listTrashedMediaAssets(tx, tenantAId));
    expect(trashed.some((item) => item.id === pending.id)).toBe(true);

    await withTenant(tenantAId, (tx) => restoreMediaAsset(tx, tenantAId, pending.id));
    asset = await withTenant(tenantAId, (tx) => getMediaAsset(tx, tenantAId, pending.id));
    expect(asset?.status).toBe("READY");
    expect(asset?.deletedAt).toBeNull();
  });

  it("SUPPRESSION DÉFINITIVE : refuse un média qui n'est pas déjà dans la corbeille, puis réussit une fois trashé", async () => {
    const pending = await withTenant(tenantAId, (tx) =>
      createPendingMediaAsset(tx, tenantAId, {
        ownerId: ownerAId,
        originalName: "definitif.png",
        storageKey: `tenants/${tenantAId}/originals/perm-${suffix}.png`,
        type: "IMAGE",
        mimeType: "image/png",
        sizeBytes: 500,
      }),
    );
    await withTenant(tenantAId, (tx) =>
      markMediaAssetReady(tx, tenantAId, pending.id, {
        sizeBytes: 500,
        mimeType: "image/png",
        checksumSha256: "d".repeat(64),
      }),
    );

    await expect(
      withTenant(tenantAId, (tx) => permanentlyDeleteMediaAsset(tx, tenantAId, pending.id)),
    ).rejects.toThrow();

    await withTenant(tenantAId, (tx) => trashMediaAsset(tx, tenantAId, pending.id));
    await withTenant(tenantAId, (tx) => permanentlyDeleteMediaAsset(tx, tenantAId, pending.id));

    const asset = await withTenant(tenantAId, (tx) => getMediaAsset(tx, tenantAId, pending.id));
    expect(asset).toBeNull();
  });

  it("calcule l'utilisation de stockage (READY + TRASHED) et le nombre de fichiers actifs", async () => {
    const before = await withTenant(tenantAId, (tx) => computeStorageUsage(tx, tenantAId));

    const asset = await withTenant(tenantAId, (tx) =>
      createPendingMediaAsset(tx, tenantAId, {
        ownerId: ownerAId,
        originalName: "usage.png",
        storageKey: `tenants/${tenantAId}/originals/usage-${suffix}.png`,
        type: "IMAGE",
        mimeType: "image/png",
        sizeBytes: 12_345,
      }),
    );
    await withTenant(tenantAId, (tx) =>
      markMediaAssetReady(tx, tenantAId, asset.id, {
        sizeBytes: 12_345,
        mimeType: "image/png",
        checksumSha256: "e".repeat(64),
      }),
    );

    const after = await withTenant(tenantAId, (tx) => computeStorageUsage(tx, tenantAId));
    expect(after.totalBytes).toBe(before.totalBytes + 12_345);
    expect(after.fileCount).toBe(before.fileCount + 1);
  });

  describe("ISOLATION ENTRE TENANTS", () => {
    let assetInTenantA: string;
    const sharedChecksum = "f".repeat(64);

    beforeAll(async () => {
      const asset = await withTenant(tenantAId, (tx) =>
        createPendingMediaAsset(tx, tenantAId, {
          ownerId: ownerAId,
          originalName: "isolation.png",
          storageKey: `tenants/${tenantAId}/originals/isolation-${suffix}.png`,
          type: "IMAGE",
          mimeType: "image/png",
          sizeBytes: 500,
        }),
      );
      await withTenant(tenantAId, (tx) =>
        markMediaAssetReady(tx, tenantAId, asset.id, {
          sizeBytes: 500,
          mimeType: "image/png",
          checksumSha256: sharedChecksum,
        }),
      );
      assetInTenantA = asset.id;
    });

    it("le tenant B ne peut pas LIRE le média du tenant A", async () => {
      const asset = await withTenant(tenantBId, (tx) => getMediaAsset(tx, tenantBId, assetInTenantA));
      expect(asset).toBeNull();
    });

    it("le tenant B ne peut pas MODIFIER le média du tenant A", async () => {
      await expect(
        withTenant(tenantBId, (tx) =>
          updateMediaAsset(tx, tenantBId, assetInTenantA, { originalName: "vole.png" }),
        ),
      ).rejects.toThrow();
    });

    it("le tenant B ne peut pas SUPPRIMER (corbeille) le média du tenant A", async () => {
      await expect(
        withTenant(tenantBId, (tx) => trashMediaAsset(tx, tenantBId, assetInTenantA)),
      ).rejects.toThrow();

      // Le média du tenant A doit rester intact et READY.
      const stillThere = await withTenant(tenantAId, (tx) => getMediaAsset(tx, tenantAId, assetInTenantA));
      expect(stillThere?.status).toBe("READY");
    });

    it("DÉDUPLICATION : un même checksum chez le tenant A n'est jamais trouvé par le tenant B", async () => {
      const foundByB = await withTenant(tenantBId, (tx) =>
        findMediaAssetByChecksum(tx, tenantBId, sharedChecksum),
      );
      expect(foundByB).toBeNull();

      const foundByA = await withTenant(tenantAId, (tx) =>
        findMediaAssetByChecksum(tx, tenantAId, sharedChecksum),
      );
      expect(foundByA?.id).toBe(assetInTenantA);
    });
  });
});
