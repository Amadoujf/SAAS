import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { PageHeader } from "@/components/yc/panel";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { isCatalogModuleEnabled } from "@/lib/catalog/require-catalog-module";
import { CategoriesPanel } from "@/components/dashboard/categories-panel";

export const metadata: Metadata = { title: "Catégories — Dashboard", robots: { index: false, follow: false } };

export default async function CategoriesPage() {
  const membership = await getCurrentTenantMembership();
  if (!membership) redirect("/dashboard");
  const catalogEnabled = await isCatalogModuleEnabled(membership.tenantId);
  if (!catalogEnabled) redirect("/dashboard");

  return (
    <div>
      <PageHeader eyebrow="Catalogue" title="Catégories" description="Organisez votre catalogue pour vos clients." />
      <CategoriesPanel />
    </div>
  );
}
