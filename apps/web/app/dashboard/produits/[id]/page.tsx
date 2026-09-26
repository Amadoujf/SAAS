import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { PageHeader } from "@/components/yc/panel";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { isCatalogModuleEnabled } from "@/lib/catalog/require-catalog-module";
import { ProductForm } from "@/components/dashboard/product-form";

export const metadata: Metadata = { title: "Modifier le produit — Dashboard", robots: { index: false, follow: false } };

export default async function EditProductPage({ params }: { params: { id: string } }) {
  const membership = await getCurrentTenantMembership();
  if (!membership) redirect("/dashboard");
  const catalogEnabled = await isCatalogModuleEnabled(membership.tenantId);
  if (!catalogEnabled) redirect("/dashboard");

  return (
    <div>
      <PageHeader title="Modifier le produit" />
      <ProductForm mode="edit" productId={params.id} />
    </div>
  );
}
