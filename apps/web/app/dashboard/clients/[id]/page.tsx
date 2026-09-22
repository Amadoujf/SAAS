import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { CustomerDetailPanel } from "@/components/dashboard/customer-detail-panel";

export const metadata: Metadata = { title: "Fiche client — Dashboard", robots: { index: false, follow: false } };

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const membership = await getCurrentTenantMembership();
  if (!membership) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white p-4">
        <h1 className="text-lg font-semibold text-gray-900">Fiche client</h1>
      </header>
      <CustomerDetailPanel customerId={params.id} />
    </div>
  );
}
