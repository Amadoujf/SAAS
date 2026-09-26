import { hashPassword } from "@yamacommerce/auth";
import { prisma } from "./client";
import { withSuperAdminAccess } from "./tenant-context";
import { activateSectorDefaults } from "./modules-registry";

/**
 * Création d'une entreprise par son propriétaire (onboarding public). Opération
 * plateforme par nature — sous RLS elle exige un accès élevé, exactement comme le
 * provisionnement du seed (voir `seed.ts`, `seedDemoTenant`) : tenant ACTIF, modules
 * par défaut du secteur, sous-domaine offert, essai gratuit sur la formule choisie,
 * rattachement du propriétaire, paiement à la livraison activé.
 *
 * Aucune donnée n'est créée à moitié : tout se fait dans UNE transaction.
 */

export class ProvisioningError extends Error {
  constructor(public readonly field: "email" | "subdomain" | "sector" | "plan" | "password" | "name", message: string) {
    super(message);
    this.name = "ProvisioningError";
  }
}

export interface OwnerAccountInput {
  email: string;
  fullName: string;
  password: string;
}

/** Crée le compte du propriétaire. Refuse un e-mail déjà utilisé (jamais de prise de
 *  contrôle d'un compte existant par l'onboarding). */
export async function createOwnerAccount(input: OwnerAccountInput) {
  const email = input.email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new ProvisioningError("email", "Adresse e-mail invalide.");
  if (input.fullName.trim().length < 2) throw new ProvisioningError("name", "Indiquez votre nom.");
  if (input.password.length < 8) throw new ProvisioningError("password", "Le mot de passe doit contenir au moins 8 caractères.");
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ProvisioningError("email", "Un compte existe déjà avec cet e-mail : connectez-vous.");
  return prisma.user.create({ data: { email, fullName: input.fullName.trim(), passwordHash: await hashPassword(input.password) } });
}

export interface ProvisionTenantInput {
  ownerUserId: string;
  name: string;
  subdomain: string;
  subdomainSuffix: string;
  sectorKey: string;
  planName?: string | null;
  templatePreference?: string | null;
}

export async function isSubdomainTaken(subdomain: string, suffix: string): Promise<boolean> {
  return withSuperAdminAccess(async (tx) => {
    const [tenant, domain] = await Promise.all([
      tx.tenant.findUnique({ where: { slug: subdomain } }),
      tx.domain.findUnique({ where: { domain: `${subdomain}.${suffix}` } }),
    ]);
    return !!tenant || !!domain;
  });
}

export async function provisionTenantForOwner(input: ProvisionTenantInput) {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) throw new ProvisioningError("name", "Le nom de l'entreprise doit contenir 2 à 80 caractères.");
  return withSuperAdminAccess(async (tx) => {
    const sector = await tx.sector.findUnique({ where: { key: input.sectorKey } });
    if (!sector) throw new ProvisioningError("sector", "Secteur inconnu.");
    const plan = input.planName
      ? await tx.subscriptionPlan.findFirst({ where: { name: input.planName, status: "PUBLISHED" } })
      : await tx.subscriptionPlan.findFirst({ where: { status: "PUBLISHED" }, orderBy: { priceMonthly: "asc" } });
    if (!plan) throw new ProvisioningError("plan", "Formule indisponible.");
    const ownerRole = await tx.role.findFirst({ where: { tenantId: null, name: "OWNER" } });
    if (!ownerRole) throw new Error("Rôle système OWNER absent — lancez le seed de base.");

    const domainName = `${input.subdomain}.${input.subdomainSuffix}`;
    if ((await tx.tenant.findUnique({ where: { slug: input.subdomain } })) || (await tx.domain.findUnique({ where: { domain: domainName } }))) {
      throw new ProvisioningError("subdomain", "Cette adresse vient d'être prise : choisissez-en une autre.");
    }

    const trialEnd = new Date(Date.now() + plan.trialDays * 86_400_000);
    const tenant = await tx.tenant.create({
      data: {
        slug: input.subdomain,
        name,
        businessType: "ECOMMERCE",
        sectorKey: sector.key,
        status: "ACTIVE",
        branding: input.templatePreference ? { templatePreference: input.templatePreference } : {},
        trialEndsAt: trialEnd,
      },
    });
    await activateSectorDefaults(tx, tenant.id, sector.key);
    await tx.domain.create({
      data: {
        tenantId: tenant.id,
        domain: domainName,
        type: "subdomain",
        isPrimary: true,
        serveDirectlyWhenNotPrimary: true,
        lifecycleStatus: "ACTIVE",
        dnsProvider: "caddy",
      },
    });
    await tx.tenantSubscription.create({
      data: {
        tenantId: tenant.id,
        planId: plan.id,
        status: "TRIALING",
        billingCycle: "MONTHLY",
        currentPeriodStart: new Date(),
        currentPeriodEnd: trialEnd,
      },
    });
    await tx.tenantUser.create({
      data: { tenantId: tenant.id, userId: input.ownerUserId, roleId: ownerRole.id, status: "ACTIVE", joinedAt: new Date() },
    });
    await tx.paymentProviderConfig.create({
      data: { tenantId: tenant.id, provider: "cod", isEnabled: true, mode: "live", label: "Paiement à la livraison" },
    });
    await tx.shop.create({ data: { tenantId: tenant.id, name: "Boutique principale", isMain: true } });
    return { tenantId: tenant.id, domain: domainName, trialEndsAt: trialEnd, planName: plan.name };
  });
}
