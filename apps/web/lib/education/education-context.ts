import "server-only";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import type { DesignTokens } from "@yamacommerce/design-tokens";
import { withTenant, getEnabledModules, getEducationSettings } from "@yamacommerce/database";
import { resolveActiveTenant } from "@/lib/rendering/resolve-public-site";
import { applyBranding, parseHomeContent, type HomeContent } from "@/lib/storefront/home-content";
import { isEducation } from "@/lib/modules/tenant-modules";
import { siteStyleTokens } from "@/lib/site-ai/style-tokens";
import { PREAU_TOKENS } from "./education-templates";

export interface EducationContext {
  tenantId: string;
  tenantName: string;
  timezone: string;
  tokens: DesignTokens;
  logoUrl: string | null;
  content: HomeContent;
  contact: { phone: string | null; whatsapp: string | null; email: string | null; address: string | null };
  rules: { academicYear: string; onlineEnrollment: boolean; gradeScale: number };
  demoData: boolean;
}

export type EducationResolution = { status: "ok"; school: EducationContext } | { status: "suspended"; tenantName: string } | { status: "billing_suspended"; tenantName: string };

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Site public d'un ÉTABLISSEMENT : mêmes protections que les autres sites, puis modules éducation — sinon 404. */
export async function resolveEducation(path: string): Promise<EducationResolution> {
  const host = (await headers()).get("host") ?? "";
  const active = await resolveActiveTenant(host);
  if (active.status === "not_found") notFound();
  if (active.status === "redirect") permanentRedirect(`https://${active.targetDomain}${path}`);
  if (active.status !== "ok") return active;
  const school = await buildEducationContext(active.tenantId, active.tenantName);
  if (!school) notFound();
  return { status: "ok", school };
}

/** Contexte d'un établissement par son identifiant (aperçu du brouillon, sans résolution d'hôte). */
export async function buildEducationContext(tenantId: string, tenantName: string): Promise<EducationContext | null> {
  const data = await withTenant(tenantId, async (tx) => {
    const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { branding: true, isDemo: true, timezone: true } });
    return {
      modules: new Set((await getEnabledModules(tx, tenantId)).map((m) => m.moduleKey)),
      branding: (tenant?.branding ?? {}) as Record<string, unknown>,
      isDemo: tenant?.isDemo === true,
      timezone: tenant?.timezone || "Africa/Dakar",
      content: (await tx.storefrontContent.findUnique({ where: { tenantId } }))?.content ?? null,
      settings: await getEducationSettings(tx, tenantId),
    };
  });
  if (!isEducation(data.modules)) return null;
  // Style choisi par l'établissement (Préau par défaut, ou un autre style publié depuis « Mon site »).
  const chosen = typeof data.branding.templatePreference === "string" ? siteStyleTokens(data.branding.templatePreference) : null;
  return {
    tenantId,
    tenantName,
    timezone: data.timezone,
    tokens: applyBranding(chosen ?? PREAU_TOKENS, data.branding),
    logoUrl: str(data.branding.logoUrl),
    content: parseHomeContent(data.content, tenantName),
    contact: { phone: str(data.branding.contactPhone), whatsapp: str(data.branding.contactWhatsapp), email: str(data.branding.contactEmail), address: str(data.branding.contactAddress) },
    rules: { academicYear: data.settings.academicYear, onlineEnrollment: data.settings.onlineEnrollment, gradeScale: data.settings.gradeScale },
    demoData: data.isDemo,
  };
}

export async function isEducationTenant(tenantId: string) {
  const modules = new Set((await withTenant(tenantId, (tx) => getEnabledModules(tx, tenantId))).map((m) => m.moduleKey));
  return isEducation(modules);
}
