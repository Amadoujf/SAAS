import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { assertQuotaAvailable } from "./subscription-usage";
import { writeAuditLog } from "./audit-log-registry";

/**
 * Équipe d'une entreprise : membres, rôles et invitations. Le nombre d'utilisateurs est
 * borné par la formule (quota « employees », invitations en attente comprises). Le jeton
 * d'invitation n'est jamais stocké en clair ; il n'est montré qu'une fois, à la création.
 */

export const INVITABLE_ROLES = ["MANAGER", "SALES", "INVENTORY_MANAGER", "MARKETING", "ACCOUNTANT", "DELIVERY_STAFF"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

const INVITATION_TTL_DAYS = 7;

export class TeamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TeamError";
  }
}

export const hashInvitationToken = (token: string) => createHash("sha256").update(token).digest("hex");

function normalizeEmail(email: string) {
  const e = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(e)) throw new TeamError("Adresse e-mail invalide.");
  return e;
}

type Actor = { userId: string; type: "owner" | "employee" };

export async function listTeam(tx: Prisma.TransactionClient, tenantId: string) {
  const [members, invitations] = await Promise.all([
    tx.tenantUser.findMany({
      where: { tenantId },
      select: { id: true, status: true, joinedAt: true, createdAt: true, role: { select: { name: true } }, user: { select: { id: true, fullName: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    tx.tenantInvitation.findMany({
      where: { tenantId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, email: true, roleName: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return { members, invitations };
}

export async function createInvitation(tx: Prisma.TransactionClient, tenantId: string, input: { email: string; roleName: string }, actor: Actor) {
  const email = normalizeEmail(input.email);
  if (!(INVITABLE_ROLES as readonly string[]).includes(input.roleName)) throw new TeamError("Rôle invalide.");
  const existingUser = await tx.user.findUnique({ where: { email }, select: { id: true } });
  if (existingUser && (await tx.tenantUser.findFirst({ where: { tenantId, userId: existingUser.id } }))) {
    throw new TeamError("Cette personne fait déjà partie de l'équipe.");
  }
  if (await tx.tenantInvitation.findFirst({ where: { tenantId, email, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } } })) {
    throw new TeamError("Une invitation est déjà en attente pour cette adresse.");
  }
  await assertQuotaAvailable(tx, tenantId, "employees");
  const token = randomBytes(32).toString("base64url");
  const invitation = await tx.tenantInvitation.create({
    data: { tenantId, email, roleName: input.roleName, tokenHash: hashInvitationToken(token), invitedBy: actor.userId, expiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * 86_400_000) },
  });
  await writeAuditLog(tx, { tenantId, actorUserId: actor.userId, actorType: actor.type, action: "team.invite", entityType: "TenantInvitation", entityId: invitation.id, metadata: { email, roleName: input.roleName } });
  return { invitation, token };
}

export async function revokeInvitation(tx: Prisma.TransactionClient, tenantId: string, invitationId: string, actor: Actor) {
  const { count } = await tx.tenantInvitation.updateMany({ where: { id: invitationId, tenantId, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
  if (count === 0) throw new TeamError("Invitation introuvable ou déjà utilisée.");
  await writeAuditLog(tx, { tenantId, actorUserId: actor.userId, actorType: actor.type, action: "team.revoke_invitation", entityType: "TenantInvitation", entityId: invitationId });
}

async function memberOrThrow(tx: Prisma.TransactionClient, tenantId: string, memberId: string, actor: Actor) {
  const member = await tx.tenantUser.findFirst({ where: { id: memberId, tenantId }, include: { role: true } });
  if (!member) throw new TeamError("Membre introuvable.");
  if (member.role.name === "OWNER") throw new TeamError("Le propriétaire ne peut être ni retiré ni modifié.");
  if (member.userId === actor.userId) throw new TeamError("Vous ne pouvez pas modifier votre propre accès.");
  return member;
}

export async function changeMemberRole(tx: Prisma.TransactionClient, tenantId: string, memberId: string, roleName: string, actor: Actor) {
  if (!(INVITABLE_ROLES as readonly string[]).includes(roleName)) throw new TeamError("Rôle invalide.");
  const member = await memberOrThrow(tx, tenantId, memberId, actor);
  const role = await tx.role.findFirst({ where: { tenantId: null, name: roleName } });
  if (!role) throw new TeamError("Rôle introuvable.");
  await tx.tenantUser.update({ where: { id: member.id }, data: { roleId: role.id } });
  await writeAuditLog(tx, { tenantId, actorUserId: actor.userId, actorType: actor.type, action: "team.change_role", entityType: "TenantUser", entityId: member.id, metadata: { from: member.role.name, to: roleName } });
}

export async function removeMember(tx: Prisma.TransactionClient, tenantId: string, memberId: string, actor: Actor) {
  const member = await memberOrThrow(tx, tenantId, memberId, actor);
  await tx.tenantUser.delete({ where: { id: member.id } });
  await writeAuditLog(tx, { tenantId, actorUserId: actor.userId, actorType: actor.type, action: "team.remove", entityType: "TenantUser", entityId: member.id, metadata: { userId: member.userId, role: member.role.name } });
}

/** Lecture publique d'une invitation par son jeton (page d'acceptation). Opération
 *  plateforme : l'appelant l'exécute sous `withSuperAdminAccess`. */
export async function findInvitationByToken(tx: Prisma.TransactionClient, token: string) {
  const invitation = await tx.tenantInvitation.findUnique({ where: { tokenHash: hashInvitationToken(token) }, include: { tenant: { select: { id: true, name: true } } } });
  if (!invitation || invitation.revokedAt || invitation.acceptedAt || invitation.expiresAt <= new Date()) return null;
  return invitation;
}

/** Acceptation : l'e-mail du compte doit être celui de l'invitation. Idempotente sur
 *  l'appartenance (jamais deux lignes pour le même membre). Sous `withSuperAdminAccess`. */
export async function acceptInvitation(tx: Prisma.TransactionClient, token: string, userId: string) {
  await tx.$queryRaw`SELECT "id" FROM "TenantInvitation" WHERE "tokenHash" = ${hashInvitationToken(token)} FOR UPDATE`;
  const invitation = await findInvitationByToken(tx, token);
  if (!invitation) throw new TeamError("Cette invitation n'est plus valable (déjà utilisée, révoquée ou expirée).");
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user || user.email?.toLowerCase() !== invitation.email) throw new TeamError("Connectez-vous avec l'adresse e-mail qui a reçu l'invitation.");
  const role = await tx.role.findFirst({ where: { tenantId: null, name: invitation.roleName } });
  if (!role) throw new TeamError("Rôle introuvable.");
  const existing = await tx.tenantUser.findFirst({ where: { tenantId: invitation.tenantId, userId } });
  if (!existing) {
    await tx.tenantUser.create({ data: { tenantId: invitation.tenantId, userId, roleId: role.id, status: "ACTIVE", invitedBy: invitation.invitedBy, joinedAt: new Date() } });
  }
  await tx.tenantInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
  await writeAuditLog(tx, { tenantId: invitation.tenantId, actorUserId: userId, actorType: "employee", action: "team.accept_invitation", entityType: "TenantInvitation", entityId: invitation.id });
  return { tenantId: invitation.tenantId, tenantName: invitation.tenant.name };
}
