import { ycFontVariables } from "@/lib/yc-fonts";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { withSuperAdminAccess } from "@yamacommerce/database";
import { auth } from "@/lib/auth";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { STORE_TEMPLATES } from "@/lib/storefront/store-templates";
import { createStoreAction } from "./actions";

export const metadata: Metadata = { title: "Créer ma boutique — YamaCommerce" };

/** Onboarding : compte → boutique (adresse vérifiée en direct) → secteur → style.
 *  La création réelle (entreprise, domaine, essai, propriétaire) est faite par
 *  `provisionTenantForOwner`, en une seule transaction. */
export default async function CreateStorePage({ searchParams }: { searchParams: { formule?: string } }) {
  const session = await auth();
  if (session?.user && (await getCurrentTenantMembership())) redirect("/dashboard");
  const [sectors, plan] = await withSuperAdminAccess(async (tx) => [
    await tx.sector.findMany({ where: { isSystem: true }, orderBy: { name: "asc" } }),
    searchParams.formule ? await tx.subscriptionPlan.findFirst({ where: { name: searchParams.formule, status: "PUBLISHED" } }) : null,
  ] as const);
  return (
    <div className={ycFontVariables}>
    <OnboardingFlow
      loggedIn={!!session?.user}
      sectors={sectors.map((s) => ({ key: s.key, name: s.name }))}
      templates={STORE_TEMPLATES.map((t) => ({ slug: t.slug, name: t.name, tagline: t.tagline, bg: t.tokens.colors.background, ink: t.tokens.colors.textPrimary, accent: t.tokens.colors.secondary, serif: /serif/i.test(t.tokens.typography.headingFont) && !/sans-serif/i.test(t.tokens.typography.headingFont) }))}
      plan={plan?.name ?? null}
      action={createStoreAction}
    />
    </div>
  );
}
