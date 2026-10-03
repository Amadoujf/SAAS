import "server-only";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import type { DesignTokens } from "@yamacommerce/design-tokens";
import { withTenant, getEnabledModules, getBookingSettings } from "@yamacommerce/database";
import { resolveActiveTenant } from "@/lib/rendering/resolve-public-site";
import { applyBranding, parseHomeContent, type HomeContent } from "@/lib/storefront/home-content";
import { ECRIN_TOKENS, SALON_TEMPLATES } from "./salon-templates";

export interface SalonContext {
  tenantId: string;
  tenantName: string;
  timezone: string;
  tokens: DesignTokens;
  logoUrl: string | null;
  content: HomeContent;
  contact: { phone: string | null; whatsapp: string | null; email: string | null; address: string | null };
  /** Moyens de paiement acceptés AU SALON (Wave / Orange Money déclarés + espèces). Rien
   *  n'est débité en ligne ; jamais Chariow (abonnements Y-COM). */
  payWays: string[];
  rules: { cancelCutoffHours: number; autoConfirm: boolean; maxAdvanceDays: number; minLeadMinutes: number };
  demoData: boolean;
}

export type SalonResolution =
  | { status: "ok"; salon: SalonContext }
  | { status: "suspended"; tenantName: string }
  | { status: "billing_suspended"; tenantName: string };

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export function isSalonModules(modules: Set<string>) {
  return modules.has("service_catalog") && modules.has("appointments");
}

/**
 * Site public d'un SALON : mêmes protections que les autres sites (domaine, entreprise
 * suspendue, abonnement), puis vérification des modules salon — sinon 404, jamais les
 * pages d'un autre secteur.
 */
export async function resolveSalon(path: string): Promise<SalonResolution> {
  const host = (await headers()).get("host") ?? "";
  const active = await resolveActiveTenant(host);
  if (active.status === "not_found") notFound();
  if (active.status === "redirect") permanentRedirect(`https://${active.targetDomain}${path}`);
  if (active.status !== "ok") return active;
  const data = await withTenant(active.tenantId, async (tx) => {
    const tenant = await tx.tenant.findUnique({ where: { id: active.tenantId }, select: { branding: true, isDemo: true, timezone: true } });
    return {
      modules: new Set((await getEnabledModules(tx, active.tenantId)).map((m) => m.moduleKey)),
      branding: (tenant?.branding ?? {}) as Record<string, unknown>,
      isDemo: tenant?.isDemo === true,
      timezone: tenant?.timezone || "Africa/Dakar",
      content: (await tx.storefrontContent.findUnique({ where: { tenantId: active.tenantId } }))?.content ?? null,
      payments: await tx.paymentProviderConfig.findMany({ where: { tenantId: active.tenantId, provider: { in: ["wave_direct", "orange_money_direct"] }, isEnabled: true }, select: { provider: true } }),
      settings: await getBookingSettings(tx, active.tenantId),
    };
  });
  if (!isSalonModules(data.modules)) notFound();
  const template = SALON_TEMPLATES.find((t) => t.slug === data.branding.templatePreference);
  return {
    status: "ok",
    salon: {
      tenantId: active.tenantId,
      tenantName: active.tenantName,
      timezone: data.timezone,
      tokens: applyBranding(template?.tokens ?? ECRIN_TOKENS, data.branding),
      logoUrl: str(data.branding.logoUrl),
      content: parseHomeContent(data.content, active.tenantName),
      contact: { phone: str(data.branding.contactPhone), whatsapp: str(data.branding.contactWhatsapp), email: str(data.branding.contactEmail), address: str(data.branding.contactAddress) },
      payWays: ["Espèces", ...data.payments.map((p) => (p.provider === "wave_direct" ? "Wave" : "Orange Money"))],
      rules: { cancelCutoffHours: data.settings.cancelCutoffHours, autoConfirm: data.settings.autoConfirm, maxAdvanceDays: data.settings.maxAdvanceDays, minLeadMinutes: data.settings.minLeadMinutes },
      demoData: data.isDemo,
    },
  };
}

/** L'entreprise du domaine courant est-elle un salon ? (accueil `/`) */
export async function isSalonTenant(tenantId: string) {
  const modules = new Set((await withTenant(tenantId, (tx) => getEnabledModules(tx, tenantId))).map((m) => m.moduleKey));
  return isSalonModules(modules);
}
