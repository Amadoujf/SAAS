import "server-only";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import type { DesignTokens } from "@yamacommerce/design-tokens";
import { withTenant, getEnabledModules, getCourierSettings } from "@yamacommerce/database";
import { resolveActiveTenant } from "@/lib/rendering/resolve-public-site";
import { applyBranding, parseHomeContent, type HomeContent } from "@/lib/storefront/home-content";
import { isCourier } from "@/lib/modules/tenant-modules";
import { siteStyleTokens } from "@/lib/site-ai/style-tokens";
import { TRAJET_TOKENS } from "./courier-templates";

export interface CourierContext {
  tenantId: string;
  tenantName: string;
  timezone: string;
  tokens: DesignTokens;
  logoUrl: string | null;
  content: HomeContent;
  contact: { phone: string | null; whatsapp: string | null; email: string | null; address: string | null };
  rules: { publicRequests: boolean; maxCod: number; mediumSurcharge: number; largeSurcharge: number };
  demoData: boolean;
}

export type CourierResolution = { status: "ok"; company: CourierContext } | { status: "suspended"; tenantName: string } | { status: "billing_suspended"; tenantName: string };

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Site public d'une SOCIÉTÉ DE LIVRAISON : mêmes protections que les autres sites, puis modules livraison — sinon 404. */
export async function resolveCourier(path: string): Promise<CourierResolution> {
  const host = (await headers()).get("host") ?? "";
  const active = await resolveActiveTenant(host);
  if (active.status === "not_found") notFound();
  if (active.status === "redirect") permanentRedirect(`https://${active.targetDomain}${path}`);
  if (active.status !== "ok") return active;
  const company = await buildCourierContext(active.tenantId, active.tenantName);
  if (!company) notFound();
  return { status: "ok", company };
}

/** Contexte d'une société de livraison par son identifiant (aperçu du brouillon, sans résolution d'hôte). */
export async function buildCourierContext(tenantId: string, tenantName: string): Promise<CourierContext | null> {
  const data = await withTenant(tenantId, async (tx) => {
    const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { branding: true, isDemo: true, timezone: true } });
    return {
      modules: new Set((await getEnabledModules(tx, tenantId)).map((m) => m.moduleKey)),
      branding: (tenant?.branding ?? {}) as Record<string, unknown>,
      isDemo: tenant?.isDemo === true,
      timezone: tenant?.timezone || "Africa/Dakar",
      content: (await tx.storefrontContent.findUnique({ where: { tenantId } }))?.content ?? null,
      settings: await getCourierSettings(tx, tenantId),
    };
  });
  if (!isCourier(data.modules)) return null;
  // Style choisi par la société (Trajet par défaut, ou un autre style publié depuis « Mon site »).
  const chosen = typeof data.branding.templatePreference === "string" ? siteStyleTokens(data.branding.templatePreference) : null;
  return {
    tenantId,
    tenantName,
    timezone: data.timezone,
    tokens: applyBranding(chosen ?? TRAJET_TOKENS, data.branding),
    logoUrl: str(data.branding.logoUrl),
    content: parseHomeContent(data.content, tenantName),
    contact: { phone: str(data.branding.contactPhone), whatsapp: str(data.branding.contactWhatsapp), email: str(data.branding.contactEmail), address: str(data.branding.contactAddress) },
    rules: { publicRequests: data.settings.publicRequests, maxCod: data.settings.maxCod, mediumSurcharge: data.settings.mediumSurcharge, largeSurcharge: data.settings.largeSurcharge },
    demoData: data.isDemo,
  };
}

export async function isCourierTenant(tenantId: string) {
  const modules = new Set((await withTenant(tenantId, (tx) => getEnabledModules(tx, tenantId))).map((m) => m.moduleKey));
  return isCourier(modules);
}
