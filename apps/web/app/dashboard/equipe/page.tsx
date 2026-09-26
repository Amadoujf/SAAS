import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { withTenant, listTeam, resolveEffectiveLimit, countQuotaUsage } from "@yamacommerce/database";
import { hasPermission } from "@yamacommerce/auth";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { requireTenantPermission } from "@/lib/tenant-permissions";
import { formatDate } from "@/lib/format";
import { PageHeader, Panel, PanelHeader } from "@/components/yc/panel";
import { Pill } from "@/components/yc/status-pill";
import { InviteForm, MemberActions, RevokeButton } from "@/components/dashboard-team/team-manager";
import { ROLE_LABELS } from "@/lib/team/roles";

export const metadata: Metadata = { title: "Équipe — YamaCommerce", robots: { index: false, follow: false } };

/** Équipe de l'entreprise : membres, rôles, invitations — dans la limite
 *  d'utilisateurs de la formule (invitations en attente comprises). */
export default async function TeamPage() {
  const membership = await getCurrentTenantMembership();
  if (!membership) redirect("/dashboard");
  if (!(await requireTenantPermission(membership.tenantId, "employees.view"))) redirect("/dashboard");
  const perms = membership.permissions;
  const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(perms, p);

  const { team, limit, used } = await withTenant(membership.tenantId, async (tx) => ({
    team: await listTeam(tx, membership.tenantId),
    limit: await resolveEffectiveLimit(tx, membership.tenantId, "employees"),
    used: await countQuotaUsage(tx, membership.tenantId, "employees"),
  }));
  const full = limit !== null && used >= limit;

  return (
    <>
      <PageHeader
        eyebrow="Gestion"
        title="Équipe"
        description={limit === null ? `${used} utilisateur${used > 1 ? "s" : ""}.` : `${used} / ${limit} utilisateur${limit > 1 ? "s" : ""} inclus dans votre formule (invitations en attente comprises).`}
      />
      <div className="flex flex-col gap-5">
        <Panel>
          <PanelHeader title="Inviter un membre" description="La personne crée son accès depuis le lien d'invitation, avec l'adresse e-mail indiquée." />
          <InviteForm canInvite={can("employees.invite")} full={full} />
        </Panel>

        <Panel className="overflow-hidden">
          <PanelHeader title="Membres" />
          <ul className="divide-y divide-yc-ink/[0.06]">
            {team.members.map((m) => {
              const isOwner = m.role.name === "OWNER";
              const self = m.user.id === membership.userId;
              return (
                <li key={m.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#E8EFFF] text-sm font-bold text-yc-electric">
                    {m.user.fullName.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 font-semibold">{m.user.fullName}{self && <span className="text-xs font-normal text-yc-ink-soft">(vous)</span>}</span>
                    <span className="block truncate text-sm text-yc-ink-soft">{m.user.email} · {ROLE_LABELS[m.role.name]?.description ?? ""}</span>
                  </span>
                  {isOwner || self ? (
                    <Pill tone={isOwner ? "info" : "neutral"}>{ROLE_LABELS[m.role.name]?.label ?? m.role.name}</Pill>
                  ) : (
                    <MemberActions memberId={m.id} roleName={m.role.name} name={m.user.fullName} canEditRole={can("employees.edit_roles")} canRemove={can("employees.remove")} />
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>

        {team.invitations.length > 0 && (
          <Panel className="overflow-hidden">
            <PanelHeader title="Invitations en attente" />
            <ul className="divide-y divide-yc-ink/[0.06]">
              {team.invitations.map((inv) => (
                <li key={inv.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{inv.email}</span>
                    <span className="block text-sm text-yc-ink-soft">{ROLE_LABELS[inv.roleName]?.label} · expire le {formatDate(inv.expiresAt)}</span>
                  </span>
                  {can("employees.invite") && <RevokeButton invitationId={inv.id} email={inv.email} />}
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </>
  );
}
