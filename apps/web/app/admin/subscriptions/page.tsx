import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { AdminSubscriptionsPanel } from "@/components/admin/admin-subscriptions-panel";

export const metadata: Metadata = { title: "Abonnements — Super Admin", robots: { index: false, follow: false } };

/**
 * Espace Super Admin des abonnements SaaS — voir docs/14-facturation-saas-
 * abonnements.md. Même convention que `/admin/domains`/`/admin/plans`.
 */
export default async function AdminSubscriptionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/connexion");
  if (!session.user.isSuperAdmin) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white p-4">
        <h1 className="text-lg font-semibold text-gray-900">Abonnements — Super Admin</h1>
      </header>
      <AdminSubscriptionsPanel />
    </div>
  );
}
