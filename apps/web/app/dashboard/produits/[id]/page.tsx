import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { PageHeader } from "@/components/yc/panel";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { isCatalogModuleEnabled } from "@/lib/catalog/require-catalog-module";
import { ProductForm } from "@/components/dashboard/product-form";
import { ProductSizeGuide } from "@/components/dashboard/product-size-guide";
import { withTenant } from "@yamacommerce/database";

export const metadata: Metadata = { title: "Modifier le produit — Dashboard", robots: { index: false, follow: false } };

export default async function EditProductPage({ params }: { params: { id: string } }) {
  const membership = await getCurrentTenantMembership();
  if (!membership) redirect("/dashboard");
  const catalogEnabled = await isCatalogModuleEnabled(membership.tenantId);
  if (!catalogEnabled) redirect("/dashboard");

  const tenantId = membership.tenantId;
  const sizing = await withTenant(tenantId, async (tx) => ({
    product: await tx.product.findFirst({ where: { id: params.id, tenantId }, select: { sizeGuideId: true, category: { select: { sizeGuideId: true } } } }),
    guides: await tx.sizeGuide.findMany({ where: { tenantId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  }));

  return (
    <div>
      <PageHeader title="Modifier le produit" />
      <ProductForm mode="edit" productId={params.id} />
      {sizing.product && (
        <ProductSizeGuide productId={params.id} current={sizing.product.sizeGuideId} categoryGuide={sizing.product.category?.sizeGuideId ?? null} guides={sizing.guides} />
      )}
    </div>
  );
}
