import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { PageHeader } from "@/components/yc/panel";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { CustomerDetailPanel } from "@/components/dashboard/customer-detail-panel";

export const metadata: Metadata = { title: "Fiche client — Dashboard", robots: { index: false, follow: false } };

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const membership = await getCurrentTenantMembership();
  if (!membership) redirect("/dashboard");

  return (
    <div>
      <PageHeader title="Fiche client" />
      <CustomerDetailPanel customerId={params.id} />
    </div>
  );
}
