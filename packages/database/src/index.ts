/** Réexporté UNIQUEMENT pour le type `Prisma.TransactionClient` — permet aux fonctions
 *  applicatives (ex. apps/web/lib/publishing/*) qui reçoivent un `tx` déjà ouvert par
 *  `withTenant()` de le typer explicitement sans dépendre directement de
 *  `@prisma/client` (qui reste un détail d'implémentation de ce package). */
export type { Prisma, DomainLifecycleStatus, ProductStatus, OrderStatus } from "@prisma/client";
export * from "./client";
export * from "./tenant-context";
export * from "./counters";
export * from "./encryption";
export * from "./modules-registry";
export * from "./templates-registry";
export * from "./site-versions-registry";
export * from "./media-assets-registry";
export * from "./audit-log-registry";
export * from "./domains-registry";
export * from "./catalog-registry";
export * from "./senegal-reference";
export * from "./customer-registry";
export * from "./cart-registry";
export * from "./order-status";
export * from "./order-registry";
export * from "./order-reservation";
export * from "./commerce-registry";
export * from "./order-operations";
export * from "./notification-registry";
export * from "./subscription-status";
export * from "./subscription-registry";
export * from "./subscription-lifecycle";
export * from "./subscription-usage";
export * from "./subscription-reminders";
export * from "./tenant-provisioning";
