import "server-only";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import type { DesignTokens } from "@yamacommerce/design-tokens";
import { withTenant, getEnabledModules, getHotelSettings } from "@yamacommerce/database";
import { resolveActiveTenant } from "@/lib/rendering/resolve-public-site";
import { applyBranding, parseHomeContent, type HomeContent } from "@/lib/storefront/home-content";
import { HOTEL_TEMPLATES, PALMERAIE_TOKENS } from "./hotel-templates";

export interface HotelContext {
  tenantId: string;
  tenantName: string;
  timezone: string;
  tokens: DesignTokens;
  logoUrl: string | null;
  content: HomeContent;
  contact: { phone: string | null; whatsapp: string | null; email: string | null; address: string | null };
  /** Moyens de règlement déclarés (Wave / Orange Money) + sur place. Jamais Chariow. */
  payWays: string[];
  rules: { autoConfirm: boolean; cancelFreeHours: number; maxAdvanceDays: number; maxNights: number };
  demoData: boolean;
}

export type HotelResolution =
  | { status: "ok"; hotel: HotelContext }
  | { status: "suspended"; tenantName: string }
  | { status: "billing_suspended"; tenantName: string };

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export function isHotelModules(modules: Set<string>) {
  return modules.has("listings") && modules.has("availability_calendar");
}

/** Site public d'un HÔTEL : mêmes protections que les autres sites, puis modules hôtel — sinon 404. */
export async function resolveHotel(path: string): Promise<HotelResolution> {
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
      settings: await getHotelSettings(tx, active.tenantId),
    };
  });
  if (!isHotelModules(data.modules)) notFound();
  const template = HOTEL_TEMPLATES.find((t) => t.slug === data.branding.templatePreference);
  return {
    status: "ok",
    hotel: {
      tenantId: active.tenantId,
      tenantName: active.tenantName,
      timezone: data.timezone,
      tokens: applyBranding(template?.tokens ?? PALMERAIE_TOKENS, data.branding),
      logoUrl: str(data.branding.logoUrl),
      content: parseHomeContent(data.content, active.tenantName),
      contact: { phone: str(data.branding.contactPhone), whatsapp: str(data.branding.contactWhatsapp), email: str(data.branding.contactEmail), address: str(data.branding.contactAddress) },
      payWays: [...data.payments.map((p) => (p.provider === "wave_direct" ? "Wave" : "Orange Money")), "espèces ou carte sur place"],
      rules: { autoConfirm: data.settings.autoConfirm, cancelFreeHours: data.settings.cancelFreeHours, maxAdvanceDays: data.settings.maxAdvanceDays, maxNights: data.settings.maxNights },
      demoData: data.isDemo,
    },
  };
}

export async function isHotelTenant(tenantId: string) {
  const modules = new Set((await withTenant(tenantId, (tx) => getEnabledModules(tx, tenantId))).map((m) => m.moduleKey));
  return isHotelModules(modules);
}
