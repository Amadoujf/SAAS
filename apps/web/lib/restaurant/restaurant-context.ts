import "server-only";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import type { DesignTokens } from "@yamacommerce/design-tokens";
import { withTenant, getEnabledModules, getRestaurantSettings, type OpeningRange } from "@yamacommerce/database";
import { resolveActiveTenant } from "@/lib/rendering/resolve-public-site";
import { applyBranding, parseHomeContent, type HomeContent } from "@/lib/storefront/home-content";
import { isRestaurant } from "@/lib/modules/tenant-modules";
import { BRAISE_TOKENS } from "./restaurant-templates";
import { siteStyleTokens } from "@/lib/site-ai/style-tokens";

export interface RestaurantRules {
  openingHours: OpeningRange[];
  acceptTakeaway: boolean;
  acceptDelivery: boolean;
  acceptDineInQr: boolean;
  acceptBookings: boolean;
  deliveryFee: number;
  minDeliveryOrder: number;
  prepMinutes: number;
  maxPartySize: number;
}

export interface RestaurantContext {
  tenantId: string;
  tenantName: string;
  timezone: string;
  tokens: DesignTokens;
  logoUrl: string | null;
  content: HomeContent;
  contact: { phone: string | null; whatsapp: string | null; email: string | null; address: string | null };
  /** Moyens de règlement déclarés (Wave / Orange Money) + sur place. Jamais Chariow. */
  payWays: string[];
  rules: RestaurantRules;
  demoData: boolean;
}

export type RestaurantResolution =
  | { status: "ok"; restaurant: RestaurantContext }
  | { status: "suspended"; tenantName: string }
  | { status: "billing_suspended"; tenantName: string };

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Site public d'un RESTAURANT : mêmes protections que les autres sites, puis modules restaurant — sinon 404. */
export async function resolveRestaurant(path: string): Promise<RestaurantResolution> {
  const host = (await headers()).get("host") ?? "";
  const active = await resolveActiveTenant(host);
  if (active.status === "not_found") notFound();
  if (active.status === "redirect") permanentRedirect(`https://${active.targetDomain}${path}`);
  if (active.status !== "ok") return active;
  const restaurant = await buildRestaurantContext(active.tenantId, active.tenantName);
  if (!restaurant) notFound();
  return { status: "ok", restaurant };
}

/** Contexte d'un restaurant par son identifiant (aperçu du brouillon, sans résolution d'hôte). */
export async function buildRestaurantContext(tenantId: string, tenantName: string): Promise<RestaurantContext | null> {
  const data = await withTenant(tenantId, async (tx) => {
    const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { branding: true, isDemo: true, timezone: true } });
    return {
      modules: new Set((await getEnabledModules(tx, tenantId)).map((m) => m.moduleKey)),
      branding: (tenant?.branding ?? {}) as Record<string, unknown>,
      isDemo: tenant?.isDemo === true,
      timezone: tenant?.timezone || "Africa/Dakar",
      content: (await tx.storefrontContent.findUnique({ where: { tenantId: tenantId } }))?.content ?? null,
      payments: await tx.paymentProviderConfig.findMany({ where: { tenantId: tenantId, provider: { in: ["wave_direct", "orange_money_direct"] }, isEnabled: true }, select: { provider: true } }),
      settings: await getRestaurantSettings(tx, tenantId),
    };
  });
  if (!isRestaurant(data.modules)) return null;
  // Style choisi par le restaurant (Braise par défaut, ou un autre style publié depuis « Mon site »).
  const chosen = typeof data.branding.templatePreference === "string" ? siteStyleTokens(data.branding.templatePreference) : null;
  const s = data.settings;
  return {
      tenantId: tenantId,
      tenantName: tenantName,
      timezone: data.timezone,
      tokens: applyBranding(chosen ?? BRAISE_TOKENS, data.branding),
      logoUrl: str(data.branding.logoUrl),
      content: parseHomeContent(data.content, tenantName),
      contact: { phone: str(data.branding.contactPhone), whatsapp: str(data.branding.contactWhatsapp), email: str(data.branding.contactEmail), address: str(data.branding.contactAddress) },
      payWays: [...data.payments.map((p) => (p.provider === "wave_direct" ? "Wave" : "Orange Money")), "espèces"],
      rules: {
        openingHours: s.openingHours,
        acceptTakeaway: s.acceptTakeaway,
        acceptDelivery: s.acceptDelivery,
        acceptDineInQr: s.acceptDineInQr,
        acceptBookings: s.acceptBookings,
        deliveryFee: s.deliveryFee,
        minDeliveryOrder: s.minDeliveryOrder,
        prepMinutes: s.prepMinutes,
        maxPartySize: s.maxPartySize,
      },
    demoData: data.isDemo,
  };
}


export async function isRestaurantTenant(tenantId: string) {
  const modules = new Set((await withTenant(tenantId, (tx) => getEnabledModules(tx, tenantId))).map((m) => m.moduleKey));
  return isRestaurant(modules);
}
