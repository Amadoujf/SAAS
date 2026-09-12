import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { withSuperAdminAccess } from "@yamacommerce/database";
import { DEFAULT_LOCALE, t } from "@/lib/i18n";

/**
 * Placeholder de l'espace Super Admin (Phase 0). Les vraies fonctionnalités (création
 * de tenant, formules, impersonation journalisée — voir docs/08-liste-pages.md §8.3)
 * arrivent en Phase 1+. Ce qui compte ici : l'accès est strictement réservé à
 * `User.isSuperAdmin`, et la lecture cross-tenant passe explicitement par
 * `withSuperAdminAccess()` (jamais un accès par défaut).
 */
export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/connexion");
  }
  if (!session.user.isSuperAdmin) {
    redirect("/dashboard");
  }

  const tenants = await withSuperAdminAccess((tx) =>
    tx.tenant.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">{t(DEFAULT_LOCALE, "admin.title")}</h1>
      <section>
        <h2 className="mb-3 text-lg font-medium">{t(DEFAULT_LOCALE, "admin.tenants")}</h2>
        <ul className="flex flex-col gap-2">
          {tenants.map((tenant) => (
            <li
              key={tenant.id}
              className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-4 py-3"
            >
              <div>
                <p className="font-medium">{tenant.name}</p>
                <p className="text-sm text-[var(--color-muted)]">
                  {tenant.slug}.yamacommerce.ai · {tenant.businessType}
                </p>
              </div>
              <span className="bg-brand/10 text-brand rounded-full px-3 py-1 text-xs font-medium">
                {tenant.status}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
