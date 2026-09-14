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
  "settings.domain",
  "settings.notifications",
  "settings.subscription",
  // Éditeur visuel (pages/sections/style/site) — voir docs/12 §12.2. Distincte de
  // "settings.branding" (logo/couleurs statiques déjà existant) : couvre la
  // modification de la STRUCTURE du site (pages, sections, brouillon, publication),
  // pas seulement son identité visuelle.
  "settings.site_editor",

  "reports.view",
  "reports.export",
  "reports.advanced",

  "marketing.manage_promotions",
  "marketing.manage_campaigns",

  "ai.use_product_assistant",
  "ai.use_chat_agent",

  "inventory.manage_stock",
  "inventory.manage_suppliers",
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
] as const;

export type SystemRole = (typeof SYSTEM_ROLES)[number];

const ALL: Permission[] = [...PERMISSIONS];

/** Matrice rôle → permissions par défaut (extrait complet de docs/05-roles-permissions.md). */
export const SYSTEM_ROLE_PERMISSIONS: Record<SystemRole, Permission[]> = {
  OWNER: ALL,
  MANAGER: ALL.filter((p) => p !== "settings.domain" && p !== "settings.subscription"),
  SALES: [
    "products.view",
    "orders.view",
    "orders.update_status",
    "customers.view",
    "customers.edit",
  ],
  INVENTORY_MANAGER: [
    "products.view",
    "products.create",
    "products.edit",
    "products.publish",
    "products.bulk_edit",
    "inventory.manage_stock",
    "inventory.manage_suppliers",
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
  ],
  DELIVERY_STAFF: ["delivery.view", "delivery.update_status"],
};
