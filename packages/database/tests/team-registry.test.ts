import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/client";
import { withSuperAdminAccess, withTenant } from "../src/tenant-context";
import { testOwnerClient } from "./test-owner-client";
import { createOwnerAccount, provisionTenantForOwner } from "../src/tenant-provisioning";
import { acceptInvitation, changeMemberRole, createInvitation, findInvitationByToken, listTeam, removeMember, revokeInvitation, TeamError } from "../src/team-registry";
import { QuotaExceededError } from "../src/subscription-usage";

/** Équipe contre PostgreSQL réel : quota d'utilisateurs de la formule (invitations en
 *  attente comprises), jeton à usage unique, e-mail vérifié, propriétaire protégé,
 *  isolation entre entreprises. */
let databaseAvailable = true;
try {
  await prisma.$queryRaw`SELECT 1`;
} catch (error) {
  if (process.env.REQUIRE_DB_TESTS === "true") throw new Error(`REQUIRE_DB_TESTS=true mais PostgreSQL est injoignable : ${String(error)}`);
  databaseAvailable = false;
}

describe.skipIf(!databaseAvailable)("Équipe : invitations, rôles et quota d'utilisateurs", () => {
  const suffix = `${Date.now()}`.slice(-8);
  const tenantIds: string[] = [];
  const userIds: string[] = [];
  let business: string;
  let essentiel: string;
  let ownerId: string;
  const owner = () => ({ userId: ownerId, type: "owner" as const });

  beforeAll(async () => {
    const o = await createOwnerAccount({ email: `equipe-${suffix}@exemple.sn`, fullName: "Awa Equipe", password: "motdepasse-solide" });
    ownerId = o.id;
    userIds.push(o.id);
    business = (await provisionTenantForOwner({ ownerUserId: o.id, name: "Equipe Business", subdomain: `equipe-b-${suffix}`, subdomainSuffix: "yamacommerce.ai", sectorKey: "ecommerce", planName: "Business" })).tenantId;
    essentiel = (await provisionTenantForOwner({ ownerUserId: o.id, name: "Equipe Essentiel", subdomain: `equipe-e-${suffix}`, subdomainSuffix: "yamacommerce.ai", sectorKey: "ecommerce", planName: "Essentiel" })).tenantId;
    tenantIds.push(business, essentiel);
  });

  afterAll(async () => {
    const db = testOwnerClient();
    try {
      for (const id of tenantIds) {
        for (const model of ["auditLog", "tenantInvitation", "tenantModule", "paymentProviderConfig", "shop", "tenantUser", "tenantSubscription", "domain"] as const) {
          await (db[model] as unknown as { deleteMany: (a: unknown) => Promise<unknown> }).deleteMany({ where: { tenantId: id } });
        }
        await db.tenant.deleteMany({ where: { id } });
      }
      await db.user.deleteMany({ where: { id: { in: userIds } } });
    } finally {
      await db.$disconnect();
    }
  });

  it("Essentiel (1 utilisateur) : le propriétaire occupe la seule place, toute invitation est refusée", async () => {
    await expect(withTenant(essentiel, (tx) => createInvitation(tx, essentiel, { email: `x-${suffix}@exemple.sn`, roleName: "SALES" }, owner()))).rejects.toBeInstanceOf(QuotaExceededError);
  });

  it("invitation → acceptation par le bon compte → membre actif ; jeton à usage unique", async () => {
    const email = `vendeur-${suffix}@exemple.sn`;
    const { token } = await withTenant(business, (tx) => createInvitation(tx, business, { email, roleName: "SALES" }, owner()));
    const stored = await withSuperAdminAccess((tx) => tx.tenantInvitation.findFirst({ where: { tenantId: business, email } }));
    expect(stored!.tokenHash).not.toBe(token); // jamais en clair

    const intruder = await createOwnerAccount({ email: `intrus-${suffix}@exemple.sn`, fullName: "Intrus", password: "motdepasse-solide" });
    userIds.push(intruder.id);
    await expect(withSuperAdminAccess((tx) => acceptInvitation(tx, token, intruder.id))).rejects.toThrow(/adresse e-mail/);

    const invitee = await createOwnerAccount({ email, fullName: "Moussa Vendeur", password: "motdepasse-solide" });
    userIds.push(invitee.id);
    const result = await withSuperAdminAccess((tx) => acceptInvitation(tx, token, invitee.id));
    expect(result.tenantId).toBe(business);
    await expect(withSuperAdminAccess((tx) => acceptInvitation(tx, token, invitee.id))).rejects.toBeInstanceOf(TeamError);
    expect(await withSuperAdminAccess((tx) => findInvitationByToken(tx, token))).toBeNull();

    const team = await withTenant(business, (tx) => listTeam(tx, business));
    const member = team.members.find((m) => m.user.id === invitee.id)!;
    expect(member.role.name).toBe("SALES");
    expect(member.status).toBe("ACTIVE");

    await withTenant(business, (tx) => changeMemberRole(tx, business, member.id, "MANAGER", owner()));
    await withTenant(business, (tx) => removeMember(tx, business, member.id, owner()));
    expect((await withTenant(business, (tx) => listTeam(tx, business))).members.some((m) => m.user.id === invitee.id)).toBe(false);
  });

  it("Business (5 utilisateurs) : les invitations en attente réservent une place", async () => {
    // Propriétaire + 4 invitations en attente = 5 : la 5e invitation dépasse.
    for (let i = 0; i < 4; i += 1) {
      await withTenant(business, (tx) => createInvitation(tx, business, { email: `place-${i}-${suffix}@exemple.sn`, roleName: "SALES" }, owner()));
    }
    await expect(withTenant(business, (tx) => createInvitation(tx, business, { email: `place-5-${suffix}@exemple.sn`, roleName: "SALES" }, owner()))).rejects.toBeInstanceOf(QuotaExceededError);
    // Révoquer libère la place.
    const pending = (await withTenant(business, (tx) => listTeam(tx, business))).invitations;
    await withTenant(business, (tx) => revokeInvitation(tx, business, pending[0]!.id, owner()));
    await expect(withTenant(business, (tx) => createInvitation(tx, business, { email: `place-5-${suffix}@exemple.sn`, roleName: "SALES" }, owner()))).resolves.toBeTruthy();
  });

  it("le propriétaire ne peut être ni retiré ni rétrogradé ; une autre entreprise ne voit rien", async () => {
    const team = await withTenant(business, (tx) => listTeam(tx, business));
    const ownerMember = team.members.find((m) => m.role.name === "OWNER")!;
    await expect(withTenant(business, (tx) => removeMember(tx, business, ownerMember.id, { userId: "autre", type: "employee" }))).rejects.toThrow(/propriétaire/);
    await expect(withTenant(business, (tx) => changeMemberRole(tx, business, ownerMember.id, "SALES", { userId: "autre", type: "employee" }))).rejects.toThrow(/propriétaire/);

    const foreign = await withTenant(essentiel, (tx) => listTeam(tx, business));
    expect(foreign.invitations).toHaveLength(0);
    expect(foreign.members).toHaveLength(0);
  });
});
