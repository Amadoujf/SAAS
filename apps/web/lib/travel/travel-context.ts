import "server-only";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import type { DesignTokens } from "@yamacommerce/design-tokens";
import { withTenant, getEnabledModules } from "@yamacommerce/database";
import { resolveActiveTenant } from "@/lib/rendering/resolve-public-site";
import { applyBranding, parseHomeContent, type HomeContent } from "@/lib/storefront/home-content";
import { HORIZONS_TOKENS, TRAVEL_TEMPLATES } from "./travel-templates";

export interface PaymentChannel {
  provider: "wave_direct" | "orange_money_direct";
  label: string;
  accountNumber: string;
  accountHolderName: string | null;
  instructions: string | null;
}

export interface TravelContext {
  tenantId: string;
  tenantName: string;
  tokens: DesignTokens;
  logoUrl: string | null;
  content: HomeContent;
  contact: { phone: string | null; whatsapp: string | null; email: string | null; address: string | null };
  /** Comptes Wave / Orange Money déclarés par l'agence (page Paiements) — les seuls
   *  moyens affichés pour régler un acompte. Jamais Chariow (abonnements Y-COM). */
  paymentChannels: PaymentChannel[];
  demoData: boolean;
}

export type TravelResolution =
  | { status: "ok"; travel: TravelContext }
  | { status: "suspended"; tenantName: string }
  | { status: "billing_suspended"; tenantName: string };

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export function isTravelModules(modules: Set<string>) {
  return modules.has("listings") && modules.has("departures");
}

/**
 * Site public d'une AGENCE DE VOYAGE : mêmes protections que la boutique (domaine,
 * entreprise suspendue, abonnement), puis vérification des modules voyage — sinon 404,
 * jamais les pages d'un autre secteur.
 */
export async function resolveTravel(path: string): Promise<TravelResolution> {
  const host = (await headers()).get("host") ?? "";
  const active = await resolveActiveTenant(host);
  if (active.status === "not_found") notFound();
  if (active.status === "redirect") permanentRedirect(`https://${active.targetDomain}${path}`);
  if (active.status !== "ok") return active;
  const data = await withTenant(active.tenantId, async (tx) => {
    const tenant = await tx.tenant.findUnique({ where: { id: active.tenantId }, select: { branding: true, isDemo: true } });
    return {
      modules: new Set((await getEnabledModules(tx, active.tenantId)).map((m) => m.moduleKey)),
      branding: (tenant?.branding ?? {}) as Record<string, unknown>,
      isDemo: tenant?.isDemo === true,
      content: (await tx.storefrontContent.findUnique({ where: { tenantId: active.tenantId } }))?.content ?? null,
      payments: await tx.paymentProviderConfig.findMany({ where: { tenantId: active.tenantId, provider: { in: ["wave_direct", "orange_money_direct"] }, isEnabled: true } }),
    };
  });
  if (!isTravelModules(data.modules)) notFound();
  const template = TRAVEL_TEMPLATES.find((t) => t.slug === data.branding.templatePreference);
  return {
    status: "ok",
    travel: {
      tenantId: active.tenantId,
      tenantName: active.tenantName,
      tokens: applyBranding(template?.tokens ?? HORIZONS_TOKENS, data.branding),
      logoUrl: str(data.branding.logoUrl),
      content: parseHomeContent(data.content, active.tenantName),
      contact: { phone: str(data.branding.contactPhone), whatsapp: str(data.branding.contactWhatsapp), email: str(data.branding.contactEmail), address: str(data.branding.contactAddress) },
      paymentChannels: data.payments
        .filter((p) => p.accountNumber)
        .map((p) => ({
          provider: p.provider as PaymentChannel["provider"],
          label: p.provider === "wave_direct" ? "Wave" : "Orange Money",
          accountNumber: p.accountNumber!,
          accountHolderName: p.accountHolderName,
          instructions: p.publicInstructions,
        })),
      demoData: data.isDemo,
    },
  };
}

/** L'entreprise du domaine courant est-elle une agence de voyage ? (accueil `/`) */
export async function isTravelTenant(tenantId: string) {
  const modules = new Set((await withTenant(tenantId, (tx) => getEnabledModules(tx, tenantId))).map((m) => m.moduleKey));
  return isTravelModules(modules);
}
