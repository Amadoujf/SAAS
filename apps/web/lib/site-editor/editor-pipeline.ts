import "server-only";
import { z } from "zod";
import {
  withTenant,
  getOrCreateDraftVersion,
  updatePageBlocks,
  resolveEffectiveDesignTokens,
  resolveEffectiveAnimationLevel,
} from "@yamacommerce/database";
import { validateSectionInstance, type SectionInstance, type TemplateManifest } from "@yamacommerce/templates";
import type { Permission } from "@yamacommerce/auth";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { requireTenantPermission } from "@/lib/tenant-permissions";
import { resolveCatalogContentForManifest } from "@/lib/rendering/resolve-catalog-content";
import { buildShowcasePool } from "@/lib/rendering/showcase-pool";
import { SHOWCASE_POOL_KEY } from "@/lib/showcase/showcase";
import { publishSite } from "@/lib/publishing/publish-pipeline";
import { realPublishSiteDeps } from "@/lib/publishing/real-deps";
import { ensureTenantEditorSite } from "./tenant-site";
import { isDraftSettings, previewTokens } from "@/lib/site-ai/site-state";

export type EditorActionResult<T = unknown> = { ok: true; data: T } | { ok: false; status: number; error: string };

async function context(permission: Permission) {
  const membership = await getCurrentTenantMembership();
  if (!membership) return null;
  const actor = await requireTenantPermission(membership.tenantId, permission);
  if (!actor) return null;
  return { membership, userId: actor.userId };
}

/** Tout ce que l'éditeur affiche : brouillon courant, couleurs effectives du site,
 *  contenus réels (réservoir du carrousel, contenus des sections catalogue) et choix
 *  proposés par nom. Crée le site et son premier brouillon à la première ouverture. */
export async function loadTenantEditor() {
  const ctx = await context("site.edit");
  if (!ctx) return null;
  const { tenantId, tenantName } = ctx.membership;
  const tenantSiteId = await ensureTenantEditorSite(tenantId, tenantName);
  return withTenant(tenantId, async (tx) => {
    const draft = await getOrCreateDraftVersion(tx, tenantId, tenantSiteId);
    const pages = [...draft.pages].sort((a, b) => Number(b.isHome) - Number(a.isHome) || a.slug.localeCompare(b.slug));
    const manifest = { pages: pages.map((p) => ({ slug: p.slug, title: p.title, isHome: p.isHome, sections: p.blocks as unknown as SectionInstance[] })) } as TemplateManifest;
    const resolvedContent = await resolveCatalogContentForManifest(tx, tenantId, manifest);
    // Réservoir toujours fourni : un carrousel ajouté pendant la session affiche aussitôt
    // les vrais contenus de l'entreprise.
    const pool = await buildShowcasePool(tx, tenantId);
    resolvedContent[SHOWCASE_POOL_KEY] = pool;
    const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { sectorKey: true, slug: true } });
    const categories = await tx.category.findMany({ where: { tenantId }, select: { id: true, name: true }, orderBy: { name: "asc" } });
    return {
      tenantName,
      sectorKey: tenant.sectorKey,
      pages: pages.map((p) => ({ id: p.id, slug: p.slug, title: p.title, isHome: p.isHome, blocks: p.blocks as unknown as SectionInstance[] })),
      // Identité et animations DU BROUILLON quand elles existent (même aperçu que « Mon site »).
      tokens: isDraftSettings(draft.settings) ? previewTokens(draft.settings) : await resolveEffectiveDesignTokens(tx, tenantId),
      animationLevel: await resolveEffectiveAnimationLevel(tx, tenantId),
      resolvedContent,
      idOptions: {
        productIds: pool.products.map((p) => ({ id: p.id, label: p.title })),
        listingIds: pool.listings.map((l) => ({ id: l.id, label: l.title })),
        categoryIds: categories.map((c) => ({ id: c.id, label: c.name })),
        recordId: [...pool.products, ...pool.listings].map((r) => ({ id: r.id, label: r.title })),
      },
      canPublish: Boolean(await requireTenantPermission(tenantId, "site.publish")),
    };
  });
}

const draftSchema = z.object({
  pages: z.array(z.object({ id: z.string().min(1), blocks: z.array(z.unknown()).max(40) })).min(1).max(20),
});

/** Enregistre le brouillon : UNIQUEMENT les pages du brouillon courant de CETTE
 *  entreprise (RLS + contrôle d'appartenance), chaque section revalidée. */
export async function saveTenantDraft(raw: unknown): Promise<EditorActionResult<null>> {
  const ctx = await context("site.edit");
  if (!ctx) return { ok: false, status: 403, error: "Action non autorisée." };
  const parsed = draftSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, status: 400, error: "Brouillon invalide." };
  const pages: { id: string; blocks: SectionInstance[] }[] = [];
  for (const page of parsed.data.pages) {
    const blocks: SectionInstance[] = [];
    for (const block of page.blocks) {
      try {
        blocks.push(validateSectionInstance(block));
      } catch (error) {
        const key = typeof block === "object" && block && "sectionKey" in block ? String((block as { sectionKey: unknown }).sectionKey) : "?";
        const message = error instanceof z.ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : undefined;
        return { ok: false, status: 400, error: `Une section (« ${key} ») contient une valeur invalide${message ? ` : ${message}` : "."}` };
      }
    }
    pages.push({ id: page.id, blocks });
  }
  const { tenantId, tenantName } = ctx.membership;
  const tenantSiteId = await ensureTenantEditorSite(tenantId, tenantName);
  try {
    await withTenant(tenantId, async (tx) => {
      const draft = await getOrCreateDraftVersion(tx, tenantId, tenantSiteId);
      const own = new Set(draft.pages.map((p) => p.id));
      for (const page of pages) {
        if (!own.has(page.id)) throw new Error("Cette page n'appartient pas au brouillon en cours : rechargez l'éditeur.");
        await updatePageBlocks(tx, page.id, page.blocks);
      }
    });
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, status: 409, error: error instanceof Error ? error.message : "Enregistrement impossible." };
  }
}

/** Publie le brouillon courant par le pipeline atomique existant (vérifications de
 *  publication, médias rendus publics, version figée, journal d'audit, cache). */
export async function publishTenantDraft(): Promise<EditorActionResult<{ versionNumber: number | null }>> {
  const ctx = await context("site.publish");
  if (!ctx) return { ok: false, status: 403, error: "Vous n'avez pas le droit de publier le site." };
  const { tenantId, tenantName } = ctx.membership;
  const tenantSiteId = await ensureTenantEditorSite(tenantId, tenantName);
  const result = await publishSite({ tenantId, tenantSiteId, actorUserId: ctx.userId }, realPublishSiteDeps());
  if (result.outcome === "published") return { ok: true, data: { versionNumber: result.versionNumber } };
  if (result.outcome === "already_in_progress") return { ok: false, status: 409, error: "Une publication est déjà en cours. Réessayez dans un instant." };
  if (result.outcome === "blocked") {
    const reasons = result.report.issues.filter((i) => i.severity === "error").map((i) => i.message);
    return { ok: false, status: 409, error: `Publication impossible : ${reasons.join(" ")}` };
  }
  return { ok: false, status: 409, error: "Publication déjà traitée." };
}
