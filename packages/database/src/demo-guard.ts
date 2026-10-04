/**
 * Garde des scripts de DÉMONSTRATION : ils ne touchent jamais une entreprise réelle.
 *
 * 1. Refus en production, sauf autorisation explicite (`ALLOW_DEMO_SEED=true`).
 * 2. Une entreprise existante n'est modifiée que si elle est marquée `isDemo` (colonne
 *    protégée, voir la migration 20261006000000_tenant_demo_flag) : une vraie
 *    entreprise qui aurait pris le même sous-domaine (« sunu-marche »…) est ignorée.
 */
import { withSuperAdminAccess } from "./tenant-context";

export function assertDemoSeedAllowed(): void {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "true") {
    throw new Error("Scripts de démonstration refusés en production (définir ALLOW_DEMO_SEED=true pour une plateforme de démonstration).");
  }
}

/** Identifiant de l'entreprise de démonstration `slug`, ou `null` si elle n'existe pas
 *  ou n'est PAS une entreprise de démonstration (jamais modifiée dans ce cas). */
export async function findDemoTenant(slug: string): Promise<{ id: string } | null> {
  const tenant = await withSuperAdminAccess((tx) => tx.tenant.findUnique({ where: { slug }, select: { id: true, isDemo: true } }));
  if (!tenant) return null;
  if (!tenant.isDemo) {
    console.warn(`« ${slug} » est une entreprise RÉELLE (non marquée démonstration) : aucune donnée de démonstration n'y sera ajoutée.`);
    return null;
  }
  return { id: tenant.id };
}
