import type { Metadata } from "next";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { withTenant, listTables } from "@yamacommerce/database";
import { hasPermission } from "@yamacommerce/auth";
import { requireRestaurantPage } from "@/lib/restaurant/guard";
import { PageHeader, Panel } from "@/components/yc/panel";
import { EmptyState } from "@/components/yc/empty-state";
import { TablesManager } from "@/components/dashboard-restaurant/tables-manager";

export const metadata: Metadata = { title: "Tables et QR codes — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Tables et QR codes : chaque code mène à la carte en mode « sur place » pour SA table. */
export default async function TablesPage() {
  const membership = await requireRestaurantPage("listings.view");
  const { tables, domain } = await withTenant(membership.tenantId, async (tx) => ({
    tables: await listTables(tx, membership.tenantId),
    domain: await tx.domain.findFirst({ where: { tenantId: membership.tenantId, lifecycleStatus: "ACTIVE" }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }], select: { domain: true } }),
  }));
  const host = domain?.domain ?? (await headers()).get("host") ?? "";
  const base = `${host.startsWith("localhost") || host.includes(":") ? "http" : "https"}://${host}`;
  const cards = await Promise.all(
    tables.map(async (t) => {
      const url = `${base}/table/${t.qrToken}`;
      return { id: t.id, label: t.label, seats: t.seats, zone: t.zone, isActive: t.isActive, url, qrSvg: await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0C1630", light: "#FFFFFF" } }) };
    }),
  );
  return (
    <>
      <PageHeader eyebrow="Gestion" title="Tables et QR codes" description="Imprimez le QR code de chaque table : vos clients commandent depuis leur téléphone, la commande arrive en cuisine avec le numéro de table." />
      {tables.length === 0 && !hasPermission(membership.permissions, "listings.manage_availability") ? (
        <Panel><EmptyState title="Aucune table" description="Demandez au responsable d'ajouter les tables de la salle." /></Panel>
      ) : (
        <TablesManager tables={cards} canEdit={hasPermission(membership.permissions, "listings.manage_availability")} tenantName={membership.tenantName} />
      )}
    </>
  );
}
