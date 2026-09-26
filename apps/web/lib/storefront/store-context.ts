import "server-only";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import type { DesignTokens } from "@yamacommerce/design-tokens";
import { withTenant, resolveEffectiveDesignTokens, listCategories } from "@yamacommerce/database";
import { resolveActiveTenant } from "@/lib/rendering/resolve-public-site";
import { templateLayout, templateTokens, type StoreLayout } from "./store-templates";
import { applyBranding, parseHomeContent } from "./home-content";

export interface StoreContext {
  tenantId: string;
  tenantName: string;
  tokens: DesignTokens;
  categories: { id: string; slug: string; name: string; imageUrl: string | null }[];
  logoUrl: string | null;
  /** Template choisi (aucun site publié depuis l'éditeur) : composition de l'accueil. */
  templateSlug: string | null;
  layout: StoreLayout;
  demoData: boolean;
  announcement: { text: string; href: string } | null;
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
  const { tokens, categories, branding, hasSite, content } = await withTenant(active.tenantId, async (tx) => ({
    content: (await tx.storefrontContent.findUnique({ where: { tenantId: active.tenantId } }))?.content ?? null,
    tokens: await resolveEffectiveDesignTokens(tx, active.tenantId),
    // Seul un site PUBLIÉ depuis l'éditeur impose ses tokens ; sinon le template choisi.
    hasSite: (await tx.tenantSite.count({ where: { tenantId: active.tenantId, isPublished: true } })) > 0,
    categories: await listCategories(tx, active.tenantId),
    branding: (await tx.tenant.findUnique({ where: { id: active.tenantId }, select: { branding: true } }))?.branding as
      | { logoUrl?: string; templatePreference?: string; primaryColor?: string; accentColor?: string; demoData?: boolean }
      | null,
  }));
  return {
    status: "ok",
    store: {
      tenantId: active.tenantId,
      tenantName: active.tenantName,
      // Site publié depuis l'éditeur : ses tokens font foi. Sinon, le style choisi à
      // l'onboarding (template complet), sinon les tokens par défaut.
      tokens: hasSite ? tokens : applyBranding(templateTokens(branding?.templatePreference) ?? tokens, branding ?? {}),
      categories: categories.map((c) => ({ id: c.id, slug: c.slug, name: c.name, imageUrl: c.imageUrl })),
      logoUrl: branding?.logoUrl ?? null,
      templateSlug: branding?.templatePreference ?? null,
      layout: templateLayout(branding?.templatePreference),
      demoData: branding?.demoData === true,
      announcement: parseHomeContent(content, active.tenantName).announcement,
    },
  };
}
