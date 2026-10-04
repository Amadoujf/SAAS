import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { PageHeader } from "@/components/yc/panel";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { isCatalogModuleEnabled } from "@/lib/catalog/require-catalog-module";
import { SizeGuidesPanel } from "@/components/dashboard/size-guides-panel";

export const metadata: Metadata = { title: "Guides des tailles — Dashboard", robots: { index: false, follow: false } };

export default async function SizeGuidesPage() {
  const membership = await getCurrentTenantMembership();
  if (!membership) redirect("/dashboard");
  if (!(await isCatalogModuleEnabled(membership.tenantId))) redirect("/dashboard");
  return (
    <div>
      <PageHeader eyebrow="Catalogue" title="Guides des tailles" description="Vos tableaux de tailles et de mesures, affichés sur les fiches produits de votre boutique." />
      <SizeGuidesPanel />
    </div>
  );
}
