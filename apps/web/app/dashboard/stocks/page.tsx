import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { isCatalogModuleEnabled } from "@/lib/catalog/require-catalog-module";
import { StocksPanel } from "@/components/dashboard/stocks-panel";

export const metadata: Metadata = { title: "Stocks — Dashboard", robots: { index: false, follow: false } };

export default async function StocksPage() {
  const membership = await getCurrentTenantMembership();
  if (!membership) redirect("/dashboard");
  const catalogEnabled = await isCatalogModuleEnabled(membership.tenantId);
  if (!catalogEnabled) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white p-4">
        <h1 className="text-lg font-semibold text-gray-900">Stocks</h1>
      </header>
      <StocksPanel />
    </div>
  );
}
