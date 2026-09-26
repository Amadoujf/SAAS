import "server-only";
import {
  withTenant, createInvitation, revokeInvitation, changeMemberRole, removeMember, TeamError, QuotaExceededError,
} from "@yamacommerce/database";
import type { Permission } from "@yamacommerce/auth";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { requireTenantPermission } from "@/lib/tenant-permissions";

export type TeamActionResult<T = unknown> = { ok: true; data: T } | { ok: false; status: number; error: string };

async function context(permission: Permission) {
  const membership = await getCurrentTenantMembership();
  if (!membership) return null;
  const actor = await requireTenantPermission(membership.tenantId, permission);
  if (!actor) return null;
  return { tenantId: membership.tenantId, actor: { userId: actor.userId, type: (membership.roleName === "OWNER" ? "owner" : "employee") as "owner" | "employee" } };
}

function toError(error: unknown): { ok: false; status: number; error: string } {
  if (error instanceof QuotaExceededError) {
    return { ok: false, status: 402, error: `Votre formule inclut ${error.limit} utilisateur${error.limit > 1 ? "s" : ""} (invitations en attente comprises). Passez à une formule supérieure pour agrandir l'équipe.` };
  }
  if (error instanceof TeamError) return { ok: false, status: 409, error: error.message };
  return { ok: false, status: 400, error: "Action impossible pour le moment." };
}

/** Le lien d'invitation est renvoyé UNE fois, à la création : aucun e-mail n'est
 *  envoyé automatiquement tant qu'un fournisseur d'envoi n'est pas configuré. */
export async function inviteTeamMember(email: string, roleName: string, origin: string): Promise<TeamActionResult<{ link: string }>> {
  const ctx = await context("employees.invite");
  if (!ctx) return { ok: false, status: 403, error: "Action non autorisée." };
  try {
    const { token } = await withTenant(ctx.tenantId, (tx) => createInvitation(tx, ctx.tenantId, { email, roleName }, ctx.actor));
    return { ok: true, data: { link: `${origin}/invitation/${token}` } };
  } catch (error) {
    return toError(error);
  }
}

export async function revokeTeamInvitation(invitationId: string): Promise<TeamActionResult> {
  const ctx = await context("employees.invite");
  if (!ctx) return { ok: false, status: 403, error: "Action non autorisée." };
  try {
    await withTenant(ctx.tenantId, (tx) => revokeInvitation(tx, ctx.tenantId, invitationId, ctx.actor));
    return { ok: true, data: null };
  } catch (error) {
    return toError(error);
  }
}

export async function changeTeamMemberRole(memberId: string, roleName: string): Promise<TeamActionResult> {
  const ctx = await context("employees.edit_roles");
  if (!ctx) return { ok: false, status: 403, error: "Action non autorisée." };
  try {
    await withTenant(ctx.tenantId, (tx) => changeMemberRole(tx, ctx.tenantId, memberId, roleName, ctx.actor));
    return { ok: true, data: null };
  } catch (error) {
    return toError(error);
  }
}

export async function removeTeamMember(memberId: string): Promise<TeamActionResult> {
  const ctx = await context("employees.remove");
  if (!ctx) return { ok: false, status: 403, error: "Action non autorisée." };
  try {
    await withTenant(ctx.tenantId, (tx) => removeMember(tx, ctx.tenantId, memberId, ctx.actor));
    return { ok: true, data: null };
  } catch (error) {
    return toError(error);
  }
}
