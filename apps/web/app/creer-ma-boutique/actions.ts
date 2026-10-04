"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { normalizeSubdomain, validateSubdomainFormat } from "@yamacommerce/domains";
import { provisionTenantForOwner, signUpAndProvision, ProvisioningError, isSubdomainTaken } from "@yamacommerce/database";
import { auth, signIn } from "@/lib/auth";

export interface OnboardingState {
  error: string | null;
  field?: string;
}

const SUFFIX = process.env.PLATFORM_SUBDOMAIN_SUFFIX ?? "yamacommerce.ai";

/** Crée (si besoin) le compte du propriétaire puis l'entreprise complète, et ouvre
 *  sa session. Toutes les vérifications sont refaites ici côté serveur. */
export async function createStoreAction(_prev: OnboardingState, form: FormData): Promise<OnboardingState> {
  const session = await auth();
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const subdomain = normalizeSubdomain(get("subdomain"));
  if (!validateSubdomainFormat(subdomain).valid) return { error: "Adresse de boutique invalide.", field: "subdomain" };
  if (await isSubdomainTaken(subdomain, SUFFIX)) return { error: "Cette adresse est déjà prise.", field: "subdomain" };

  const email = get("email");
  const password = String(form.get("password") ?? "");
  const tenantInput = {
    name: get("storeName"),
    subdomain,
    subdomainSuffix: SUFFIX,
    sectorKey: get("sector"),
    planName: get("plan") || null,
    templatePreference: get("template") || null,
  };
  try {
    // Visiteur non connecté : compte ET entreprise dans une seule transaction — un
    // échec ne laisse jamais un compte orphelin qui bloquerait un nouvel essai.
    if (session?.user) await provisionTenantForOwner({ ...tenantInput, ownerUserId: session.user.id });
    else await signUpAndProvision({ email, fullName: get("fullName"), password }, tenantInput);
  } catch (error) {
    if (error instanceof ProvisioningError) return { error: error.message, field: error.field };
    throw error;
  }

  if (!session?.user) {
    try {
      await signIn("credentials", { email, password, redirectTo: "/dashboard?bienvenue=1" });
    } catch (error) {
      if (error instanceof AuthError) redirect("/connexion?cree=1");
      throw error;
    }
  }
  redirect("/dashboard?bienvenue=1");
}
