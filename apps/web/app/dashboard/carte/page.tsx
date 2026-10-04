import type { Metadata } from "next";
import { withTenant, getMenu } from "@yamacommerce/database";
import { hasPermission } from "@yamacommerce/auth";
import { requireRestaurantPage } from "@/lib/restaurant/guard";
import { PageHeader } from "@/components/yc/panel";
import { MenuManager } from "@/components/dashboard-restaurant/menu-manager";

export const metadata: Metadata = { title: "La carte — Y-COM", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** La carte : rubriques, plats, épuisés du jour. */
export default async function MenuAdminPage() {
  const membership = await requireRestaurantPage("products.view");
  const sections = await withTenant(membership.tenantId, (tx) => getMenu(tx, membership.tenantId));
  return (
    <>
      <PageHeader eyebrow="Gestion" title="La carte" description="Ce que vos clients voient sur le site et en scannant le QR code des tables. Un plat épuisé reste affiché, grisé, et ne peut plus être commandé." />
      <MenuManager
        canEdit={hasPermission(membership.permissions, "products.edit")}
        canToggle={hasPermission(membership.permissions, "orders.update_status")}
        sections={sections.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          isActive: s.isActive,
          availableFrom: s.availableFrom,
          availableTo: s.availableTo,
          dishes: s.dishes.map((d) => ({
            id: d.id,
            name: d.name,
            price: d.price,
            isAvailable: d.isAvailable,
            isActive: d.isActive,
            badges: d.badges,
            imageUrl: d.imageUrl,
            groups: d.optionGroups.length,
            soldOutOptions: d.optionGroups.flatMap((g) => g.options).filter((o) => !o.isAvailable).map((o) => ({ id: o.id, name: o.name })),
          })),
        }))}
      />
    </>
  );
}
