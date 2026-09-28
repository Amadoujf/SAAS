import type { Metadata } from "next";
import { withTenant, listTables } from "@yamacommerce/database";
import { requireRestaurantPage } from "@/lib/restaurant/guard";
import { loadMenu } from "@/lib/restaurant/restaurant-data";
import { PageHeader } from "@/components/yc/panel";
import { DeskOrderForm } from "@/components/dashboard-restaurant/desk-order-form";

export const metadata: Metadata = { title: "Nouvelle commande — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function NewRestaurantOrderPage({ searchParams }: { searchParams: { table?: string } }) {
  const membership = await requireRestaurantPage("orders.update_status");
  const [sections, tables] = await Promise.all([loadMenu(membership.tenantId), withTenant(membership.tenantId, (tx) => listTables(tx, membership.tenantId))]);
  const active = tables.filter((t) => t.isActive).map((t) => ({ id: t.id, label: t.label }));
  return (
    <>
      <PageHeader eyebrow={<a href="/dashboard/ventes" className="hover:underline">Commandes</a>} title="Nouvelle commande" description="Pour une table, un client au comptoir ou au téléphone. Elle part directement sur l'écran de la cuisine." />
      <DeskOrderForm sections={sections} tables={active} defaultTableId={active.find((t) => t.id === searchParams.table)?.id ?? null} />
    </>
  );
}
