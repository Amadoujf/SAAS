import Link from "next/link";
import type { Metadata } from "next";
import { withTenant, kitchenBoard } from "@yamacommerce/database";
import { hasPermission } from "@yamacommerce/auth";
import { requireRestaurantPage } from "@/lib/restaurant/guard";
import { optionsText, timeIn } from "@/lib/restaurant/labels";
import { PageHeader } from "@/components/yc/panel";
import { ButtonLink } from "@/components/yc/button";
import { IconPlus } from "@/components/yc/icons";
import { KitchenBoard } from "@/components/dashboard-restaurant/kitchen-board";
import { LiveRefresh } from "@/components/dashboard-restaurant/shared";

export const metadata: Metadata = { title: "Cuisine — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Écran de la cuisine : commandes en cours, mises à jour automatiquement. */
export default async function KitchenPage() {
  const membership = await requireRestaurantPage("orders.view");
  const { tickets, soldOut, tz } = await withTenant(membership.tenantId, async (tx) => ({
    tz: (await tx.tenant.findUnique({ where: { id: membership.tenantId }, select: { timezone: true } }))?.timezone || "Africa/Dakar",
    tickets: await kitchenBoard(tx, membership.tenantId),
    soldOut: await tx.dish.count({ where: { tenantId: membership.tenantId, isActive: true, isAvailable: false } }),
  }));
  return (
    <>
      <PageHeader
        eyebrow="Service"
        title="Cuisine"
        description="Chaque commande en ligne, à table ou saisie en salle arrive ici. Un geste fait avancer l'étape ; le client la voit sur son suivi."
        actions={<ButtonLink href="/dashboard/ventes/nouvelle" variant="royal"><IconPlus size={18} /> Commande</ButtonLink>}
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <LiveRefresh />
        <Link href="/dashboard/carte" className="text-sm font-semibold text-yc-electric hover:underline">{soldOut ? `${soldOut} plat${soldOut > 1 ? "s" : ""} épuisé${soldOut > 1 ? "s" : ""} · gérer` : "Marquer un plat épuisé"}</Link>
      </div>
      <KitchenBoard
        canMove={hasPermission(membership.permissions, "orders.update_status")}
        canCancel={hasPermission(membership.permissions, "orders.cancel")}
        tickets={tickets.map((t) => ({
          id: t.id,
          number: t.number,
          status: t.status,
          mode: t.mode,
          table: t.table?.label ?? null,
          customerName: t.customerName,
          createdAt: t.createdAt.toISOString(),
          requestedFor: t.requestedFor ? timeIn(t.requestedFor, tz) : null,
          note: t.note,
          items: t.items.map((i) => ({ id: i.id, quantity: i.quantity, name: i.nameSnapshot, options: optionsText(i.options), note: i.note })),
        }))}
      />
    </>
  );
}
