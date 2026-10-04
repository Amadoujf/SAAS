import type { ListOrdersFilter } from "@yamacommerce/database";

const STATUSES = ["NEW", "AWAITING_PAYMENT", "PAID", "CONFIRMED", "PREPARING", "READY", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELED", "REFUNDED"];

export const ORDER_TABS = [
  { key: "toutes", label: "Toutes" },
  { key: "a-traiter", label: "À préparer" },
  { key: "preuves", label: "Preuves à vérifier" },
  { key: "attente", label: "Paiement en attente" },
  { key: "livraison", label: "En livraison" },
  { key: "livrees", label: "Livrées" },
  { key: "annulees", label: "Annulées" },
] as const;

/** Traduit les paramètres d'URL (lisibles, partageables) en filtre serveur. */
export function parseOrderFilters(params: Record<string, string | undefined>): ListOrdersFilter & { page: number; tab: string } {
  const page = Math.max(1, Number(params.page) || 1);
  const filter: ListOrdersFilter & { page: number; tab: string } = { page, tab: params.file ?? "toutes", take: 25, skip: (page - 1) * 25 };
  switch (params.file) {
    case "a-traiter": filter.status = "to_process"; break;
    case "preuves": filter.status = "awaiting_proof"; break;
    case "attente": filter.status = "AWAITING_PAYMENT"; break;
    case "livraison": filter.status = "in_delivery"; break;
    case "livrees": filter.status = "DELIVERED"; break;
    case "annulees": filter.status = "CANCELED"; break;
  }
  if (params.statut && STATUSES.includes(params.statut)) filter.status = params.statut as ListOrdersFilter["status"];
  if (params.q) filter.search = params.q.slice(0, 80);
  if (params.du) { const d = new Date(params.du); if (!Number.isNaN(d.getTime())) filter.from = d; }
  if (params.au) { const d = new Date(params.au); if (!Number.isNaN(d.getTime())) { d.setHours(23, 59, 59, 999); filter.to = d; } }
  return filter;
}
