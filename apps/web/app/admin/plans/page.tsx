import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { AdminPlansPanel } from "@/components/admin/admin-plans-panel";

export const metadata: Metadata = { title: "Formules — Super Admin", robots: { index: false, follow: false } };

/**
 * Espace Super Admin des formules SaaS — voir docs/14-facturation-saas-
 * abonnements.md. S'appuie entièrement sur les routes `/api/admin/billing/plans*`
 * déjà protégées par `requireSuperAdmin()` — même convention que
 * `/admin/domains` : cette page n'ajoute qu'UNE protection d'accès à la page
 * elle-même, jamais une seconde source de vérité sur les autorisations.
 */
export default async function AdminPlansPage() {
  const session = await auth();
  if (!session?.user) redirect("/connexion");
  if (!session.user.isSuperAdmin) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white p-4">
        <h1 className="text-lg font-semibold text-gray-900">Formules — Super Admin</h1>
      </header>
      <AdminPlansPanel />
    </div>
  );
}
