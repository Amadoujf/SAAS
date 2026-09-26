import "server-only";
import type { OrderStatus } from "@yamacommerce/database";
import {
  withTenant,
  advanceOrderStatus,
  approveManualPayment,
  rejectManualPayment,
  assignDeliverer,
  setOrderInternalNotes,
  issueInvoiceForOrder,
  notificationEventForStatus,
  OrderOperationError,
  InvalidOrderTransitionError,
  OrderStatusConflictError,
} from "@yamacommerce/database";
import type { Permission } from "@yamacommerce/auth";
import { requireTenantPermission } from "@/lib/tenant-permissions";
import { getCurrentTenantMembership } from "@/lib/current-tenant";
import { isOrdersModuleEnabled } from "@/lib/catalog/require-orders-module";
import { planOrderNotifications, dispatchPlannedNotifications, type PlannedNotification } from "./notify";

/**
 * Actions du dashboard sur les commandes. Chaque action : (1) résout l'entreprise
 * courante, (2) vérifie la permission précise côté serveur (jamais seulement masquée
 * dans l'interface), (3) exécute l'opération dans une transaction RLS du tenant,
 * (4) crée les notifications dans la MÊME transaction puis les met en file après
 * commit.
 */
export type DashboardActionResult<T = unknown> = { ok: true; data: T } | { ok: false; status: number; error: string };

export async function resolveDashboardTenant(permission: Permission) {
  const membership = await getCurrentTenantMembership();
  if (!membership) return null;
  const actor = await requireTenantPermission(membership.tenantId, permission);
  if (!actor) return null;
  if (!(await isOrdersModuleEnabled(membership.tenantId))) return null;
  return {
    tenantId: membership.tenantId,
    actor: { userId: actor.userId, type: (membership.roleName === "OWNER" ? "owner" : "employee") as "owner" | "employee" },
  };
}

function toError(error: unknown): { ok: false; status: number; error: string } {
  if (error instanceof OrderOperationError || error instanceof InvalidOrderTransitionError) {
    return { ok: false, status: 409, error: error.message };
  }
  if (error instanceof OrderStatusConflictError) {
    return { ok: false, status: 409, error: "La commande vient d'être modifiée par quelqu'un d'autre — rechargez la page." };
  }
  return { ok: false, status: 400, error: error instanceof Error ? error.message : "Erreur inattendue." };
}

const PERMISSION_BY_TARGET: Partial<Record<OrderStatus, Permission>> = {
  CANCELED: "orders.cancel",
  REFUNDED: "orders.refund",
};

export async function changeOrderStatus(orderId: string, toStatus: OrderStatus, note?: string | null): Promise<DashboardActionResult> {
  const ctx = await resolveDashboardTenant(PERMISSION_BY_TARGET[toStatus] ?? "orders.update_status");
  if (!ctx) return { ok: false, status: 403, error: "Action non autorisée." };
  try {
    let planned: PlannedNotification[] = [];
    const order = await withTenant(ctx.tenantId, async (tx) => {
      const updated = await advanceOrderStatus(tx, ctx.tenantId, orderId, toStatus, ctx.actor, note);
      const event = notificationEventForStatus(toStatus);
      if (event) planned = await planOrderNotifications(tx, ctx.tenantId, orderId, event);
      return updated;
    });
    await dispatchPlannedNotifications(ctx.tenantId, planned);
    return { ok: true, data: { status: order.status } };
  } catch (error) {
    return toError(error);
  }
}

export async function reviewManualPayment(
  orderId: string,
  decision: "approve" | "reject",
  note?: string | null,
): Promise<DashboardActionResult> {
  const ctx = await resolveDashboardTenant("orders.update_status");
  if (!ctx) return { ok: false, status: 403, error: "Action non autorisée." };
  if (!(await requireTenantPermission(ctx.tenantId, "payments.view"))) return { ok: false, status: 403, error: "Action non autorisée." };
  try {
    let planned: PlannedNotification[] = [];
    const result = await withTenant(ctx.tenantId, async (tx) => {
      if (decision === "approve") {
        const outcome = await approveManualPayment(tx, ctx.tenantId, orderId, ctx.actor, note);
        if (outcome.outcome === "approved") planned = await planOrderNotifications(tx, ctx.tenantId, orderId, "manual_payment_approved");
        return outcome;
      }
      const outcome = await rejectManualPayment(tx, ctx.tenantId, orderId, ctx.actor, note ?? "");
      planned = await planOrderNotifications(tx, ctx.tenantId, orderId, "manual_payment_rejected");
      return outcome;
    });
    await dispatchPlannedNotifications(ctx.tenantId, planned);
    return { ok: true, data: result };
  } catch (error) {
    return toError(error);
  }
}

export async function assignOrderDeliverer(orderId: string, delivererId: string | null): Promise<DashboardActionResult> {
  const ctx = await resolveDashboardTenant("delivery.assign");
  if (!ctx) return { ok: false, status: 403, error: "Action non autorisée." };
  try {
    await withTenant(ctx.tenantId, (tx) => assignDeliverer(tx, ctx.tenantId, orderId, delivererId, ctx.actor));
    return { ok: true, data: null };
  } catch (error) {
    return toError(error);
  }
}

export async function updateInternalNotes(orderId: string, notes: string): Promise<DashboardActionResult> {
  const ctx = await resolveDashboardTenant("orders.update_status");
  if (!ctx) return { ok: false, status: 403, error: "Action non autorisée." };
  try {
    await withTenant(ctx.tenantId, (tx) => setOrderInternalNotes(tx, ctx.tenantId, orderId, notes));
    return { ok: true, data: null };
  } catch (error) {
    return toError(error);
  }
}

export async function issueInvoice(orderId: string): Promise<DashboardActionResult> {
  const ctx = await resolveDashboardTenant("invoices.view");
  if (!ctx) return { ok: false, status: 403, error: "Action non autorisée." };
  try {
    let planned: PlannedNotification[] = [];
    const invoice = await withTenant(ctx.tenantId, async (tx) => {
      const before = await tx.invoice.findFirst({ where: { orderId, tenantId: ctx.tenantId } });
      const created = await issueInvoiceForOrder(tx, ctx.tenantId, orderId);
      if (!before) planned = await planOrderNotifications(tx, ctx.tenantId, orderId, "invoice_available");
      return created;
    });
    await dispatchPlannedNotifications(ctx.tenantId, planned);
    return { ok: true, data: { number: invoice.number } };
  } catch (error) {
    return toError(error);
  }
}
