import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { AdminDomainsPanel } from "@/components/admin/admin-domains-panel";

export const metadata: Metadata = {
  title: "Domaines — Super Admin",
  robots: { index: false, follow: false },
};

/**
 * Espace Super Admin des domaines — voir la revue du 18 septembre 2026 : « L'interface
 * Super Admin et les notifications promises ne sont pas terminées ». S'appuie
 * entièrement sur les routes `/api/admin/domains/*` déjà protégées par
 * `requireSuperAdmin()` (voir lib/domains/require-super-admin.ts) — cette page
 * n'ajoute qu'UNE protection d'accès à la page elle-même, jamais une seconde source
 * de vérité sur les autorisations.
 */
export default async function AdminDomainsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/connexion");
  }
  if (!session.user.isSuperAdmin) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white p-4">
        <h1 className="text-lg font-semibold text-gray-900">Domaines — Super Admin</h1>
      </header>
      <AdminDomainsPanel />
    </div>
  );
}
