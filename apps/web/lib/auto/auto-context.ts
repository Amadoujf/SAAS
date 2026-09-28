import "server-only";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import type { DesignTokens } from "@yamacommerce/design-tokens";
import { withTenant, getEnabledModules, getAutoSettings, type ShowroomHours } from "@yamacommerce/database";
import { resolveActiveTenant } from "@/lib/rendering/resolve-public-site";
import { applyBranding, parseHomeContent, type HomeContent } from "@/lib/storefront/home-content";
import { isAutomobile } from "@/lib/modules/tenant-modules";
import { AUTO_TEMPLATES, PISTE_TOKENS } from "./auto-templates";

export interface AutoContext {
  tenantId: string;
  tenantName: string;
  timezone: string;
  tokens: DesignTokens;
  logoUrl: string | null;
  content: HomeContent;
  contact: { phone: string | null; whatsapp: string | null; email: string | null; address: string | null };
  rules: { openingHours: ShowroomHours[]; testDriveMinutes: number; maxAdvanceDays: number; depositPercent: number; importTracking: boolean };
  demoData: boolean;
}

export type AutoResolution = { status: "ok"; auto: AutoContext } | { status: "suspended"; tenantName: string } | { status: "billing_suspended"; tenantName: string };

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Site public d'une CONCESSION : mêmes protections que les autres sites, puis modules automobile — sinon 404. */
export async function resolveAuto(path: string): Promise<AutoResolution> {
  const host = (await headers()).get("host") ?? "";
  const active = await resolveActiveTenant(host);
  if (active.status === "not_found") notFound();
  if (active.status === "redirect") permanentRedirect(`https://${active.targetDomain}${path}`);
  if (active.status !== "ok") return active;
  const auto = await buildAutoContext(active.tenantId, active.tenantName);
  if (!auto) notFound();
  return { status: "ok", auto };
}

/** Contexte d'une concession par son identifiant (aperçu du brouillon, sans résolution d'hôte). */
export async function buildAutoContext(tenantId: string, tenantName: string): Promise<AutoContext | null> {
  const data = await withTenant(tenantId, async (tx) => {
    const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { branding: true, isDemo: true, timezone: true } });
    return {
      modules: new Set((await getEnabledModules(tx, tenantId)).map((m) => m.moduleKey)),
      branding: (tenant?.branding ?? {}) as Record<string, unknown>,
      isDemo: tenant?.isDemo === true,
      timezone: tenant?.timezone || "Africa/Dakar",
      content: (await tx.storefrontContent.findUnique({ where: { tenantId } }))?.content ?? null,
      settings: await getAutoSettings(tx, tenantId),
    };
  });
  if (!isAutomobile(data.modules)) return null;
  const template = AUTO_TEMPLATES.find((t) => t.slug === data.branding.templatePreference);
  return {
    tenantId,
    tenantName,
    timezone: data.timezone,
    tokens: applyBranding(template?.tokens ?? PISTE_TOKENS, data.branding),
    logoUrl: str(data.branding.logoUrl),
    content: parseHomeContent(data.content, tenantName),
    contact: { phone: str(data.branding.contactPhone), whatsapp: str(data.branding.contactWhatsapp), email: str(data.branding.contactEmail), address: str(data.branding.contactAddress) },
    rules: {
      openingHours: data.settings.openingHours,
      testDriveMinutes: data.settings.testDriveMinutes,
      maxAdvanceDays: data.settings.maxAdvanceDays,
      depositPercent: data.settings.depositPercent,
      importTracking: data.modules.has("import_tracking"),
    },
    demoData: data.isDemo,
  };
}

export async function isAutoTenant(tenantId: string) {
  const modules = new Set((await withTenant(tenantId, (tx) => getEnabledModules(tx, tenantId))).map((m) => m.moduleKey));
  return isAutomobile(modules);
}
