import "server-only";
import { getLegalProfile, withTenant, type LegalProfileView } from "@yamacommerce/database";
import { getCurrentTenant } from "@/lib/tenant";

/**
 * Pages légales : le même chemin (/mentions-legales, /conditions-generales,
 * /confidentialite) sert la plateforme ou le site d'une entreprise selon le Host.
 * Rien n'est inventé : un champ absent est affiché comme « non renseigné ».
 */

export interface PlatformLegal {
  brand: string;
  legalName: string | null;
  legalForm: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  ninea: string | null;
  rccm: string | null;
  director: string | null;
  hosting: string;
}

export interface TenantLegal {
  tenantName: string;
  isDemo: boolean;
  profile: LegalProfileView;
  contact: { email: string | null; phone: string | null; address: string | null };
}

export type LegalContext = { kind: "platform"; platform: PlatformLegal } | { kind: "tenant"; platform: PlatformLegal; tenant: TenantLegal };

const env = (key: string) => {
  const v = process.env[key]?.trim();
  return v ? v : null;
};

/** Identité de l'éditeur de la plateforme : variables PLATFORM_LEGAL_* du serveur. */
export function platformLegal(): PlatformLegal {
  return {
    brand: env("PLATFORM_BRAND_NAME") ?? "Y-COM",
    legalName: env("PLATFORM_LEGAL_NAME"),
    legalForm: env("PLATFORM_LEGAL_FORM"),
    address: env("PLATFORM_LEGAL_ADDRESS"),
    email: env("PLATFORM_LEGAL_EMAIL"),
    phone: env("PLATFORM_LEGAL_PHONE"),
    ninea: env("PLATFORM_LEGAL_NINEA"),
    rccm: env("PLATFORM_LEGAL_RCCM"),
    director: env("PLATFORM_LEGAL_DIRECTOR"),
    hosting: env("PLATFORM_HOSTING") ?? "Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen, Allemagne",
  };
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export async function resolveLegalContext(): Promise<LegalContext> {
  const platform = platformLegal();
  const tenant = await getCurrentTenant();
  if (!tenant) return { kind: "platform", platform };
  const profile = await withTenant(tenant.id, (tx) => getLegalProfile(tx, tenant.id));
  const branding = (tenant.branding ?? {}) as Record<string, unknown>;
  return {
    kind: "tenant",
    platform,
    tenant: {
      tenantName: tenant.name,
      isDemo: tenant.isDemo === true,
      profile,
      contact: { email: str(branding.contactEmail), phone: str(branding.contactPhone), address: str(branding.contactAddress) },
    },
  };
}

/** Coordonnées effectives de l'entreprise : sa fiche légale, sinon les contacts de son site. */
export function tenantContact(t: TenantLegal) {
  return {
    name: t.profile.legalName ?? t.tenantName,
    address: t.profile.address ?? t.contact.address,
    email: t.profile.email ?? t.contact.email,
    phone: t.profile.phone ?? t.contact.phone,
  };
}
