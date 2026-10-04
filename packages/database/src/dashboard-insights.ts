import type { OrderStatus, Prisma } from "@prisma/client";
import { countOrdersByQueue } from "./order-operations";

/**
 * Vue d'ensemble du dashboard marchand. Tout est calculé depuis les commandes
 * réelles de l'entreprise, sous RLS : aucune valeur de démonstration, aucune
 * tendance inventée — une tendance n'est donnée que si la période précédente a
 * une base de comparaison (sinon `null`, affiché « — »).
 *
 * Les jours sont des jours civils UTC, qui est aussi l'heure de Dakar (UTC+0,
 * sans heure d'été).
 */

export const DASHBOARD_PERIODS = ["month", "7d", "30d", "90d"] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

/** Commandes comptées dans le chiffre d'affaires : engagées, jamais annulées,
 *  remboursées ni en attente d'un paiement non vérifié. */
const REVENUE_STATUSES: OrderStatus[] = ["PAID", "CONFIRMED", "PREPARING", "READY", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];

const DAY = 86_400_000;
const startOfUtcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

export function isDashboardPeriod(value: unknown): value is DashboardPeriod {
  return typeof value === "string" && (DASHBOARD_PERIODS as readonly string[]).includes(value);
}

/** Fenêtre courante et fenêtre précédente de même durée. « Ce mois-ci » se compare
 *  au même nombre de jours du mois précédent (du 1er au même quantième). */
export function periodWindows(period: DashboardPeriod, now = new Date()) {
  if (period === "month") {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const elapsed = now.getTime() - start.getTime();
    const previousStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const previousMonthLength = start.getTime() - previousStart.getTime();
    return {
      current: { from: start, to: now },
      previous: { from: previousStart, to: new Date(previousStart.getTime() + Math.min(elapsed, previousMonthLength)) },
    };
  }
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const from = new Date(now.getTime() - days * DAY);
  return { current: { from, to: now }, previous: { from: new Date(from.getTime() - days * DAY), to: from } };
}

/** Variation en pourcentage, arrondie à 0,1. `null` sans base de comparaison. */
export function trendPercent(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export type PaymentBucket = "wave" | "orange_money" | "cod" | "online";
const BUCKET_BY_METHOD: Record<string, PaymentBucket> = {
  manual_wave: "wave",
  manual_orange_money: "orange_money",
  cod: "cod",
  online: "online",
};

/** Répartition par moyen de paiement ; les pourcentages totalisent exactement 100
 *  (méthode du plus fort reste) pour que la légende ne mente jamais d'un point. */
export function paymentSplit(rows: { paymentMethod: string; count: number }[]) {
  const counts = new Map<PaymentBucket, number>();
  for (const r of rows) {
    const bucket = BUCKET_BY_METHOD[r.paymentMethod];
    if (bucket) counts.set(bucket, (counts.get(bucket) ?? 0) + r.count);
  }
  const total = [...counts.values()].reduce((s, n) => s + n, 0);
  const entries = (["wave", "orange_money", "cod", "online"] as const)
    .map((method) => ({ method, count: counts.get(method) ?? 0 }))
    .filter((e) => e.count > 0);
  if (total === 0) return { total, items: [] as { method: PaymentBucket; count: number; percent: number }[] };
  const raw = entries.map((e) => ({ ...e, exact: (e.count / total) * 100 }));
  const floored = raw.map((e) => ({ ...e, percent: Math.floor(e.exact) }));
  let rest = 100 - floored.reduce((s, e) => s + e.percent, 0);
  for (const e of [...floored].sort((a, b) => (b.exact - b.percent) - (a.exact - a.percent))) {
    if (rest <= 0) break;
    e.percent += 1;
    rest -= 1;
  }
  return { total, items: floored.map(({ method, count, percent }) => ({ method, count, percent })) };
}

async function windowStats(tx: Prisma.TransactionClient, tenantId: string, from: Date, to: Date) {
  const where = { tenantId, createdAt: { gte: from, lt: to }, status: { in: REVENUE_STATUSES } };
  const [agg, customers] = await Promise.all([
    tx.order.aggregate({ where, _sum: { total: true }, _count: { _all: true } }),
    tx.order.findMany({ where, distinct: ["customerId"], select: { customerId: true } }),
  ]);
  return { revenue: agg._sum.total ?? 0, orders: agg._count._all, customers: customers.length };
}

export async function getDashboardInsights(tx: Prisma.TransactionClient, tenantId: string, period: DashboardPeriod, now = new Date()) {
  const { current, previous } = periodWindows(period, now);
  // `to` exclusif : on inclut la milliseconde courante.
  const to = new Date(now.getTime() + 1);
  const seriesFrom = new Date(startOfUtcDay(now).getTime() - 89 * DAY);

  const [cur, prev, queues, byMethod, seriesOrders, recent, lowStock, activity] = await Promise.all([
    windowStats(tx, tenantId, current.from, to),
    windowStats(tx, tenantId, previous.from, previous.to),
    countOrdersByQueue(tx, tenantId),
    tx.order.groupBy({
      by: ["paymentMethod"],
      where: { tenantId, createdAt: { gte: current.from, lt: to }, status: { in: REVENUE_STATUSES } },
      _count: { _all: true },
    }),
    tx.order.findMany({
      where: { tenantId, createdAt: { gte: seriesFrom }, status: { in: REVENUE_STATUSES } },
      select: { createdAt: true, total: true },
    }),
    tx.order.findMany({
      where: { tenantId },
      select: {
        id: true, orderNumber: true, total: true, status: true, paymentStatus: true, paymentMethod: true, createdAt: true,
        customer: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    tx.inventoryItem.findMany({
      where: { tenantId, availableQuantity: { lte: tx.inventoryItem.fields.lowStockThreshold } },
      select: {
        id: true, availableQuantity: true,
        variant: { select: { name: true, product: { select: { id: true, name: true, images: { select: { url: true }, orderBy: { position: "asc" }, take: 1 } } } } },
      },
      orderBy: { availableQuantity: "asc" },
      take: 3,
    }),
    tx.orderStatusHistory.findMany({
      where: { tenantId },
      select: {
        id: true, toStatus: true, fromStatus: true, createdAt: true,
        order: { select: { id: true, orderNumber: true, customer: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
  ]);

  const series: { date: string; revenue: number; orders: number }[] = [];
  for (let i = 0; i < 90; i += 1) series.push({ date: new Date(seriesFrom.getTime() + i * DAY).toISOString().slice(0, 10), revenue: 0, orders: 0 });
  for (const o of seriesOrders) {
    const day = series[Math.floor((startOfUtcDay(o.createdAt).getTime() - seriesFrom.getTime()) / DAY)];
    if (day) {
      day.revenue += o.total;
      day.orders += 1;
    }
  }

  return {
    period,
    kpis: {
      revenue: { value: cur.revenue, trend: trendPercent(cur.revenue, prev.revenue) },
      orders: { value: cur.orders, trend: trendPercent(cur.orders, prev.orders) },
      customers: { value: cur.customers, trend: trendPercent(cur.customers, prev.customers) },
      toPrepare: queues.toProcess,
    },
    queues,
    payments: paymentSplit(byMethod.map((r) => ({ paymentMethod: r.paymentMethod, count: r._count._all }))),
    series,
    recent,
    lowStock: lowStock.map((i) => ({
      id: i.id,
      productId: i.variant.product.id,
      name: i.variant.product.name,
      variantName: i.variant.name,
      imageUrl: i.variant.product.images[0]?.url ?? null,
      available: i.availableQuantity,
    })),
    activity,
  };
}
