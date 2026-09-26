import "server-only";
import { z } from "zod";
import type { Prisma } from "@yamacommerce/database";
import { withTenant, updateTenantBranding, saveStorefrontContent, setMediaAssetPublic } from "@yamacommerce/database";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { requireTenantPermission } from "@/lib/tenant-permissions";
import { STORE_TEMPLATES } from "./store-templates";
import { homeContentSchema, validateBrandColor } from "./home-content";

export const siteSettingsSchema = z.object({
  templatePreference: z.string().refine((s) => STORE_TEMPLATES.some((t) => t.slug === s), "Template inconnu."),
  logoUrl: z.string().trim().max(300).nullable(),
  primaryColor: z.string().nullable(),
  accentColor: z.string().nullable(),
  content: homeContentSchema,
});
export type SiteSettingsInput = z.infer<typeof siteSettingsSchema>;

const MEDIA_URL = /^\/api\/media\/([0-9a-f-]{36})\/file(?:\?variant=(?:thumbnail|small|medium|large))?$/;
const DEMO_URL = /^\/demo-templates\/[a-z0-9-]+\/[a-z0-9-]+\.webp$/;

/** Une image de la boutique vient de la médiathèque de l'entreprise, des visuels de
 *  démonstration, ou d'une adresse https — jamais d'un autre chemin de l'application. */
function checkImage(url: string | null | undefined, mediaIds: Set<string>): string | null {
  if (!url) return null;
  const media = url.match(MEDIA_URL);
  if (media) {
    mediaIds.add(media[1]!);
    return null;
  }
  if (DEMO_URL.test(url) || /^https:\/\/[^\s]+$/.test(url)) return null;
  return "Image invalide : choisissez-la dans la médiathèque.";
}

export type SiteSettingsResult = { ok: true } | { ok: false; status: number; error: string };

export async function saveSiteSettings(raw: unknown): Promise<SiteSettingsResult> {
  const membership = await getCurrentTenantMembership();
  if (!membership) return { ok: false, status: 403, error: "Action non autorisée." };
  const actor = await requireTenantPermission(membership.tenantId, "settings.branding");
  if (!actor) return { ok: false, status: 403, error: "Action non autorisée." };

  const parsed = siteSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, status: 400, error: issue ? `${issue.path.join(" › ")} : ${issue.message}` : "Données invalides." };
  }
  const input = parsed.data;
  for (const color of [input.primaryColor, input.accentColor]) {
    if (color) {
      const problem = validateBrandColor(color);
      if (problem) return { ok: false, status: 400, error: problem };
    }
  }

  const mediaIds = new Set<string>();
  const images = [
    input.logoUrl,
    ...input.content.hero.slides.flatMap((s) => [s.imageUrl, s.mobileImageUrl]),
    ...input.content.collections.map((c) => c.imageUrl),
  ];
  for (const url of images) {
    const problem = checkImage(url, mediaIds);
    if (problem) return { ok: false, status: 400, error: problem };
  }

  const tenantId = membership.tenantId;
  try {
    await withTenant(tenantId, async (tx) => {
      // Tout identifiant référencé doit appartenir à CETTE entreprise (RLS + filtre).
      const productIds = [...new Set([...input.content.featuredProductIds, ...input.content.hero.slides.map((s) => s.productId).filter((id): id is string => !!id)])];
      if (productIds.length && (await tx.product.count({ where: { tenantId, id: { in: productIds }, deletedAt: null } })) !== productIds.length) {
        throw new Error("Un produit sélectionné n'existe plus.");
      }
      const categoryIds = [...new Set(input.content.featuredCategoryIds)];
      if (categoryIds.length && (await tx.category.count({ where: { tenantId, id: { in: categoryIds } } })) !== categoryIds.length) {
        throw new Error("Une catégorie sélectionnée n'existe plus.");
      }
      if (mediaIds.size && (await tx.mediaAsset.count({ where: { tenantId, id: { in: [...mediaIds] }, status: "READY" } })) !== mediaIds.size) {
        throw new Error("Une image choisie n'est plus disponible dans la médiathèque.");
      }
      // Visibles par les visiteurs de la boutique (même mécanisme que la publication).
      for (const id of mediaIds) await setMediaAssetPublic(tx, tenantId, id, true);
      await updateTenantBranding(tx, tenantId, {
        templatePreference: input.templatePreference,
        logoUrl: input.logoUrl,
        primaryColor: input.primaryColor,
        accentColor: input.accentColor,
      });
      await saveStorefrontContent(tx, tenantId, input.content as unknown as Prisma.InputJsonValue, actor.userId);
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, status: 409, error: error instanceof Error ? error.message : "Enregistrement impossible." };
  }
}
