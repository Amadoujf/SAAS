import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { PageHeader } from "@/components/yc/panel";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { isCatalogModuleEnabled } from "@/lib/catalog/require-catalog-module";
import { ProductForm } from "@/components/dashboard/product-form";

export const metadata: Metadata = { title: "Nouveau produit — Dashboard", robots: { index: false, follow: false } };

export default async function NewProductPage() {
  const membership = await getCurrentTenantMembership();
  if (!membership) redirect("/dashboard");
  const catalogEnabled = await isCatalogModuleEnabled(membership.tenantId);
  if (!catalogEnabled) redirect("/dashboard");

  return (
    <div>
      <PageHeader title="Nouveau produit" />
      <ProductForm mode="create" />
    </div>
  );
}
