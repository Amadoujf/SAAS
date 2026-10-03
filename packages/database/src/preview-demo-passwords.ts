import { hashPassword } from "@yamacommerce/auth";
import { prisma } from "./client";
import { withSuperAdminAccess } from "./tenant-context";

/**
 * Prévisualisation privée uniquement : remplace le mot de passe connu des comptes de
 * démonstration (écrit dans les scripts de démo du dépôt) par `PREVIEW_DEMO_PASSWORD`,
 * choisi sur le serveur. Seuls les membres d'entreprises marquées `isDemo` sont touchés,
 * jamais un Super Admin ni un compte rattaché à une entreprise réelle.
 */
async function main() {
  if (process.env.ALLOW_DEMO_SEED !== "true") throw new Error("ALLOW_DEMO_SEED=true requis : script réservé à la prévisualisation.");
  const password = process.env.PREVIEW_DEMO_PASSWORD ?? "";
  if (password.length < 12) throw new Error("PREVIEW_DEMO_PASSWORD manquant ou trop court (12 caractères minimum).");
  const count = await withSuperAdminAccess(async (tx) => {
    const members = await tx.tenantUser.findMany({ select: { userId: true, tenant: { select: { isDemo: true } } } });
    const realUsers = new Set(members.filter((m) => !m.tenant.isDemo).map((m) => m.userId));
    const demoUsers = [...new Set(members.filter((m) => m.tenant.isDemo).map((m) => m.userId))].filter((id) => !realUsers.has(id));
    const { count } = await tx.user.updateMany({ where: { id: { in: demoUsers }, isSuperAdmin: false }, data: { passwordHash: await hashPassword(password) } });
    return count;
  });
  console.log(`Comptes de démonstration : mot de passe de prévisualisation appliqué (${count}).`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
