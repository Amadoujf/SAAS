/**
 * Catalogue des permissions — voir docs/05-roles-permissions.md.
 *
 * Format `module.action`. Vérifiées côté serveur sur chaque mutation (jamais seulement
 * masquées côté UI). Ce module est la source de vérité unique : le dashboard, les
 * server actions et les tests de rôles importent tous depuis ici.
 */
export const PERMISSIONS = [
  "products.view",
  "products.create",
  "products.edit",
  "products.delete",
  "products.publish",
  "products.bulk_edit",

  "orders.view",
  "orders.update_status",
  "orders.cancel",
  "orders.refund",

  "customers.view",
  "customers.edit",
  "customers.export",

  "payments.view",
  "payments.configure",
  "payments.refund",

  "invoices.view",
  "invoices.issue_credit_note",

  "delivery.view",
  "delivery.assign",
  "delivery.update_status",
  "delivery.manage_zones",

  "employees.view",
  "employees.invite",
  "employees.edit_roles",
  "employees.remove",

  "settings.branding",
  "settings.notifications",
  "settings.subscription",

  // Assistant de domaines personnalisés (voir docs/13, 16 septembre 2026) —
  // remplace l'ancienne "settings.domain" unique par un jeu plus granulaire : un
  // manager peut connecter/vérifier un domaine mais jamais voir/modifier la
  // facturation registrar (réservée à "domains.manage_billing", voir la matrice
  // MANAGER ci-dessous, exactement comme le fut "settings.subscription").
  "domains.view",
  "domains.create",
  "domains.verify",
  "domains.configure",
  "domains.set_primary",
  "domains.remove",
  "domains.manage_billing",

  // Éditeur visuel et publication de site (voir docs/12 §12.2 et §12.3, 22 septembre
  // 2026) — distinctes de "settings.branding" (logo/couleurs statiques) : couvrent la
  // STRUCTURE du site (pages, sections, brouillon) et son cycle de publication.
  // Remplace l'ancienne "settings.site_editor" unique par un jeu plus granulaire :
  // un éditeur sans "site.publish" peut préparer un brouillon mais jamais le publier.
  "site.edit",
  "site.preview",
  "site.publish",
  "site.schedule",
  "site.restore",

  "reports.view",
  "reports.export",
  "reports.advanced",

  "marketing.manage_promotions",
  "marketing.manage_campaigns",

  "ai.use_product_assistant",
  "ai.use_chat_agent",

  "inventory.manage_stock",
  "inventory.manage_suppliers",

  // Fiches et réservations des secteurs à primitives génériques (immobilier, voyage,
  // services, hôtellerie, automobile, éducation — voir docs/04 §4.5.2). Distinctes de
  // "products.*" : un bien ou un départ n'est jamais un produit du catalogue commerce.
  "listings.view",
  "listings.create",
  "listings.edit",
  "listings.publish",
  "listings.delete",
  "listings.manage_availability",

  "reservations.view",
  "reservations.update_status",
  "reservations.cancel",

  // Immobilier : baux et loyers (un encaissement de loyer est de l'argent réel —
  // permission distincte, accordée au comptable).
  "leases.view",
  "leases.manage",
  "rents.record",

  // Voyage : voyageurs (identité, pièces, visas) et encaissements d'acomptes et de soldes
  // (argent réel — permission distincte, accordée au comptable).
  "travelers.manage",
  "reservation_payments.record",

  // Éducation : présences et notes (`academics.record`, limité aux classes de
  // l'enseignant), gestion complète (classes, évaluations de toutes les classes,
  // publication des notes : `academics.manage`).
  "academics.view",
  "academics.record",
  "academics.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export function isValidPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

/** Rôles système fournis par la plateforme (non supprimables, voir docs/05). */
export const SYSTEM_ROLES = [
  "OWNER",
  "MANAGER",
  "SALES",
  "INVENTORY_MANAGER",
  "MARKETING",
  "ACCOUNTANT",
  "DELIVERY_STAFF",
  "TEACHER",
] as const;

export type SystemRole = (typeof SYSTEM_ROLES)[number];

const ALL: Permission[] = [...PERMISSIONS];

/** Matrice rôle → permissions par défaut (extrait complet de docs/05-roles-permissions.md). */
export const SYSTEM_ROLE_PERMISSIONS: Record<SystemRole, Permission[]> = {
  OWNER: ALL,
  MANAGER: ALL.filter((p) => p !== "settings.subscription" && p !== "domains.manage_billing"),
  SALES: [
    "products.view",
    "orders.view",
    "orders.update_status",
    "customers.view",
    "customers.edit",
    "listings.view",
    "reservations.view",
    "reservations.update_status",
    "leases.view",
    "travelers.manage",
    "academics.view",
  ],
  INVENTORY_MANAGER: [
    "products.view",
    "products.create",
    "products.edit",
    "products.publish",
    "products.bulk_edit",
    "inventory.manage_stock",
    "inventory.manage_suppliers",
    "listings.view",
    "listings.create",
    "listings.edit",
    "listings.publish",
    "listings.manage_availability",
  ],
  MARKETING: [
    "customers.view",
    "marketing.manage_promotions",
    "marketing.manage_campaigns",
    "reports.view",
  ],
  ACCOUNTANT: [
    "invoices.view",
    "invoices.issue_credit_note",
    "reports.view",
    "reports.export",
    "payments.view",
    "leases.view",
    "rents.record",
    "reservations.view",
    "reservation_payments.record",
  ],
  DELIVERY_STAFF: ["delivery.view", "delivery.update_status"],
  TEACHER: ["academics.view", "academics.record"],
};
