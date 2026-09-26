import { NextResponse, type NextRequest } from "next/server";
import { withTenant, listOrdersForTenant } from "@yamacommerce/database";
import { resolveDashboardTenant } from "@/lib/orders/dashboard-pipeline";
import { parseOrderFilters } from "@/lib/orders/filters";
import { csvCell } from "@/lib/orders/csv";
import { ORDER_STATUS_META, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_META } from "@/lib/commerce/order-status-meta";

/** Export CSV (séparateur « ; », BOM UTF-8 pour Excel) des commandes filtrées. */
export async function GET(request: NextRequest) {
  const ctx = await resolveDashboardTenant("orders.view");
  if (!ctx) return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
  const filter = parseOrderFilters(Object.fromEntries(request.nextUrl.searchParams));
  const { orders } = await withTenant(ctx.tenantId, (tx) => listOrdersForTenant(tx, ctx.tenantId, { ...filter, take: 500, skip: 0 }));
  const header = ["Numéro", "Date", "Client", "Téléphone", "Statut", "Paiement", "Moyen de paiement", "Livraison", "Sous-total", "Livraison (FCFA)", "Total (FCFA)"];
  const rows = orders.map((o) => [
    o.orderNumber,
    o.createdAt.toISOString(),
    `${o.customer.firstName} ${o.customer.lastName ?? ""}`.trim(),
    o.customer.phone ?? "",
    ORDER_STATUS_META[o.status]?.label ?? o.status,
    PAYMENT_STATUS_META[o.paymentStatus]?.label ?? o.paymentStatus,
    PAYMENT_METHOD_LABEL[o.paymentMethod] ?? o.paymentMethod,
    o.deliveryMethod === "pickup" ? "Retrait" : "Livraison",
    o.subtotal,
    o.shippingTotal,
    o.total,
  ]);
  const csv = "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\n");
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="commandes-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
