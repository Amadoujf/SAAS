import "server-only";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import type { DesignTokens } from "@yamacommerce/design-tokens";
import { withTenant, getEnabledModules } from "@yamacommerce/database";
import { resolveActiveTenant } from "@/lib/rendering/resolve-public-site";
import { applyBranding, parseHomeContent, type HomeContent } from "@/lib/storefront/home-content";
import { ESTATE_TEMPLATES, RESIDENCES_TOKENS } from "./estate-templates";

export interface EstateContext {
  tenantId: string;
  tenantName: string;
  tokens: DesignTokens;
  logoUrl: string | null;
  content: HomeContent;
  contact: { phone: string | null; whatsapp: string | null; email: string | null; address: string | null };
  demoData: boolean;
}

export type EstateResolution =
  | { status: "ok"; estate: EstateContext }
  | { status: "suspended"; tenantName: string }
  | { status: "billing_suspended"; tenantName: string };

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/**
 * Résolution du site public d'une AGENCE IMMOBILIÈRE : mêmes protections que la
 * boutique (domaine, entreprise suspendue, abonnement), puis vérification que
 * l'entreprise a bien les modules immobiliers — sinon 404, jamais les pages d'un
 * autre secteur.
 */
export async function resolveEstate(path: string): Promise<EstateResolution> {
  const host = (await headers()).get("host") ?? "";
  const active = await resolveActiveTenant(host);
  if (active.status === "not_found") notFound();
  if (active.status === "redirect") permanentRedirect(`https://${active.targetDomain}${path}`);
  if (active.status !== "ok") return active;
  const { modules, branding, content } = await withTenant(active.tenantId, async (tx) => ({
    modules: new Set((await getEnabledModules(tx, active.tenantId)).map((m) => m.moduleKey)),
    branding: ((await tx.tenant.findUnique({ where: { id: active.tenantId }, select: { branding: true } }))?.branding ?? {}) as Record<string, unknown>,
    content: (await tx.storefrontContent.findUnique({ where: { tenantId: active.tenantId } }))?.content ?? null,
  }));
  if (!modules.has("listings") || !(modules.has("leases") || modules.has("visit_requests"))) notFound();
  const template = ESTATE_TEMPLATES.find((t) => t.slug === branding.templatePreference);
  return {
    status: "ok",
    estate: {
      tenantId: active.tenantId,
      tenantName: active.tenantName,
      tokens: applyBranding(template?.tokens ?? RESIDENCES_TOKENS, branding),
      logoUrl: str(branding.logoUrl),
      content: parseHomeContent(content, active.tenantName),
      contact: { phone: str(branding.contactPhone), whatsapp: str(branding.contactWhatsapp), email: str(branding.contactEmail), address: str(branding.contactAddress) },
      demoData: branding.demoData === true,
    },
  };
}

/** L'entreprise du domaine courant est-elle une agence immobilière ? (accueil `/`) */
export async function isEstateTenant(tenantId: string) {
  const modules = new Set((await withTenant(tenantId, (tx) => getEnabledModules(tx, tenantId))).map((m) => m.moduleKey));
  return modules.has("listings") && (modules.has("leases") || modules.has("visit_requests"));
}
