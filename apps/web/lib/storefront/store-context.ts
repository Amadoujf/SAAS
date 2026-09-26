import "server-only";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import type { DesignTokens } from "@yamacommerce/design-tokens";
import { withTenant, resolveEffectiveDesignTokens, listCategories } from "@yamacommerce/database";
import { resolveActiveTenant } from "@/lib/rendering/resolve-public-site";
import { templateTokens } from "./store-templates";

export interface StoreContext {
  tenantId: string;
  tenantName: string;
  tokens: DesignTokens;
  categories: { slug: string; name: string }[];
  logoUrl: string | null;
}

export type StoreResolution =
  | { status: "ok"; store: StoreContext }
  | { status: "suspended"; tenantName: string }
  | { status: "billing_suspended"; tenantName: string };

/** Résolution UNIQUE de la boutique pour les routes commerce (catalogue, fiche,
 *  panier, checkout, suivi) : mêmes protections domaine/tenant suspendu que le reste
 *  du site public, puis design tokens EFFECTIFS de l'entreprise (template + ses
 *  personnalisations). */
export async function resolveStore(path: string): Promise<StoreResolution> {
  const host = (await headers()).get("host") ?? "";
  const active = await resolveActiveTenant(host);
  if (active.status === "not_found") notFound();
  if (active.status === "redirect") permanentRedirect(`https://${active.targetDomain}${path}`);
  if (active.status !== "ok") return active;
  const { tokens, categories, branding, hasSite } = await withTenant(active.tenantId, async (tx) => ({
    tokens: await resolveEffectiveDesignTokens(tx, active.tenantId),
    hasSite: (await tx.tenantSite.count({ where: { tenantId: active.tenantId } })) > 0,
    categories: await listCategories(tx, active.tenantId),
    branding: (await tx.tenant.findUnique({ where: { id: active.tenantId }, select: { branding: true } }))?.branding as { logoUrl?: string; templatePreference?: string } | null,
  }));
  return {
    status: "ok",
    store: {
      tenantId: active.tenantId,
      tenantName: active.tenantName,
      // Site publié depuis l'éditeur : ses tokens font foi. Sinon, le style choisi à
      // l'onboarding (template complet), sinon les tokens par défaut.
      tokens: hasSite ? tokens : templateTokens(branding?.templatePreference) ?? tokens,
      categories: categories.map((c) => ({ slug: c.slug, name: c.name })),
      logoUrl: branding?.logoUrl ?? null,
    },
  };
}
