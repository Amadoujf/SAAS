import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { withUser } from "@yamacommerce/database";
import { DEFAULT_LOCALE, t } from "@/lib/i18n";

/**
 * Placeholder de tableau de bord commerçant (Phase 0). Le vrai contenu (KPIs,
 * graphiques, agent IA — voir docs/01 et docs/02) arrive en Phase 1/2. Ce qui compte ici :
 * la session est vérifiée, et la liste des entreprises de l'utilisateur passe par
 * `withUser()`, la seule requête autorisée à traverser plusieurs tenants (voir
 * packages/database/src/tenant-context.ts).
 */
export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/connexion");
  }

  const memberships = await withUser(session.user.id, (tx) =>
    tx.tenantUser.findMany({
      where: { userId: session.user.id },
      include: { tenant: true, role: true },
    }),
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {t(DEFAULT_LOCALE, "dashboard.welcome")}, {session.user.name}
        </h1>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button type="submit" className="text-sm text-[var(--color-muted)] underline">
            Déconnexion
          </button>
        </form>
      </div>

      {memberships.length === 0 ? (
        <p className="text-[var(--color-muted)]">{t(DEFAULT_LOCALE, "dashboard.no_tenant")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {memberships.map((membership) => (
            <li
              key={membership.id}
              className="rounded-lg border border-[var(--color-border)] px-4 py-3"
            >
              <p className="font-medium">{membership.tenant.name}</p>
              <p className="text-sm text-[var(--color-muted)]">
                Rôle : {membership.role.name} · Statut : {membership.status}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
